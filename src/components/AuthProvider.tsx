"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Shield, LogIn, LogOut, UserCheck, Lock, KeyRound, AlertCircle } from 'lucide-react';

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
  authError: string | null;
  boundApplicant: BoundApplicant | null;
  bindApplicant: (applicant: BoundApplicant) => void;
  clearApplicantBinding: () => void;
  openLoginModal: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAdmin: false,
  authError: null,
  boundApplicant: null,
  bindApplicant: () => {},
  clearApplicantBinding: () => {},
  openLoginModal: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const APPLICANT_STORAGE_KEY = 'office_supplies_bound_applicant_v1';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [boundApplicant, setBoundApplicant] = useState<BoundApplicant | null>(null);

  // Login Modal State
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Load bound applicant identity from sessionStorage (scoped to current browser session)
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

  const checkAdminRole = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser || firebaseUser.isAnonymous) {
      setIsAdmin(false);
      return;
    }
    try {
      const tokenResult = await firebaseUser.getIdTokenResult();
      if (tokenResult.claims.admin === true) {
        setIsAdmin(true);
        return;
      }
      const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
      if (adminDoc.exists()) {
        setIsAdmin(true);
        return;
      }
      // Fallback: check configured NEXT_PUBLIC_ADMIN_EMAILS if present
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
      if (
        firebaseUser.email &&
        adminEmails.includes(firebaseUser.email.toLowerCase())
      ) {
        setIsAdmin(true);
        return;
      }
      setIsAdmin(false);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthError(null);
        await checkAdminRole(currentUser);
        setLoading(false);
      } else {
        // Attempt anonymous sign-in for basic authenticated session so Firestore rules requiring request.auth != null work for applicants
        try {
          const cred = await signInAnonymously(auth);
          setUser(cred.user);
          setIsAdmin(false);
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
  }, [checkAdminRole]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!email.trim() || !password) {
      setModalError('請輸入管理員電子郵件與密碼');
      return;
    }
    setSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await checkAdminRole(cred.user);
      setLoginModalOpen(false);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setModalError('登入失敗：請確認帳號密碼是否正確，或已在 Firebase 啟用 Email/Password 登入。');
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
      await checkAdminRole(cred.user);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        authError,
        boundApplicant,
        bindApplicant,
        clearApplicantBinding,
        openLoginModal: () => {
          setModalError('');
          setLoginModalOpen(true);
        },
        signOut: handleSignOut,
      }}
    >
      {/* Top Security & Identity Status Bar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-sky-100 px-4 md:px-8 py-2.5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <Shield className={`w-4 h-4 ${isAdmin ? 'text-emerald-500' : 'text-sky-500'}`} />
            {loading ? (
              <span className="text-gray-400 font-medium">正在驗證安全憑證...</span>
            ) : isAdmin ? (
              <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                系統管理員 ({user?.email || 'Admin'})
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
            {authError && (
              <span className="text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1 text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                {authError}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
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
                <LogOut className="w-3.5 h-3.5" /> 登出 ({user.email || '帳號'})
              </button>
            ) : (
              <button
                onClick={() => {
                  setModalError('');
                  setLoginModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold px-3.5 py-1.5 rounded-xl shadow-sm transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" /> 管理員登入
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Admin Login Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 bg-sky-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border-2 border-sky-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-sky-50 rounded-2xl text-sky-500">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800">管理員安全登入</h2>
                <p className="text-xs text-gray-500">登入後可存取單據審核、用品採購與組織管理</p>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">管理員信箱 (Email)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
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
 * 管理員權限守衛元件：保護後台頁面（/management, /workflow, /organization, /report）
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin, user, openLoginModal } = useAuth();

  if (loading) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="text-sky-500 font-bold animate-pulse">正在驗證管理員權限...</div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-[75vh] flex items-center justify-center p-6">
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-8 max-w-md w-full shadow-xl border-2 border-rose-100 text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-gray-800 mb-2">需要管理員權限</h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            此頁面僅限授權的系統管理員存取。
            {user && !user.isAnonymous ? (
              <span className="block mt-2 text-xs text-rose-500 font-bold">
                目前登入帳號 ({user.email || user.uid}) 尚未被列入 Firestore `admins/{user.uid}` 管理員名單。
              </span>
            ) : null}
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
              管理員登入
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
