"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Search, Filter } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Category, RequestRecord, ProcurementRecord, Department, Personnel, OfficeSupply } from '@/types';

export default function ReportPage() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  
  const [docType, setDocType] = useState<'requests' | 'procurements'>('requests');
  const [statusFilter, setStatusFilter] = useState('All');
  const [keyword, setKeyword] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('All');
  const [selectedPersonId, setSelectedPersonId] = useState('All');
  
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [procurements, setProcurements] = useState<ProcurementRecord[]>([]);
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchDeps = async () => {
      try {
        const [deptSnap, perSnap] = await Promise.all([
          getDocs(collection(db, 'departments')),
          getDocs(collection(db, 'personnel')),
        ]);
        setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
        setPersonnel(perSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel)));
      } catch (e) { console.error(e); }
    };
    fetchDeps();
  }, []);

  const generateReport = async () => {
    if (!startDate || !endDate) return alert("請選擇開始與結束日期！");
    setLoading(true);
    setPage(1);
    try {
      if (docType === 'requests') {
        const snap = await getDocs(collection(db, 'requests'));
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestRecord));
        data = data.filter(r => {
          const rDate = r.createdAt?.toDate ? r.createdAt.toDate().toISOString().split('T')[0] : '';
          return rDate >= startDate && rDate <= endDate;
        }).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setRequests(data);
      } else {
        const snap = await getDocs(collection(db, 'procurements'));
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcurementRecord));
        data = data.filter(p => p.date >= startDate && p.date <= endDate)
                   .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setProcurements(data);
      }
    } catch (error: any) {
      alert('產生報表失敗：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (selectedDeptId !== 'All' && r.departmentId !== selectedDeptId) return false;
    if (selectedPersonId !== 'All' && r.applicantId !== selectedPersonId) return false;
    if (keyword) {
      const matchKeyword = r.items.some(item => item.name.toLowerCase().includes(keyword.toLowerCase())) || r.id.toLowerCase().includes(keyword.toLowerCase());
      if (!matchKeyword) return false;
    }
    return true;
  });

  const filteredProcurements = procurements.filter(p => {
    if (statusFilter === 'restocked' && !p.isRestocked) return false;
    if (statusFilter === 'pending' && p.isRestocked) return false;
    if (keyword) {
      const matchKeyword = p.items.some(item => item.name.toLowerCase().includes(keyword.toLowerCase())) || p.id.toLowerCase().includes(keyword.toLowerCase());
      if (!matchKeyword) return false;
    }
    return true;
  });

  const displayData = docType === 'requests' ? filteredRequests : filteredProcurements;
  const totalPages = Math.ceil(displayData.length / itemsPerPage) || 1;
  const paginatedData = displayData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const filteredPersonnel = selectedDeptId === 'All' ? personnel : personnel.filter(p => p.departmentId === selectedDeptId);

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-6xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1">
        <ArrowLeft className="w-4 h-4" /> 回首頁
      </Link>
      
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-sky-500 flex items-center gap-3">
          <BarChart3 className="text-sky-400 w-8 h-8" />
          統計報表
        </h1>
        <p className="text-gray-500 mt-2 ml-1">進階查詢申請與採購紀錄 📊</p>
      </header>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-sky-100 mb-8">
        <h2 className="text-lg font-bold text-sky-700 mb-4 flex items-center gap-2 border-b-2 border-sky-50 pb-2"><Filter className="w-5 h-5"/> 查詢條件</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">單據類型</label>
            <select value={docType} onChange={e => {setDocType(e.target.value as any); setStatusFilter('All'); setRequests([]); setProcurements([]);}} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
              <option value="requests">用品申請單</option>
              <option value="procurements">物品採購單</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">單據狀態</label>
            {docType === 'requests' ? (
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                <option value="All">全部狀態</option>
                <option value="pending">未核可</option>
                <option value="approved">已核可</option>
                <option value="purchasing">採購中</option>
                <option value="pending-restock">待入庫</option>
                <option value="restocked">已入庫</option>
                <option value="completed">已領用(結案)</option>
              </select>
            ) : (
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                <option value="All">全部狀態</option>
                <option value="pending">待入庫</option>
                <option value="restocked">已入庫</option>
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end mb-6">
          {docType === 'requests' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申請單位</label>
                <select value={selectedDeptId} onChange={e => {setSelectedDeptId(e.target.value); setSelectedPersonId('All');}} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                  <option value="All">全部單位</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申請人員</label>
                <select value={selectedPersonId} onChange={e => setSelectedPersonId(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                  <option value="All">全部人員</option>
                  {filteredPersonnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="lg:col-span-2">
             <label className="block text-sm font-medium text-gray-700 mb-1">關鍵字搜尋 (單號、物品名稱)</label>
             <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="輸入關鍵字..." className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
          </div>
        </div>

        <button onClick={generateReport} className="w-full bg-sky-500 hover:bg-sky-600 text-white px-4 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] shadow-md shadow-sky-200">
          <Search className="w-5 h-5" /> 產生報表
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-sky-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">查詢結果清單</h2>
          <div className="bg-sky-100 text-sky-700 px-4 py-1.5 rounded-lg font-bold text-sm">
            查詢條件總計：{displayData.length} 筆
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-sky-400 font-bold">載入中...</div>
        ) : displayData.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">沒有符合條件的紀錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-sky-100 text-sky-700">
                  <th className="pb-3 pl-2 w-16">序號</th>
                  <th className="pb-3">單據編號</th>
                  <th className="pb-3">日期</th>
                  {docType === 'requests' ? (
                    <>
                      <th className="pb-3">單位 / 人員</th>
                      <th className="pb-3">申請物品 (數量)</th>
                    </>
                  ) : (
                    <>
                      <th className="pb-3">採買地點</th>
                      <th className="pb-3">採買物品 (數量)</th>
                      <th className="pb-3">總金額</th>
                    </>
                  )}
                  <th className="pb-3">狀態</th>
                </tr>
              </thead>
              <tbody>
                {docType === 'requests' ? (
                  (paginatedData as RequestRecord[]).map((req, i) => (
                    <tr key={req.id} className="border-b border-gray-100 hover:bg-sky-50/50">
                      <td className="py-4 pl-2 text-gray-500 font-medium">{(page - 1) * itemsPerPage + i + 1}</td>
                      <td className="py-4 font-bold text-gray-800">{req.id}</td>
                      <td className="py-4 text-gray-600">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A'}</td>
                      <td className="py-4 text-gray-800 font-medium">{req.departmentName} <br/><span className="text-xs text-gray-500">{req.applicantName}</span></td>
                      <td className="py-4">
                        <ul className="space-y-1">
                          {req.items.map((item, idx) => (
                            <li key={idx} className="text-sm">
                              <span className="text-gray-700">{item.name}</span> <span className="text-sky-500 font-bold">x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-4">
                        {req.status === 'completed' ? <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold">已結案</span> :
                         req.status === 'restocked' ? <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold">已入庫</span> :
                         req.status === 'pending-restock' ? <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-lg text-xs font-bold">待入庫</span> :
                         req.status === 'purchasing' ? <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-xs font-bold">採購中</span> :
                         req.status === 'approved' ? <span className="bg-green-100 text-green-600 px-2 py-1 rounded-lg text-xs font-bold">已核可</span> :
                         <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-lg text-xs font-bold">未核可</span>}
                      </td>
                    </tr>
                  ))
                ) : (
                  (paginatedData as ProcurementRecord[]).map((proc, i) => (
                    <tr key={proc.id} className="border-b border-gray-100 hover:bg-sky-50/50">
                      <td className="py-4 pl-2 text-gray-500 font-medium">{(page - 1) * itemsPerPage + i + 1}</td>
                      <td className="py-4 font-bold text-gray-800">{proc.id}</td>
                      <td className="py-4 text-gray-600">{proc.date}</td>
                      <td className="py-4 font-bold text-gray-800">{proc.location}</td>
                      <td className="py-4">
                        <ul className="space-y-1">
                          {proc.items.map((item, idx) => (
                            <li key={idx} className="text-sm">
                              <span className="text-gray-700">{item.name}</span> <span className="text-orange-500 font-bold">x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-4 font-extrabold text-orange-500">${proc.totalAmount}</td>
                      <td className="py-4">
                        {proc.isRestocked ? <span className="bg-green-100 text-green-600 px-2 py-1 rounded-lg text-xs font-bold">已入庫 ({proc.restockDate})</span> :
                         <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-lg text-xs font-bold">待入庫</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8 pt-6 border-t-2 border-dashed border-sky-100">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50 font-bold">上一頁</button>
            <span className="text-gray-600 font-bold">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50 font-bold">下一頁</button>
          </div>
        )}
      </div>
    </main>
  );
}