"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  UserPlus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  KeyRound,
  Mail,
  Lock,
  Sparkles,
  Search,
  RefreshCw,
  Globe,
  Bell,
  UserCheck,
} from 'lucide-react';
import { db, auth, createAuthAccountWithoutSignIn } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import {
  SystemUser,
  SystemRole,
  UserPermissions,
  ROLE_DEFAULT_PERMISSIONS,
  Department,
  Personnel,
} from '@/types';
import { AdminGuard, useAuth, PERMISSION_LABELS } from '@/components/AuthProvider';
import ConfirmModal from '@/components/ConfirmModal';
import { sanitizeText } from '@/lib/security';

const ROLE_LABELS: Record<SystemRole, { label: string; color: string }> = {
  admin: { label: '系統管理員', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  manager: { label: '審核/管理人員', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  staff: { label: '一般人員', color: 'bg-sky-100 text-sky-700 border-sky-200' },
};

const PERMISSION_KEYS: (keyof UserPermissions)[] = [
  'canRequest',
  'canWorkflow',
  'canManageSupplies',
  'canViewReports',
  'canManageOrg',
  'canManageSystem',
];

export default function SystemManagementPage() {
  const { user, isBootstrapped, bootstrapFirstAdmin, refreshProfile } = useAuth();

  // Data state
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | SystemRole>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'pending' | 'active' | 'disabled'>('All');

  // First-time Bootstrap Form
  const [bootEmail, setBootEmail] = useState('');
  const [bootPassword, setBootPassword] = useState('');
  const [bootName, setBootName] = useState('最高系統管理員');
  const [bootLoading, setBootLoading] = useState(false);

  // Add / Edit User Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [createMode, setCreateMode] = useState<'new_auth' | 'existing_uid'>('new_auth');
  const [formUid, setFormUid] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<SystemRole>('staff');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formDeptId, setFormDeptId] = useState('');
  const [formPersonId, setFormPersonId] = useState('');
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(
    ROLE_DEFAULT_PERMISSIONS.staff
  );
  const [savingUser, setSavingUser] = useState(false);

  // Confirm Modal State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmBtnText, setConfirmBtnText] = useState('確認');
  const [confirmBtnColor, setConfirmBtnColor] = useState('bg-sky-500 hover:bg-sky-600');

  const requestAction = (
    msg: string,
    action: () => Promise<void> | void,
    btnText = '確認',
    btnColor = 'bg-sky-500 hover:bg-sky-600 shadow-sky-200'
  ) => {
    setConfirmMessage(msg);
    setConfirmAction(() => action);
    setConfirmBtnText(btnText);
    setConfirmBtnColor(btnColor);
    setConfirmOpen(true);
  };

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const [usersSnap, deptSnap, perSnap] = await Promise.all([
        getDocs(collection(db, 'system_users')).catch(() => null),
        getDocs(collection(db, 'departments')).catch(() => null),
        getDocs(collection(db, 'personnel')).catch(() => null),
      ]);

      if (usersSnap) {
        const list = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as SystemUser));
        // 將「待核可 (pending)」的 Google 登入帳號排在最上方，方便管理員第一時間核可與設定權限
        list.sort((a, b) => {
          const aPending = a.approvalStatus === 'pending' ? 1 : 0;
          const bPending = b.approvalStatus === 'pending' ? 1 : 0;
          if (aPending !== bPending) return bPending - aPending;
          return (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0);
        });
        setSystemUsers(list);
      }
      if (deptSnap) {
        setDepartments(deptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
      }
      if (perSnap) {
        setPersonnel(perSnap.docs.map(d => ({ id: d.id, ...d.data() } as Personnel)));
      }
    } catch (e) {
      console.error('Error fetching system management data:', e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isBootstrapped !== false) {
      fetchData();
    }
  }, [isBootstrapped]);

  // --- First-Time Bootstrap Handler ---
  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeText(bootName, 50);
    if (!bootEmail.trim() || bootPassword.length < 6 || !cleanName) {
      alert('請填寫有效的姓名、電子郵件與至少 6 碼的密碼！');
      return;
    }
    setBootLoading(true);
    try {
      await bootstrapFirstAdmin(bootEmail, bootPassword, cleanName);
      alert('🎉 第一位最高系統管理員初始化完成！您現在可以新增與管理所有系統人員權限。');
      fetchData();
    } catch (err: any) {
      alert('初始化失敗：' + (err?.message || '請確認信箱格式與密碼強度'));
    } finally {
      setBootLoading(false);
    }
  };

  // --- Open Modal for Create / Edit / Approve ---
  const openCreateModal = () => {
    setEditingUser(null);
    setCreateMode('new_auth');
    setFormUid('');
    setFormEmail('');
    setFormPassword('');
    setFormDisplayName('');
    setFormRole('staff');
    setFormIsActive(true);
    setFormDeptId('');
    setFormPersonId('');
    setFormPermissions({ ...ROLE_DEFAULT_PERMISSIONS.staff });
    setModalOpen(true);
  };

  const openEditModal = (u: SystemUser) => {
    setEditingUser(u);
    setFormUid(u.uid);
    setFormEmail(u.email);
    setFormPassword('');
    setFormDisplayName(u.displayName);
    setFormRole(u.role);
    setFormIsActive(u.isActive);
    setFormDeptId(u.departmentId || '');
    setFormPersonId(u.personnelId || '');
    setFormPermissions({
      ...(ROLE_DEFAULT_PERMISSIONS[u.role] || ROLE_DEFAULT_PERMISSIONS.staff),
      ...(u.permissions || {}),
    });
    setModalOpen(true);
  };

  const handleRoleChange = (newRole: SystemRole) => {
    setFormRole(newRole);
    setFormPermissions({ ...ROLE_DEFAULT_PERMISSIONS[newRole] });
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    setFormPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // --- Quick Approve Pending Google Account ---
  const handleQuickApprove = (u: SystemUser) => {
    requestAction(
      `確定要核可「${u.displayName} (${u.email})」的 Google 登入帳號嗎？（您也可以點擊「核可並設定權限」為其指派單位與進階模組權限）`,
      async () => {
        try {
          await updateDoc(doc(db, 'system_users', u.uid), {
            approvalStatus: 'approved',
            isActive: true,
            updatedAt: serverTimestamp(),
          });
          fetchData();
        } catch (err: any) {
          alert('核可失敗：' + err.message);
        }
      },
      '確認核可',
      'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
    );
  };

  // --- Save User (Create or Update / Approve) ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeText(formDisplayName, 50);
    const cleanEmail = formEmail.trim().toLowerCase();

    if (!cleanName) {
      alert('請輸入有效的人員顯示名稱（1 ~ 50 字元）！');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      alert('請輸入有效的登入電子郵件（Email）！');
      return;
    }

    // 防止管理員將自己停用或移除自己的系統管理權限導致鎖死
    if (editingUser && editingUser.uid === user?.uid) {
      if (!formIsActive) {
        alert('安全限制：您無法停用自己目前登入中的管理員帳號！');
        return;
      }
      if (formRole !== 'admin' || !formPermissions.canManageSystem) {
        alert('安全限制：您無法移除自己目前帳號的「系統管理員」角色與「系統管理」權限！');
        return;
      }
    }

    setSavingUser(true);
    try {
      let targetUid = editingUser ? editingUser.uid : formUid.trim();

      if (!editingUser) {
        if (createMode === 'new_auth') {
          if (formPassword.length < 6) {
            alert('新帳號的初始登入密碼至少需 6 個字元！');
            setSavingUser(false);
            return;
          }
          targetUid = await createAuthAccountWithoutSignIn(cleanEmail, formPassword);
        } else {
          if (!targetUid || targetUid.length > 128) {
            alert('請輸入有效的 Firebase Auth UID！');
            setSavingUser(false);
            return;
          }
        }
      }

      const dept = departments.find(d => d.id === formDeptId);
      const person = personnel.find(p => p.id === formPersonId && p.departmentId === formDeptId);

      const userPayload: Record<string, any> = {
        uid: targetUid,
        email: cleanEmail,
        displayName: cleanName,
        role: formRole,
        isActive: formIsActive,
        authProvider: editingUser?.authProvider || (createMode === 'new_auth' ? 'password' : 'google'),
        approvalStatus: 'approved', // 管理員新增或儲存修改後即為已核可狀態
        departmentId: dept ? dept.id : '',
        departmentName: dept ? dept.name : '',
        personnelId: person ? person.id : '',
        personnelName: person ? person.name : '',
        permissions: formPermissions,
        updatedAt: serverTimestamp(),
      };

      if (!editingUser) {
        userPayload.createdAt = serverTimestamp();
      } else if (editingUser.createdAt) {
        userPayload.createdAt = editingUser.createdAt;
      }

      await setDoc(doc(db, 'system_users', targetUid), userPayload);

      // 同步維護 admins/{uid} 集合
      if (formIsActive && formRole === 'admin') {
        await setDoc(doc(db, 'admins', targetUid), {
          uid: targetUid,
          email: cleanEmail,
          role: 'admin',
          updatedAt: serverTimestamp(),
        });
      } else if (editingUser && editingUser.uid !== user?.uid) {
        await deleteDoc(doc(db, 'admins', targetUid)).catch(() => {});
      }

      setModalOpen(false);
      await fetchData();
      if (targetUid === user?.uid) {
        await refreshProfile();
      }
    } catch (err: any) {
      let msg = err?.message || '儲存失敗';
      if (err?.code === 'auth/email-already-in-use') {
        msg = '此 Email 已經在 Firebase Authentication 註冊過！請改選「綁定已註冊之 Firebase UID」或更換信箱。';
      }
      alert('儲存失敗：' + msg);
    } finally {
      setSavingUser(false);
    }
  };

  // --- Quick Toggle Active / Disabled ---
  const handleToggleUserActive = (u: SystemUser) => {
    if (u.uid === user?.uid) {
      alert('安全限制：您無法停用自己目前登入中的管理員帳號！');
      return;
    }
    const nextState = !u.isActive;
    requestAction(
      `確定要將「${u.displayName} (${u.email})」的帳號狀態變更為「${nextState ? '啟用（並標為已核可）' : '停用'}」嗎？`,
      async () => {
        try {
          await updateDoc(doc(db, 'system_users', u.uid), {
            isActive: nextState,
            ...(nextState ? { approvalStatus: 'approved' } : {}),
            updatedAt: serverTimestamp(),
          });
          if (!nextState) {
            await deleteDoc(doc(db, 'admins', u.uid)).catch(() => {});
          } else if (u.role === 'admin') {
            await setDoc(doc(db, 'admins', u.uid), {
              uid: u.uid,
              email: u.email,
              role: 'admin',
              updatedAt: serverTimestamp(),
            });
          }
          fetchData();
        } catch (err: any) {
          alert('狀態更新失敗：' + err.message);
        }
      },
      nextState ? '確認啟用' : '確認停用',
      nextState ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
    );
  };

  // --- Delete User Account Permissions ---
  const handleDeleteUser = (u: SystemUser) => {
    if (u.uid === user?.uid) {
      alert('安全限制：您無法刪除自己目前登入中的管理員帳號！');
      return;
    }
    requestAction(
      `確定要刪除「${u.displayName} (${u.email})」的系統登入與操作權限嗎？刪除後該帳號將無法存取任何後台與授權功能。`,
      async () => {
        try {
          await deleteDoc(doc(db, 'system_users', u.uid));
          await deleteDoc(doc(db, 'admins', u.uid)).catch(() => {});
          fetchData();
        } catch (err: any) {
          alert('刪除失敗：' + err.message);
        }
      },
      '確認刪除',
      'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
    );
  };

  // --- Send Password Reset Email ---
  const handleSendPasswordReset = (u: SystemUser) => {
    requestAction(
      `確定要寄送密碼重設信件至「${u.email}」嗎？`,
      async () => {
        try {
          await sendPasswordResetEmail(auth, u.email);
          alert(`已成功寄出密碼重設信至 ${u.email}！`);
        } catch (err: any) {
          alert('寄送失敗：' + err.message);
        }
      },
      '發送重設信'
    );
  };

  const pendingUsersCount = systemUsers.filter(u => u.approvalStatus === 'pending').length;

  const filteredUsers = systemUsers.filter(u => {
    if (roleFilter !== 'All' && u.role !== roleFilter) return false;
    if (statusFilter === 'pending' && u.approvalStatus !== 'pending') return false;
    if (statusFilter === 'active' && (!u.isActive || u.approvalStatus === 'pending')) return false;
    if (statusFilter === 'disabled' && u.isActive) return false;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      const matchName = u.displayName?.toLowerCase().includes(kw);
      const matchEmail = u.email?.toLowerCase().includes(kw);
      const matchUid = u.uid?.toLowerCase().includes(kw);
      const matchDept = u.departmentName?.toLowerCase().includes(kw);
      if (!matchName && !matchEmail && !matchUid && !matchDept) return false;
    }
    return true;
  });

  const filteredPersonnelForModal = formDeptId
    ? personnel.filter(p => p.departmentId === formDeptId)
    : [];

  return (
    <AdminGuard requiredPermission="canManageSystem" allowBootstrap>
      <main className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto">
        <ConfirmModal
          isOpen={confirmOpen}
          title="確認執行"
          message={confirmMessage}
          onConfirm={confirmAction}
          onCancel={() => setConfirmOpen(false)}
          confirmText={confirmBtnText}
          confirmColor={confirmBtnColor}
        />

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1"
        >
          <ArrowLeft className="w-4 h-4" /> 回首頁
        </Link>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-emerald-600 flex items-center gap-3">
              <ShieldCheck className="text-emerald-500 w-9 h-9" />
              系統管理
            </h1>
            <p className="text-gray-500 mt-2 ml-1">
              核可 Google 登入帳號、設定系統人員角色身分與各功能模組的操作權限 🔐
            </p>
          </div>

          {isBootstrapped !== false && (
            <div className="flex gap-3">
              <button
                onClick={fetchData}
                className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 px-4 py-3 rounded-full font-bold shadow-sm flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} /> 重新整理
              </button>
              <button
                onClick={openCreateModal}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-emerald-100 transition-transform hover:scale-105 flex items-center gap-2"
              >
                <UserPlus className="w-5 h-5" /> 新增登入人員與權限
              </button>
            </div>
          )}
        </header>

        {/* Pending Google Login Accounts Notification Banner */}
        {isBootstrapped !== false && pendingUsersCount > 0 && (
          <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-sm">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="font-black text-amber-900 text-lg">
                  有 {pendingUsersCount} 位使用 Google 帳號登入的使用者待您核可與設定權限
                </h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  當新使用者以 Google 帳號登入系統後，會自動帶入下方列表，請點擊「核可並設定權限」指派單位及模組權限。
                </p>
              </div>
            </div>
            <button
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'All' : 'pending')}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs whitespace-nowrap shadow-sm transition-colors"
            >
              {statusFilter === 'pending' ? '顯示全部人員' : `篩選待核可帳號 (${pendingUsersCount})`}
            </button>
          </div>
        )}

        {/* First-Time Super Admin Bootstrap Wizard */}
        {isBootstrapped === false && (
          <div className="bg-gradient-to-br from-emerald-50 to-sky-50 border-2 border-emerald-200 rounded-3xl p-8 mb-10 shadow-lg max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-md">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-800">首次系統初始化：建立最高管理員</h2>
                <p className="text-sm text-gray-600">
                  系統偵測到尚未設定任何管理員帳號。請在下方建立您的第一組最高權限管理員帳號！
                </p>
              </div>
            </div>

            <form onSubmit={handleBootstrapSubmit} className="space-y-4 mt-6 bg-white p-6 rounded-2xl border border-emerald-100">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">管理員顯示名稱</label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={bootName}
                  onChange={e => setBootName(e.target.value)}
                  placeholder="例如：系統管理員"
                  className="w-full rounded-xl border-2 border-emerald-100 px-4 py-2.5 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">管理員登入信箱 (Email)</label>
                <input
                  type="email"
                  required
                  value={bootEmail}
                  onChange={e => setBootEmail(e.target.value)}
                  placeholder="admin@yourcompany.com"
                  className="w-full rounded-xl border-2 border-emerald-100 px-4 py-2.5 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">設定登入密碼 (至少 6 碼)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={bootPassword}
                  onChange={e => setBootPassword(e.target.value)}
                  placeholder="請輸入至少 6 碼密碼"
                  className="w-full rounded-xl border-2 border-emerald-100 px-4 py-2.5 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <button
                type="submit"
                disabled={bootLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3.5 rounded-xl shadow-lg shadow-emerald-100 transition-all disabled:opacity-50"
              >
                {bootLoading ? '正在建立並啟用最高管理員權限...' : '立即啟用最高系統管理員 ✨'}
              </button>
            </form>
          </div>
        )}

        {/* Main System Users List & Filter Panel */}
        {isBootstrapped !== false && (
          <div className="bg-white/85 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-emerald-100">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center mb-6 pb-6 border-b-2 border-dashed border-emerald-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    placeholder="搜尋姓名、Email、單位..."
                    className="pl-10 pr-4 py-2 rounded-xl border-2 border-emerald-100 focus:outline-none focus:border-emerald-300 text-sm w-64"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value as any)}
                  className="rounded-xl border-2 border-emerald-100 px-3 py-2 text-sm focus:outline-none focus:border-emerald-300"
                >
                  <option value="All">全部角色</option>
                  <option value="admin">系統管理員</option>
                  <option value="manager">審核/管理人員</option>
                  <option value="staff">一般人員</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="rounded-xl border-2 border-emerald-100 px-3 py-2 text-sm focus:outline-none focus:border-emerald-300"
                >
                  <option value="All">全部狀態</option>
                  <option value="pending">待核可 (Google 登入)</option>
                  <option value="active">已核可啟用中</option>
                  <option value="disabled">已停用</option>
                </select>
              </div>

              <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm border border-emerald-100 self-start md:self-auto">
                符合條件：共 {filteredUsers.length} 位系統人員
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-emerald-100 text-emerald-800 text-sm">
                    <th className="py-3 pl-3">人員資訊 / 登入信箱</th>
                    <th className="py-3">綁定單位與人員</th>
                    <th className="py-3">系統角色</th>
                    <th className="py-3">核可與啟用狀態</th>
                    <th className="py-3">可操作模組權限</th>
                    <th className="py-3 text-right pr-3">管理操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const roleInfo = ROLE_LABELS[u.role] || ROLE_LABELS.staff;
                    const isSelf = u.uid === user?.uid;
                    const isPending = u.approvalStatus === 'pending';
                    const isGoogle = u.authProvider === 'google';
                    return (
                      <tr
                        key={u.uid}
                        className={`border-b border-gray-100 transition-colors ${
                          isPending
                            ? 'bg-amber-50/40 hover:bg-amber-50/70'
                            : !u.isActive
                            ? 'opacity-60 bg-gray-50/60'
                            : 'hover:bg-emerald-50/30'
                        }`}
                      >
                        <td className="py-4 pl-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-gray-800 text-base">{u.displayName}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">
                                本人
                              </span>
                            )}
                            {isGoogle ? (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                                <Globe className="w-3 h-3" /> Google 帳號
                              </span>
                            ) : (
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                                信箱密碼
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" /> {u.email}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">UID: {u.uid}</div>
                        </td>

                        <td className="py-4 text-sm">
                          {u.departmentName || u.personnelName ? (
                            <div>
                              <span className="font-bold text-gray-700">{u.departmentName || '未指定單位'}</span>
                              {u.personnelName && (
                                <span className="block text-xs text-sky-600 font-medium">
                                  人員：{u.personnelName}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">未綁定特定單位人員</span>
                          )}
                        </td>

                        <td className="py-4">
                          <span
                            className={`inline-block text-xs font-bold px-3 py-1 rounded-full border ${roleInfo.color}`}
                          >
                            {roleInfo.label}
                          </span>
                        </td>

                        <td className="py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                待管理員核可
                              </span>
                            )}
                            <button
                              onClick={() => handleToggleUserActive(u)}
                              disabled={isSelf}
                              title={isSelf ? '無法停用本人帳號' : '點擊切換啟用/停用'}
                              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
                                u.isActive
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                              } ${isSelf ? 'cursor-not-allowed opacity-80' : ''}`}
                            >
                              {u.isActive ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> 啟用中
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" /> 已停用
                                </>
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {PERMISSION_KEYS.map(k => {
                              const enabled = u.permissions?.[k];
                              const shortName = PERMISSION_LABELS[k].split(' ')[0];
                              return (
                                <span
                                  key={k}
                                  className={`text-[11px] px-2 py-0.5 rounded-md font-bold border ${
                                    enabled
                                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                                      : 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                                  }`}
                                >
                                  {shortName}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        <td className="py-4 text-right pr-3">
                          <div className="flex justify-end items-center gap-1.5 flex-wrap">
                            {isPending && (
                              <>
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1 transition-colors"
                                  title="核可此 Google 帳號並設定詳細權限"
                                >
                                  <UserCheck className="w-3.5 h-3.5" /> 核可並設定權限
                                </button>
                                <button
                                  onClick={() => handleQuickApprove(u)}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
                                  title="直接以目前權限核可"
                                >
                                  直接核可
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-2 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-100 transition-colors"
                              title="修改帳號與權限"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSendPasswordReset(u)}
                              className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"
                              title="寄送密碼重設信"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={isSelf}
                              className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isSelf ? '無法刪除本人帳號' : '刪除帳號權限'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400 font-bold">
                        目前沒有符合條件的系統人員資料。當有使用者透過 Google 帳號登入時，將會自動帶入此清單供您核可與設定權限。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create / Edit / Approve System User Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-sky-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border-2 border-emerald-100 my-8">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    {editingUser ? <Edit3 className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-800">
                      {editingUser
                        ? editingUser.approvalStatus === 'pending'
                          ? `核可 Google 帳號並設定權限 (${editingUser.displayName})`
                          : `修改人員權限 (${editingUser.displayName})`
                        : '新增系統登入人員與權限'}
                    </h2>
                    <p className="text-xs text-gray-500">
                      設定登入憑證、所屬部門人員綁定以及可存取的系統功能
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveUser} className="space-y-5">
                {!editingUser && (
                  <div className="flex bg-gray-100 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setCreateMode('new_auth')}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                        createMode === 'new_auth'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      直接建立新登入帳號 (Email + 密碼)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateMode('existing_uid')}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                        createMode === 'existing_uid'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      綁定已註冊之 Firebase UID
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">人員顯示名稱 *</label>
                    <input
                      type="text"
                      required
                      maxLength={50}
                      value={formDisplayName}
                      onChange={e => setFormDisplayName(e.target.value)}
                      placeholder="例如：王小明"
                      className="w-full rounded-xl border-2 border-sky-100 px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">登入電子郵件 (Email) *</label>
                    <input
                      type="email"
                      required
                      disabled={Boolean(editingUser)}
                      value={formEmail}
                      onChange={e => setFormEmail(e.target.value)}
                      placeholder="user@company.com"
                      className="w-full rounded-xl border-2 border-sky-100 px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {!editingUser && createMode === 'new_auth' && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        初始登入密碼 (至少 6 碼，建立後亦可發送重設密碼信) *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={formPassword}
                        onChange={e => setFormPassword(e.target.value)}
                        placeholder="請設定至少 6 碼初始密碼"
                        className="w-full rounded-xl border-2 border-sky-100 px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  )}

                  {!editingUser && createMode === 'existing_uid' && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Firebase Auth UID *
                      </label>
                      <input
                        type="text"
                        required
                        value={formUid}
                        onChange={e => setFormUid(e.target.value)}
                        placeholder="請貼上 Firebase Authentication 中的 User UID"
                        className="w-full rounded-xl border-2 border-sky-100 px-3.5 py-2 text-sm font-mono focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">綁定所屬單位 (選填)</label>
                    <select
                      value={formDeptId}
                      onChange={e => {
                        setFormDeptId(e.target.value);
                        setFormPersonId('');
                      }}
                      className="w-full rounded-xl border-2 border-sky-100 px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-400"
                    >
                      <option value="">-- 不綁定特定單位 --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">綁定對應人員 (選填)</label>
                    <select
                      value={formPersonId}
                      disabled={!formDeptId}
                      onChange={e => {
                        setFormPersonId(e.target.value);
                        const p = personnel.find(per => per.id === e.target.value);
                        if (p && !formDisplayName) {
                          setFormDisplayName(p.name);
                        }
                      }}
                      className="w-full rounded-xl border-2 border-sky-100 px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-400 disabled:opacity-50"
                    >
                      <option value="">-- 不綁定特定人員 --</option>
                      {filteredPersonnelForModal.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">系統角色範本 *</label>
                    <select
                      value={formRole}
                      onChange={e => handleRoleChange(e.target.value as SystemRole)}
                      className="w-full rounded-xl border-2 border-emerald-200 px-3.5 py-2 text-sm font-bold text-emerald-800 focus:outline-none focus:border-emerald-400 bg-emerald-50/40"
                    >
                      <option value="staff">一般人員 (預設僅申請用品)</option>
                      <option value="manager">審核/管理人員 (可審核、管庫存、看報表)</option>
                      <option value="admin">系統管理員 (擁有全系統完整權限)</option>
                    </select>
                  </div>

                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 w-full">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={e => setFormIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-bold text-gray-700">
                        啟用此帳號（取消勾選則立即停用登入權限）
                      </span>
                    </label>
                  </div>
                </div>

                {/* Granular Permissions Checkboxes */}
                <div className="bg-sky-50/60 border-2 border-sky-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-black text-sky-800 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-sky-600" />
                      細部功能模組操作權限設定
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormPermissions({ ...ROLE_DEFAULT_PERMISSIONS.admin })}
                        className="text-[11px] bg-white border border-sky-200 text-sky-600 px-2.5 py-0.5 rounded-lg font-bold hover:bg-sky-100"
                      >
                        全選
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormPermissions({ ...ROLE_DEFAULT_PERMISSIONS.staff })}
                        className="text-[11px] bg-white border border-gray-200 text-gray-600 px-2.5 py-0.5 rounded-lg font-bold hover:bg-gray-100"
                      >
                        僅限申請
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PERMISSION_KEYS.map(key => (
                      <label
                        key={key}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                          formPermissions[key]
                            ? 'bg-white border-sky-300 text-gray-800 shadow-sm'
                            : 'bg-white/50 border-gray-100 text-gray-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(formPermissions[key])}
                          onChange={() => handleTogglePermission(key)}
                          className="w-4 h-4 rounded text-sky-500 focus:ring-sky-400"
                        />
                        <span className="text-xs font-bold">{PERMISSION_LABELS[key]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={savingUser}
                    className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm shadow-lg shadow-emerald-100 transition-all disabled:opacity-50"
                  >
                    {savingUser
                      ? '儲存處理中...'
                      : editingUser
                      ? editingUser.approvalStatus === 'pending'
                        ? '核可並儲存權限 ✨'
                        : '儲存權限修改'
                      : '確認新增人員與權限'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AdminGuard>
  );
}
