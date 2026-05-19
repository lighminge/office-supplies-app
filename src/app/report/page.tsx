"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Search } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { CATEGORIES } from '@/types';

interface RequestItem {
  id: string;
  name: string;
  quantity: number;
}

interface RequestRecord {
  id: string;
  department: string;
  applicant: string;
  items: RequestItem[];
  createdAt: any;
}

export default function ReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [records, setRecords] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [suppliesMap, setSuppliesMap] = useState<Record<string, string>>({}); // id -> category

  useEffect(() => {
    // Fetch supplies to know their categories
    const fetchSupplies = async () => {
      try {
        const snap = await getDocs(collection(db, 'supplies'));
        const map: Record<string, string> = {};
        snap.forEach(doc => {
          map[doc.id] = doc.data().category;
        });
        setSuppliesMap(map);
      } catch (error) {
        console.error("Error fetching supplies map", error);
      }
    };
    fetchSupplies();
  }, []);

  const generateReport = async () => {
    if (!startDate || !endDate) {
      alert("請選擇開始與結束日期！");
      return;
    }
    setLoading(true);
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'requests'),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RequestRecord[];
      
      setRecords(data);
    } catch (error: any) {
      alert('產生報表失敗：' + error.message + '\n\n(提示：這可能是因為 Firestore 的索引需要建立，或是規則未開放)');
    } finally {
      setLoading(false);
    }
  };

  // Process data for display
  const filteredRecords = records.filter(record => {
    if (selectedCategory === 'All') return true;
    // Keep record if it contains ANY item from the selected category
    return record.items.some(item => suppliesMap[item.id] === selectedCategory);
  });

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1">
        <ArrowLeft className="w-4 h-4" /> 回首頁
      </Link>
      
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-sky-500 flex items-center gap-3">
          <BarChart3 className="text-sky-400 w-8 h-8" />
          統計報表
        </h1>
        <p className="text-gray-500 mt-2 ml-1">查詢用品申請紀錄與統計 📊</p>
      </header>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-sm border-2 border-sky-100 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
            <input 
              type="date" 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
            <input 
              type="date" 
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">物品類別</label>
            <select 
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300"
            >
              <option value="All">全部類別</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <button 
            onClick={generateReport}
            className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 h-[44px]"
          >
            <Search className="w-4 h-4" /> 查詢
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-sky-100">
        <h2 className="text-xl font-bold text-gray-800 mb-6">申請紀錄</h2>
        {loading ? (
          <div className="text-center py-10 text-sky-400">載入中...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-10 text-gray-400">沒有符合條件的紀錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-sky-100 text-sky-700">
                  <th className="pb-3 pl-2">申請日期</th>
                  <th className="pb-3">申請單位</th>
                  <th className="pb-3">申請人員</th>
                  <th className="pb-3">申請物品 (數量)</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(record => (
                  <tr key={record.id} className="border-b border-gray-100 hover:bg-sky-50/50">
                    <td className="py-4 pl-2 text-gray-600">
                      {record.createdAt?.toDate ? record.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A'}
                    </td>
                    <td className="py-4 text-gray-800 font-medium">{record.department}</td>
                    <td className="py-4 text-gray-800">{record.applicant}</td>
                    <td className="py-4">
                      <ul className="space-y-1">
                        {record.items.map((item, idx) => {
                          const cat = suppliesMap[item.id];
                          if (selectedCategory !== 'All' && cat !== selectedCategory) return null;
                          return (
                            <li key={idx} className="text-sm">
                              <span className="text-gray-700">{item.name}</span>
                              <span className="text-sky-500 ml-2 font-bold">x{item.quantity}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
