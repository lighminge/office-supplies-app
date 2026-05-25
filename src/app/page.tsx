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
  CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function Home() {
  const [stats, setStats] = useState({
    lowStock: 0,
    pendingReq: 0,
    purchasingReq: 0,
    totalSupplies: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [supSnap, reqSnap] = await Promise.all([
          getDocs(collection(db, 'supplies')),
          getDocs(collection(db, 'requests'))
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
  }, []);

  const features = [
    { href: "/request", title: "用品申請", desc: "選取單位與人員快速申請", icon: ClipboardList, color: "sky" },
    { href: "/workflow", title: "單據流程", desc: "核可與領用進度追蹤", icon: LayoutList, color: "indigo" },
    { href: "/management", title: "用品管理", desc: "庫存、類別與插圖維護", icon: Package, color: "blue" },
    { href: "/report", title: "統計報表", desc: "視覺化數據與紀錄導出", icon: BarChart3, color: "violet" },
    { href: "/organization", title: "單位人員", desc: "組織架構與成員管理", icon: Users, color: "cyan" },
  ];

  return (
    <main className="min-h-screen p-6 md:p-12 overflow-x-hidden">
      {/* 頂部 Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6"
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

        {/* 快速統計摘要 */}
        <div className="flex flex-wrap gap-3">
          <div className="bg-white/50 backdrop-blur-sm border border-white px-4 py-2 rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span className="text-sm font-bold text-gray-700">{stats.lowStock} 項庫存告急</span>
          </div>
          <div className="bg-white/50 backdrop-blur-sm border border-white px-4 py-2 rounded-2xl flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-bold text-gray-700">{stats.pendingReq} 筆待核可單據</span>
          </div>
        </div>
      </motion.div>

      {/* 主儀表板區域 */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左側：功能卡片網格 (佔 8 欄) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.href}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link 
                href={f.href} 
                className="group relative block p-8 glass-panel hover:bg-white hover:border-sky-300 transition-all hover:shadow-2xl hover:shadow-sky-100 hover:-translate-y-2 overflow-hidden h-full"
              >
                {/* 背景裝飾圖案 */}
                <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:scale-125 group-hover:opacity-10 transition-all text-${f.color}-500`}>
                  <f.icon size={160} />
                </div>

                <div className={`w-14 h-14 bg-${f.color}-100 text-${f.color}-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <f.icon size={28} />
                </div>
                
                <h3 className="text-2xl font-black text-gray-800 mb-2 flex items-center gap-2">
                  {f.title}
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:translate-x-1 group-hover:text-sky-500 transition-all" />
                </h3>
                <p className="text-gray-500 leading-relaxed font-medium">{f.desc}</p>
              </Link>
            </motion.div>
          ))}
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

          <div className="glass-panel p-8 bg-sky-600 text-white relative overflow-hidden group">
             <div className="relative z-10">
               <h3 className="text-xl font-bold mb-2">需要幫忙嗎？</h3>
               <p className="text-sky-100 text-sm mb-4">如果您在使用上有任何問題，可以聯繫系統管理員。</p>
               <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-xs font-bold transition-colors">查看幫助手冊</button>
             </div>
             <Sparkles className="absolute right-[-10px] top-[-10px] w-32 h-32 opacity-10 rotate-12 group-hover:scale-110 transition-transform" />
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
