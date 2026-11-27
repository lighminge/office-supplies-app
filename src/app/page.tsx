"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ClipboardList, 
  Package, 
  BarChart3, 
  Users, 
  Sparkles, 
  LayoutList, 
  ChevronRight, 
  AlertCircle,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { UserPermissions } from '@/types';

export default function Home() {
  const { user, loading, isAdmin, hasPermission, isBootstrapped } = useAuth();
  const [hideUnauthorized, setHideUnauthorized] = useState(false);
  const [stats, setStats] = useState({
    lowStock: 0,
    pendingReq: 0,
    purchasingReq: 0,
    totalSupplies: 0
  });

  useEffect(() => {
    if (loading || !user) return;
    const fetchStats = async () => {
      try {
        const canSeeAllRequests =
          isAdmin ||
          hasPermission('canWorkflow') ||
          hasPermission('canManageSupplies') ||
          hasPermission('canViewReports');
        const reqQuery = canSeeAllRequests
          ? collection(db, 'requests')
          : query(collection(db, 'requests'), where('ownerUid', '==', user.uid));

        const [supSnap, reqSnap] = await Promise.all([
          getDocs(collection(db, 'supplies')),
          getDocs(reqQuery)
        ]);
        
        const supplies = supSnap.docs.map(doc => doc.data());
        const requests = reqSnap.docs.map(doc => doc.data());
        
        setStats({
          lowStock: supplies.filter(s => s.quantity <= s.minQuantity).length,
          pendingReq: requests.filter(r => r.status === 'pending').length,
          purchasingReq: requests.filter(r => r.status === 'purchasing').length,
          totalSupplies: supplies.length
        });
      } catch (e) {
        console.error("Fetch stats error:", e);
      }
    };
    fetchStats();
  }, [loading, user, isAdmin, hasPermission]);

  const features: {
    href: string;
    title: string;
    desc: string;
    icon: any;
    permission: keyof UserPermissions;
    iconBg: string;
    iconText: string;
  }[] = [
    {
      href: "/request",
      title: "用品申請",
      desc: "選取單位與人員快速申請",
      icon: ClipboardList,
      permission: "canRequest",
      iconBg: "bg-sky-100",
      iconText: "text-sky-500",
    },
    {
      href: "/workflow",
      title: "單據流程",
      desc: "核可與領用進度追蹤",
      icon: LayoutList,
      permission: "canWorkflow",
      iconBg: "bg-indigo-100",
      iconText: "text-indigo-500",
    },
    {
      href: "/management",
      title: "用品管理",
      desc: "庫存、類別與插圖維護",
      icon: Package,
      permission: "canManageSupplies",
      iconBg: "bg-blue-100",
      iconText: "text-blue-500",
    },
    {
      href: "/report",
      title: "統計報表",
      desc: "視覺化數據與紀錄導出",
      icon: BarChart3,
      permission: "canViewReports",
      iconBg: "bg-violet-100",
      iconText: "text-violet-500",
    },
    {
      href: "/organization",
      title: "單位人員",
      desc: "組織架構與成員管理",
      icon: Users,
      permission: "canManageOrg",
      iconBg: "bg-cyan-100",
      iconText: "text-cyan-500",
    },
    {
      href: "/system",
      title: "系統管理",
      desc: "登入帳號與操作權限設定",
      icon: ShieldCheck,
      permission: "canManageSystem",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-600",
    },
  ];

  const isFeatureAllowed = (f: (typeof features)[number]) => {
    if (f.href === "/system" && isBootstrapped === false) return true;
    return hasPermission(f.permission);
  };

  const displayedFeatures = hideUnauthorized
    ? features.filter(f => isFeatureAllowed(f))
    : features;

  const allowedCount = features.filter(f => isFeatureAllowed(f)).length;

  return (
    <main className="min-h-screen p-6 md:p-12 overflow-x-hidden">
      {/* 頂部 Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-sky-500 p-2 rounded-2xl shadow-lg shadow-sky-200">
              <Sparkles className="text-white w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-sky-600 font-bold tracking-widest text-sm uppercase">Office Supplies System</h2>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-800 tracking-tight">
            辦公室用具管理 <span className="text-sky-500">小幫手</span>
          </h1>
          <p className="text-gray-500 mt-4 text-lg">讓您的工作環境更有序、更有溫度 💙</p>
        </div>

        {/* 快速統計摘要與權限顯示切換 */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setHideUnauthorized(prev => !prev)}
            className={`px-4 py-2 rounded-2xl text-xs font-black border-2 transition-all flex items-center gap-1.5 shadow-sm ${
              hideUnauthorized
                ? 'bg-sky-500 text-white border-sky-500'
                : 'bg-white/80 text-gray-700 border-sky-200 hover:border-sky-400'
            }`}
          >
            {hideUnauthorized ? (
              <>
                <Eye className="w-4 h-4" /> 顯示全部功能（含無權限標示）
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-sky-500" /> 僅顯示可使用功能 ({allowedCount}/{features.length})
              </>
            )}
          </button>

          {/* 庫存告急按鈕：需具備用品管理 (canManageSupplies) 權限才可點擊跳轉 */}
          {hasPermission('canManageSupplies') ? (
            <Link
              href="/management?lowStock=1"
              title="點擊前往「用品管理」查看庫存告急物品"
              className="bg-white/90 hover:bg-rose-500 group backdrop-blur-sm border-2 border-rose-200 hover:border-rose-500 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm hover:shadow-md hover:shadow-rose-100 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 group-hover:text-white transition-colors" />
              <span className="text-sm font-black text-gray-700 group-hover:text-white transition-colors">
                {stats.lowStock} 項庫存告急
              </span>
              <ChevronRight className="w-4 h-4 text-rose-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="需具備「用品與採購管理」權限才可點擊前往"
              className="bg-gray-100/80 border-2 border-gray-200 px-4 py-2 rounded-2xl flex items-center gap-2 opacity-70 cursor-not-allowed select-none"
            >
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-bold text-gray-500">{stats.lowStock} 項庫存告急</span>
              <Lock className="w-3.5 h-3.5 text-rose-400" />
            </button>
          )}

          {/* 待核可單據按鈕：需具備單據審核 (canWorkflow) 權限才可點擊跳轉 */}
          {hasPermission('canWorkflow') ? (
            <Link
              href="/workflow"
              title="點擊前往「單據流程」審核待核可單據"
              className="bg-white/90 hover:bg-orange-500 group backdrop-blur-sm border-2 border-orange-200 hover:border-orange-500 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm hover:shadow-md hover:shadow-orange-100 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Clock className="w-4 h-4 text-orange-500 group-hover:text-white transition-colors" />
              <span className="text-sm font-black text-gray-700 group-hover:text-white transition-colors">
                {stats.pendingReq} 筆待核可單據
              </span>
              <ChevronRight className="w-4 h-4 text-orange-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="需具備「單據審核與領用」權限才可點擊前往"
              className="bg-gray-100/80 border-2 border-gray-200 px-4 py-2 rounded-2xl flex items-center gap-2 opacity-70 cursor-not-allowed select-none"
            >
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-bold text-gray-500">{stats.pendingReq} 筆待核可單據</span>
              <Lock className="w-3.5 h-3.5 text-rose-400" />
            </button>
          )}
        </div>
      </motion.div>

      {/* 主儀表板區域 */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左側：功能卡片網格 (佔 8 欄) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayedFeatures.map((f, i) => {
            const allowed = isFeatureAllowed(f);
            return (
              <motion.div
                key={f.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                {allowed ? (
                  <Link 
                    href={f.href} 
                    className="group relative block p-8 glass-panel bg-white/85 border-2 border-sky-100 hover:bg-white hover:border-sky-400 transition-all hover:shadow-2xl hover:shadow-sky-100 hover:-translate-y-2 overflow-hidden h-full"
                  >
                    {/* 右上角可使用狀態標章 */}
                    <div className="absolute top-5 right-5 z-10">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 可使用
                      </span>
                    </div>

                    {/* 背景裝飾圖案 */}
                    <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:scale-125 group-hover:opacity-10 transition-all ${f.iconText}`}>
                      <f.icon size={160} />
                    </div>

                    <div className={`w-14 h-14 ${f.iconBg} ${f.iconText} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm`}>
                      <f.icon size={28} />
                    </div>
                    
                    <h3 className="text-2xl font-black text-gray-800 mb-2 flex items-center gap-2">
                      {f.title}
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:translate-x-1 group-hover:text-sky-500 transition-all" />
                    </h3>
                    <p className="text-gray-500 leading-relaxed font-medium">{f.desc}</p>
                  </Link>
                ) : (
                  <div
                    aria-disabled="true"
                    className="relative block p-8 rounded-[2rem] bg-rose-50/70 border-2 border-rose-300/80 shadow-sm overflow-hidden h-full cursor-not-allowed select-none"
                  >
                    {/* 右上角明顯的無權限標籤 */}
                    <div className="absolute top-5 right-5 z-10">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-md shadow-rose-200">
                        <Lock className="w-3.5 h-3.5" /> 無權限
                      </span>
                    </div>

                    {/* 背景裝飾圖案 */}
                    <div className="absolute -right-4 -bottom-4 opacity-5 text-rose-400">
                      <f.icon size={160} />
                    </div>

                    <div className="w-14 h-14 bg-rose-100 text-rose-400 rounded-2xl flex items-center justify-center mb-6">
                      <f.icon size={28} />
                    </div>
                    
                    <h3 className="text-2xl font-black text-gray-500 mb-2 flex items-center gap-2">
                      {f.title}
                      <Lock className="w-4 h-4 text-rose-500" />
                    </h3>
                    <p className="text-gray-400 leading-relaxed font-medium mb-4">{f.desc}</p>

                    <div className="mt-auto inline-flex items-center gap-1.5 bg-rose-100/90 border border-rose-300 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-black">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>目前登入帳號無此功能權限</span>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* 右側：狀態看板 (佔 4 欄) */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-4 space-y-6"
        >
          <div className="glass-panel p-8">
            <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
              <BarChart3 className="text-sky-500" size={20} />
              目前系統概況
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-sky-50 rounded-2xl border border-sky-100">
                <div className="flex items-center gap-3">
                  <Package className="text-sky-500" size={20} />
                  <span className="font-bold text-gray-700">總物品種類</span>
                </div>
                <span className="text-2xl font-black text-sky-600">{stats.totalSupplies}</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-rose-50 rounded-2xl border border-rose-100">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-rose-500" size={20} />
                  <span className="font-bold text-gray-700">庫存預警</span>
                </div>
                <span className="text-2xl font-black text-rose-600">{stats.lowStock}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <div className="flex items-center gap-3">
                  <Clock className="text-orange-500" size={20} />
                  <span className="font-bold text-gray-700">採購進行中</span>
                </div>
                <span className="text-2xl font-black text-orange-600">{stats.purchasingReq}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl border border-green-100">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-green-500" size={20} />
                  <span className="font-bold text-gray-700">待核可單據</span>
                </div>
                <span className="text-2xl font-black text-green-600">{stats.pendingReq}</span>
              </div>
            </div>

            <button className="w-full mt-8 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl font-black shadow-lg shadow-sky-100 transition-all hover:scale-105 active:scale-95">
              快速系統檢查 🔍
            </button>
          </div>
        </motion.div>
      </div>

      {/* 底部裝飾 */}
      <footer className="max-w-7xl mx-auto mt-20 pb-8 text-center border-t border-sky-100 pt-8">
        <p className="text-gray-400 text-sm font-medium">© 2026 可愛風辦公室用品管理系統 · Made with 💙</p>
      </footer>
    </main>
  );
}
