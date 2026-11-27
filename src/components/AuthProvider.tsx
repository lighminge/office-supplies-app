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
import { Shield, LogIn, LogOut, UserCheck, Lock, KeyRound, AlertCircle, Settings } from 'lucide-react';

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [systemUser, setSystemUser] = useState<SystemUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_VISITOR_PERMISSIONS);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [boundApplicant, setBoundApplicant] = useState<BoundApplicant | null>(null);

  // Login Modal State
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
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
      // ignore if rules not yet updated
    }

    if (firebaseUser.isAnonymous) {
      setIsAdmin(false);
      setSystemUser(null);
      setPermissions(DEFAULT_VISITOR_PERMISSIONS);
      return;
    }

    try {
      const [tokenResult, adminSnap, sysUserSnap] = await Promise.all([
        firebaseUser.getIdTokenResult(),
        getDoc(doc(db, 'admins', firebaseUser.uid)).catch(() => null),
        getDoc(doc(db, 'system_users', firebaseUser.uid)).catch(() => null),
      ]);

      const sysData = sysUserSnap && sysUserSnap.exists() ? (sysUserSnap.data() as SystemUser) : null;
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
  }, [bindApplicant]);

  const refreshProfile = useCallback(async () => {
    await loadUserProfileAndPermissions(auth.currentUser);
  }, [loadUserProfileAndPermissions]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthError(null);
        await loadUserProfileAndPermissions(currentUser);
        setLoading(false);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          setUser(cred.user);
          await loadUserProfileAndPermissions(cred.user);
          setAuthError(null);
        } catch (err: any) {
          setUser(null);
          setIsAdmin(false);
          if (err?.code === 'auth/operation-not-allowed' || err?.code === 'auth/configuration-not-found') {
            setAuthError('請於 Firebase Console 啟用 Authentication (Anonymous / Email / Google) 以確保完整存取權限。');
          }
        } finally {
          setLoading(false);
        }
      }
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

      await loadUserProfileAndPermissions(targetUser);
    },
    [loadUserProfileAndPermissions]
  );

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
      setLoginModalOpen(false);
      setEmail('');
      setPassword('');
    } catch (err: any) {
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
      const cred = await signInWithPopup(auth, provider);
      await loadUserProfileAndPermissions(cred.user);
      setLoginModalOpen(false);
    } catch (err: any) {
      setModalError('Google 登入失敗：請確認網域已加入 Firebase 授權網域並啟用 Google 登入。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    clearApplicantBinding();
    await firebaseSignOut(auth);
  };

  const roleBadgeLabel = systemUser
    ? systemUser.isActive === false
      ? '已停用帳號'
      : systemUser.role === 'admin'
      ? '系統管理員'
      : systemUser.role === 'manager'
      ? '審核/管理人員'
      : '一般授權人員'
    : isAdmin
    ? '系統管理員'
    : null;

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
          setModalError('');
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
            {loading ? (
              <span className="text-gray-400 font-medium">正在驗證安全憑證...</span>
            ) : user && !user.isAnonymous ? (
              <span
                className={`font-bold px-2.5 py-0.5 rounded-full border ${
                  systemUser?.isActive === false
                    ? 'text-rose-700 bg-rose-50 border-rose-200'
                    : isAdmin
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                }`}
              >
                {roleBadgeLabel || '已登入使用者'}：{systemUser?.displayName || user.email}
              </span>
            ) : boundApplicant ? (
              <span className="font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                申請人：{boundApplicant.departmentName} - {boundApplicant.applicantName}
              </span>
            ) : (
              <span className="text-gray-600 font-medium">
                一般訪客 / 尚未綁定申請人身分
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
            {user && !user.isAnonymous ? (
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded-xl transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> 登出 ({systemUser?.displayName || user.email || '帳號'})
              </button>
            ) : (
              <button
                onClick={() => {
                  setModalError('');
                  setLoginModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold px-3.5 py-1.5 rounded-xl shadow-sm transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" /> 系統登入
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Login Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 bg-sky-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border-2 border-sky-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-sky-50 rounded-2xl text-sky-500">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800">系統人員安全登入</h2>
                <p className="text-xs text-gray-500">依據您的帳號權限開放對應的審核、採購或管理功能</p>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">登入信箱 (Email)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-xl border-2 border-sky-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-300"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">密碼 (Password)</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border-2 border-sky-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-300"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded-xl shadow-md shadow-sky-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                {submitting ? '驗證中...' : '使用信箱密碼登入'}
              </button>
            </form>

            <div className="relative my-4 text-center">
              <span className="bg-white px-3 text-xs text-gray-400 font-bold relative z-10">或</span>
              <div className="border-t border-gray-100 absolute top-1/2 left-0 right-0 -z-0" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200 font-bold py-2.5 rounded-xl text-sm transition-colors mb-3"
            >
              使用 Google 帳號登入
            </button>

            <button
              type="button"
              onClick={() => setLoginModalOpen(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 rounded-xl text-sm transition-colors"
            >
              關閉
            </button>
          </div>
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
                請先以授權的帳號登入系統。
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
