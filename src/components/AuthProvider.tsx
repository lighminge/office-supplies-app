"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { SystemUser, UserPermissions, ROLE_DEFAULT_PERMISSIONS } from '@/types';
import {
  Shield,
  LogIn,
  LogOut,
  UserCheck,
  Lock,
  KeyRound,
  AlertCircle,
  Settings,
  Sparkles,
  User as UserIcon,
  Globe,
} from 'lucide-react';

export interface BoundApplicant {
  departmentId: string;
  departmentName: string;
  applicantId: string;
  applicantName: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  systemUser: SystemUser | null;
  permissions: UserPermissions;
  hasPermission: (perm: keyof UserPermissions) => boolean;
  isBootstrapped: boolean | null;
  authError: string | null;
  boundApplicant: BoundApplicant | null;
  bindApplicant: (applicant: BoundApplicant) => void;
  clearApplicantBinding: () => void;
  openLoginModal: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  bootstrapFirstAdmin: (email: string, password: string, displayName: string) => Promise<void>;
}

const DEFAULT_VISITOR_PERMISSIONS: UserPermissions = {
  canRequest: true,
  canWorkflow: false,
  canManageSupplies: false,
  canViewReports: false,
  canManageOrg: false,
  canManageSystem: false,
};

const DISABLED_PERMISSIONS: UserPermissions = {
  canRequest: false,
  canWorkflow: false,
  canManageSupplies: false,
  canViewReports: false,
  canManageOrg: false,
  canManageSystem: false,
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAdmin: false,
  systemUser: null,
  permissions: DEFAULT_VISITOR_PERMISSIONS,
  hasPermission: () => false,
  isBootstrapped: null,
  authError: null,
  boundApplicant: null,
  bindApplicant: () => {},
  clearApplicantBinding: () => {},
  openLoginModal: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  bootstrapFirstAdmin: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const APPLICANT_STORAGE_KEY = 'office_supplies_bound_applicant_v1';
const SESSION_ACTIVE_STORAGE_KEY = 'office_supplies_session_active_v1';

export const PERMISSION_LABELS: Record<keyof UserPermissions, string> = {
  canRequest: '用品申請 (/request)',
  canWorkflow: '單據審核與領用 (/workflow)',
  canManageSupplies: '用品與採購管理 (/management)',
  canViewReports: '統計報表查詢 (/report)',
  canManageOrg: '單位與人員管理 (/organization)',
  canManageSystem: '系統帳號與權限管理 (/system)',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSessionUnlocked, setIsSessionUnlocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [systemUser, setSystemUser] = useState<SystemUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_VISITOR_PERMISSIONS);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [boundApplicant, setBoundApplicant] = useState<BoundApplicant | null>(null);

  // Login Form / Modal State
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pwdFocused, setPwdFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const activeFlag = window.sessionStorage.getItem(SESSION_ACTIVE_STORAGE_KEY);
      if (activeFlag === 'true') {
        setIsSessionUnlocked(true);
      }
      const raw = window.sessionStorage.getItem(APPLICANT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.departmentId === 'string' &&
          typeof parsed.applicantId === 'string' &&
          typeof parsed.departmentName === 'string' &&
          typeof parsed.applicantName === 'string'
        ) {
          setBoundApplicant(parsed);
        }
      }
    } catch {
      // ignore corrupted session storage
    }
  }, []);

  const markSessionUnlocked = useCallback((unlocked: boolean) => {
    setIsSessionUnlocked(unlocked);
    if (typeof window !== 'undefined') {
      if (unlocked) {
        window.sessionStorage.setItem(SESSION_ACTIVE_STORAGE_KEY, 'true');
      } else {
        window.sessionStorage.removeItem(SESSION_ACTIVE_STORAGE_KEY);
      }
    }
  }, []);

  const bindApplicant = useCallback((applicant: BoundApplicant) => {
    setBoundApplicant(applicant);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(APPLICANT_STORAGE_KEY, JSON.stringify(applicant));
    }
  }, []);

  const clearApplicantBinding = useCallback(() => {
    setBoundApplicant(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(APPLICANT_STORAGE_KEY);
    }
  }, []);

  /**
   * 當一般使用者透過 Google 帳號登入時，若尚未在 system_users 建立權限檔案，
   * 自動建立預設的一般人員 (staff) 記錄（僅開放用品申請權限），方便管理員後續於「系統管理」調整權限
   */
  const ensureNonAnonymousUserProfile = useCallback(async (firebaseUser: User): Promise<SystemUser | null> => {
    if (firebaseUser.isAnonymous) return null;
    try {
      const userRef = doc(db, 'system_users', firebaseUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return snap.data() as SystemUser;
      }
      const cleanEmail = (firebaseUser.email || 'google-user@example.com').trim().toLowerCase().slice(0, 100);
      const cleanName = (
        firebaseUser.displayName ||
        firebaseUser.email?.split('@')[0] ||
        '一般使用者'
      )
        .trim()
        .slice(0, 50) || '一般使用者';

      const defaultProfile: SystemUser = {
        uid: firebaseUser.uid,
        email: cleanEmail,
        displayName: cleanName,
        role: 'staff',
        isActive: true,
        departmentId: '',
        departmentName: '',
        personnelId: '',
        personnelName: '',
        permissions: ROLE_DEFAULT_PERMISSIONS.staff,
      };

      await setDoc(userRef, {
        ...defaultProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return defaultProfile;
    } catch {
      return null;
    }
  }, []);

  const loadUserProfileAndPermissions = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setIsAdmin(false);
      setSystemUser(null);
      setPermissions(DEFAULT_VISITOR_PERMISSIONS);
      return;
    }

    try {
      const bootstrapSnap = await getDoc(doc(db, 'system_config', 'bootstrap'));
      setIsBootstrapped(bootstrapSnap.exists());
    } catch {
      // ignore if not accessible yet
    }

    if (firebaseUser.isAnonymous) {
      setIsAdmin(false);
      setSystemUser(null);
      setPermissions(DEFAULT_VISITOR_PERMISSIONS);
      return;
    }

    try {
      const [tokenResult, adminSnap, existingSysUserSnap] = await Promise.all([
        firebaseUser.getIdTokenResult(),
        getDoc(doc(db, 'admins', firebaseUser.uid)).catch(() => null),
        getDoc(doc(db, 'system_users', firebaseUser.uid)).catch(() => null),
      ]);

      let sysData =
        existingSysUserSnap && existingSysUserSnap.exists()
          ? (existingSysUserSnap.data() as SystemUser)
          : null;

      if (!sysData && !(adminSnap && adminSnap.exists())) {
        sysData = await ensureNonAnonymousUserProfile(firebaseUser);
      }

      setSystemUser(sysData);

      // 若帳號在 system_users 中被設為停用 (isActive === false)，立即撤銷所有權限
      if (sysData && sysData.isActive === false) {
        setIsAdmin(false);
        setPermissions(DISABLED_PERMISSIONS);
        return;
      }

      // 若帳號有綁定單位與人員，自動帶入申請人綁定
      if (sysData?.departmentId && sysData?.personnelId && sysData?.departmentName && sysData?.personnelName) {
        bindApplicant({
          departmentId: sysData.departmentId,
          departmentName: sysData.departmentName,
          applicantId: sysData.personnelId,
          applicantName: sysData.personnelName,
        });
      }

      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);

      const hasAdminClaimOrDoc =
        tokenResult.claims.admin === true ||
        Boolean(adminSnap && adminSnap.exists()) ||
        sysData?.role === 'admin' ||
        Boolean(firebaseUser.email && adminEmails.includes(firebaseUser.email.toLowerCase()));

      if (hasAdminClaimOrDoc) {
        setIsAdmin(true);
        setPermissions(sysData?.permissions || ROLE_DEFAULT_PERMISSIONS.admin);
        return;
      }

      if (sysData && sysData.isActive) {
        setIsAdmin(sysData.permissions?.canManageSystem === true);
        setPermissions(sysData.permissions);
        return;
      }

      setIsAdmin(false);
      setPermissions(DEFAULT_VISITOR_PERMISSIONS);
    } catch {
      setIsAdmin(false);
      setSystemUser(null);
      setPermissions(DEFAULT_VISITOR_PERMISSIONS);
    }
  }, [bindApplicant, ensureNonAnonymousUserProfile]);

  const refreshProfile = useCallback(async () => {
    await loadUserProfileAndPermissions(auth.currentUser);
  }, [loadUserProfileAndPermissions]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthError(null);
        await loadUserProfileAndPermissions(currentUser);
      } else {
        setUser(null);
        setIsAdmin(false);
        setSystemUser(null);
        setPermissions(DEFAULT_VISITOR_PERMISSIONS);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [loadUserProfileAndPermissions]);

  const hasPermission = useCallback(
    (perm: keyof UserPermissions): boolean => {
      if (systemUser && systemUser.isActive === false) return false;
      if (isAdmin) return true;
      return Boolean(permissions[perm]);
    },
    [isAdmin, permissions, systemUser]
  );

  /**
   * 首次系統初始化：當系統尚未建立任何管理員時，允許註冊或登入第一位最高權限管理員
   */
  const bootstrapFirstAdmin = useCallback(
    async (adminEmail: string, adminPassword: string, displayName: string) => {
      const cleanEmail = adminEmail.trim().toLowerCase();
      const cleanName = displayName.trim() || '系統管理員';
      let targetUser = auth.currentUser;

      if (!targetUser || targetUser.isAnonymous || targetUser.email?.toLowerCase() !== cleanEmail) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, adminPassword);
          targetUser = cred.user;
        } catch (err: any) {
          if (err?.code === 'auth/email-already-in-use') {
            const cred = await signInWithEmailAndPassword(auth, cleanEmail, adminPassword);
            targetUser = cred.user;
          } else {
            throw err;
          }
        }
      }

      if (!targetUser) throw new Error('無法取得管理員登入憑證');

      const adminPerms = ROLE_DEFAULT_PERMISSIONS.admin;
      await setDoc(doc(db, 'admins', targetUser.uid), {
        uid: targetUser.uid,
        email: cleanEmail,
        role: 'admin',
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'system_users', targetUser.uid), {
        uid: targetUser.uid,
        email: cleanEmail,
        displayName: cleanName,
        role: 'admin',
        isActive: true,
        permissions: adminPerms,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'system_config', 'bootstrap'), {
        initialized: true,
        firstAdminUid: targetUser.uid,
        firstAdminEmail: cleanEmail,
        updatedAt: serverTimestamp(),
      });

      markSessionUnlocked(true);
      await loadUserProfileAndPermissions(targetUser);
    },
    [loadUserProfileAndPermissions, markSessionUnlocked]
  );

  const resetLoginFormFields = () => {
    setEmail('');
    setPassword('');
    setPwdFocused(false);
    setModalError('');
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!email.trim() || !password) {
      setModalError('請輸入電子郵件與密碼');
      return;
    }
    setSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await loadUserProfileAndPermissions(cred.user);
      markSessionUnlocked(true);
      setLoginModalOpen(false);
      resetLoginFormFields();
    } catch {
      setModalError('登入失敗：請確認帳號密碼是否正確。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setModalError('');
    setSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      await loadUserProfileAndPermissions(cred.user);
      markSessionUnlocked(true);
      setLoginModalOpen(false);
      resetLoginFormFields();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setModalError('已取消 Google 登入視窗。');
      } else {
        setModalError('Google 登入失敗：請確認於 Firebase Console 已啟用 Google 登入並加入授權網域。');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestLogin = async () => {
    setModalError('');
    setSubmitting(true);
    try {
      if (!auth.currentUser) {
        const cred = await signInAnonymously(auth);
        setUser(cred.user);
        await loadUserProfileAndPermissions(cred.user);
      } else if (!auth.currentUser.isAnonymous) {
        await firebaseSignOut(auth);
        const cred = await signInAnonymously(auth);
        setUser(cred.user);
        await loadUserProfileAndPermissions(cred.user);
      } else {
        await loadUserProfileAndPermissions(auth.currentUser);
      }
      markSessionUnlocked(true);
      setLoginModalOpen(false);
      resetLoginFormFields();
    } catch {
      setModalError('訪客登入失敗：請確認 Firebase Authentication 已啟用 Anonymous 匿名登入。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    clearApplicantBinding();
    markSessionUnlocked(false);
    resetLoginFormFields();
    await firebaseSignOut(auth);
  };

  const roleBadgeLabel = systemUser
    ? systemUser.isActive === false
      ? '已停用帳號'
      : systemUser.role === 'admin'
      ? '系統管理員'
      : systemUser.role === 'manager'
      ? '審核/管理人員'
      : '一般人員'
    : isAdmin
    ? '系統管理員'
    : user && !user.isAnonymous
    ? 'Google 一般人員'
    : '訪客模式';

  /**
   * 共用的登入表單卡片內容（確保密碼欄位絕不自動帶入密碼，並同時支援 Email/密碼、Google 登入與訪客登入）
   */
  const renderLoginCard = (isModal = false) => (
    <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl border-2 border-sky-100 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-36 h-36 bg-sky-50 rounded-full opacity-60 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="bg-sky-500 p-3.5 rounded-2xl shadow-lg shadow-sky-200 mb-3">
            <Sparkles className="text-white w-7 h-7 animate-pulse" />
          </div>
          <span className="text-sky-600 font-bold tracking-widest text-xs uppercase mb-1">
            Office Supplies System
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-gray-800">
            辦公室用具管理 <span className="text-sky-500">系統登入</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1.5">
            請選擇登入方式以進入系統 💙
          </p>
        </div>

        {modalError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold">
            {modalError}
          </div>
        )}

        {/* Email & Password Login Form (嚴格禁止瀏覽器自動填入密碼) */}
        <form onSubmit={handleEmailLogin} autoComplete="off" className="space-y-4 mb-5">
          {/* 隱藏誘餌欄位，攔截部分瀏覽器強制自動填入行為 */}
          <input
            type="text"
            name="prevent_autofill_username"
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
          />
          <input
            type="password"
            name="prevent_autofill_password"
            autoComplete="new-password"
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
          />

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">登入信箱 (Email)</label>
            <input
              type="email"
              name="office_login_email"
              autoComplete="off"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="請輸入電子郵件"
              className="w-full rounded-xl border-2 border-sky-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">登入密碼 (Password)</label>
            <input
              type="password"
              name="office_login_pwd_no_autofill"
              autoComplete="new-password"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              readOnly={!pwdFocused}
              onFocus={() => setPwdFocused(true)}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              className="w-full rounded-xl border-2 border-sky-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-400 bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black py-3 rounded-xl shadow-md shadow-sky-100 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            <KeyRound className="w-4 h-4" />
            {submitting ? '驗證中...' : '帳號密碼登入'}
          </button>
        </form>

        <div className="relative my-5 text-center">
          <span className="bg-white px-3 text-xs text-gray-400 font-bold relative z-10">
            其他快速登入方式
          </span>
          <div className="border-t border-gray-100 absolute top-1/2 left-0 right-0 -z-0" />
        </div>

        {/* Google Login (支援一般使用者與管理員) */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full bg-white hover:bg-sky-50/50 text-gray-700 border-2 border-sky-100 hover:border-sky-300 font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Globe className="w-4 h-4 text-sky-500" />
            使用 Google 帳號登入
          </button>

          {/* Guest Login (免帳號密碼) */}
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={submitting}
            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-2 border-emerald-200 font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <UserIcon className="w-4 h-4 text-emerald-600" />
            訪客登入（免帳號密碼）
          </button>
        </div>

        {isModal && (
          <button
            type="button"
            onClick={() => setLoginModalOpen(false)}
            className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            取消返回
          </button>
        )}
      </div>
    </div>
  );

  // 載入中畫面
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-sky-50/50">
        <div className="text-sky-500 font-bold text-lg animate-pulse flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> 系統啟動驗證中...
        </div>
      </main>
    );
  }

  // 當系統開啟且尚未完成本次會話登入（或已登出）時，優先呈現全螢幕「系統登入」畫面
  if (!isSessionUnlocked || !user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-sky-50 via-white to-indigo-50/40">
        {renderLoginCard(false)}
        <p className="text-gray-400 text-xs font-medium mt-8">
          © 2026 可愛風辦公室用品管理系統 · 安全驗證中心
        </p>
      </main>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        systemUser,
        permissions,
        hasPermission,
        isBootstrapped,
        authError,
        boundApplicant,
        bindApplicant,
        clearApplicantBinding,
        openLoginModal: () => {
          resetLoginFormFields();
          setLoginModalOpen(true);
        },
        signOut: handleSignOut,
        refreshProfile,
        bootstrapFirstAdmin,
      }}
    >
      {/* Top Security & Identity Status Bar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-sky-100 px-4 md:px-8 py-2.5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <Shield className={`w-4 h-4 ${isAdmin ? 'text-emerald-500' : 'text-sky-500'}`} />
            {user && !user.isAnonymous ? (
              <span
                className={`font-bold px-2.5 py-0.5 rounded-full border ${
                  systemUser?.isActive === false
                    ? 'text-rose-700 bg-rose-50 border-rose-200'
                    : isAdmin
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                }`}
              >
                {roleBadgeLabel}：{systemUser?.displayName || user.displayName || user.email}
              </span>
            ) : (
              <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                訪客模式（免帳號密碼）
              </span>
            )}

            {boundApplicant && (
              <span className="font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                申請人：{boundApplicant.departmentName} - {boundApplicant.applicantName}
              </span>
            )}

            {isBootstrapped === false && (
              <Link
                href="/system"
                className="text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 text-xs transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                尚未初始化管理員（點此前往系統管理設定）
              </Link>
            )}
            {authError && (
              <span className="text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1 text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                {authError}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasPermission('canManageSystem') && (
              <Link
                href="/system"
                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-bold px-3 py-1 rounded-xl transition-colors"
              >
                <Settings className="w-3.5 h-3.5" /> 系統管理
              </Link>
            )}
            {boundApplicant && !isAdmin && (
              <button
                onClick={clearApplicantBinding}
                className="text-gray-500 hover:text-rose-500 font-bold px-2.5 py-1 rounded-xl hover:bg-rose-50 transition-colors"
              >
                解除申請人綁定
              </button>
            )}
            <button
              onClick={() => {
                resetLoginFormFields();
                setLoginModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200 font-bold px-3 py-1.5 rounded-xl transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> 切換帳號
            </button>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded-xl transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> 登出
            </button>
          </div>
        </div>
      </div>

      {/* Switch Account Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 bg-sky-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          {renderLoginCard(true)}
        </div>
      )}

      {children}
    </AuthContext.Provider>
  );
}

/**
 * 權限守衛元件：依各頁面所需的細部權限（requiredPermission）進行存取控管
 */
export function AdminGuard({
  children,
  requiredPermission,
  allowBootstrap = false,
}: {
  children: React.ReactNode;
  requiredPermission?: keyof UserPermissions;
  allowBootstrap?: boolean;
}) {
  const { loading, isAdmin, systemUser, hasPermission, isBootstrapped, user, openLoginModal } = useAuth();

  if (loading) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="text-sky-500 font-bold animate-pulse">正在驗證操作權限...</div>
      </main>
    );
  }

  // 若為系統管理頁面且系統尚未初始化第一位管理員，允許進入執行首次管理員設定
  if (allowBootstrap && isBootstrapped === false) {
    return <>{children}</>;
  }

  const authorized = requiredPermission ? hasPermission(requiredPermission) : isAdmin;

  if (!authorized) {
    const requiredLabel = requiredPermission ? PERMISSION_LABELS[requiredPermission] : '系統管理員權限';
    return (
      <main className="min-h-[75vh] flex items-center justify-center p-6">
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-8 max-w-md w-full shadow-xl border-2 border-rose-100 text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-gray-800 mb-2">存取權限不足</h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            此功能需要「<span className="font-bold text-gray-700">{requiredLabel}</span>」權限。
            {systemUser?.isActive === false ? (
              <span className="block mt-2 text-xs text-rose-600 font-bold">
                您目前的帳號（{systemUser.email}）已被系統管理員停用。
              </span>
            ) : user && !user.isAnonymous ? (
              <span className="block mt-2 text-xs text-rose-500 font-bold">
                目前登入帳號（{user.email || user.uid}）尚未被授予此模組的操作權限，請聯繫系統管理員至「系統管理」開啟權限。
              </span>
            ) : (
              <span className="block mt-2 text-xs text-gray-400">
                您目前為「訪客模式」，請切換為具備權限的帳號登入。
              </span>
            )}
          </p>
          <div className="flex gap-3">
            <Link
              href="/"
              className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm transition-colors"
            >
              返回首頁
            </Link>
            <button
              onClick={openLoginModal}
              className="flex-1 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm shadow-md shadow-sky-100 transition-colors"
            >
              切換 / 登入帳號
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
