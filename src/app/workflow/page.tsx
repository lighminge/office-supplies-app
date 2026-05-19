"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, CheckCircle, Clock, Trash2, ShoppingCart, RotateCcw, Package, CheckSquare } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { RequestRecord, Department, Personnel } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';

export default function WorkflowPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);

  // Pagination states
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const itemsPerPage = 10;

  // Selected for bulk actions
  const [selectedPending, setSelectedPending] = useState<string[]>([]);
  const [selectedApproved, setSelectedApproved] = useState<string[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmBtnText, setConfirmBtnText] = useState('確定刪除');
  const [confirmBtnColor, setConfirmBtnColor] = useState('bg-red-400 hover:bg-red-500 shadow-red-200');

  const fetchData = async () => {
    try {
      const [reqSnap, deptSnap, perSnap] = await Promise.all([
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'departments')),
        getDocs(collection(db, 'personnel'))
      ]);
      const rawReq = reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestRecord));
      setRequests(rawReq.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
      setPersonnel(perSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel)));
    } catch (error) {
      console.error('Error fetching workflow data', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const requestAction = (msg: string, action: () => Promise<void>, btnText = '確定刪除', btnColor = 'bg-red-400 hover:bg-red-500 shadow-red-200') => {
    setConfirmMessage(msg);
    setConfirmAction(() => action);
    setConfirmBtnText(btnText);
    setConfirmBtnColor(btnColor);
    setConfirmOpen(true);
  };

  const updateRequestStatus = async (id: string, status: RequestRecord['status']) => {
    try {
      await updateDoc(doc(db, 'requests', id), { status });
      fetchData();
    } catch (e: any) { alert('更新失敗：' + e.message); }
  };

  // --- Pending Actions ---
  const handleApprove = (id: string) => requestAction('確定要核可這筆申請單嗎？', async () => {
    await updateRequestStatus(id, 'approved');
  }, '確認核可', 'bg-sky-500 hover:bg-sky-600 shadow-sky-200');

  const handleBulkApprove = () => {
    if (selectedPending.length === 0) return alert('請先勾選要核可的申請單！');
    requestAction(`確定要一次核可這 ${selectedPending.length} 筆申請單嗎？`, async () => {
      try {
        await Promise.all(selectedPending.map(id => updateDoc(doc(db, 'requests', id), { status: 'approved' })));
        setSelectedPending([]);
        fetchData();
      } catch (e: any) { alert('批次核可失敗：' + e.message); }
    }, '確認批次核可', 'bg-sky-500 hover:bg-sky-600 shadow-sky-200');
  };

  // --- Approved Actions ---
  const handleConvertToProcurement = (id: string) => requestAction('確定將此申請單轉為採購單嗎？狀態將變更為「採購中」。', async () => {
    await updateRequestStatus(id, 'purchasing');
  }, '確認', 'bg-orange-500 hover:bg-orange-600 shadow-orange-200');

  const handleBulkConvertToProcurement = () => {
    if (selectedApproved.length === 0) return alert('請先勾選申請單！');
    requestAction(`確定將這 ${selectedApproved.length} 筆申請單全部轉為採購單嗎？`, async () => {
      try {
        await Promise.all(selectedApproved.map(id => updateDoc(doc(db, 'requests', id), { status: 'purchasing' })));
        setSelectedApproved([]);
        fetchData();
      } catch (e: any) { alert('批次轉換失敗：' + e.message); }
    }, '確認', 'bg-orange-500 hover:bg-orange-600 shadow-orange-200');
  };

  const handleRevert = (id: string) => requestAction('確定將此申請單退回至「未核可」狀態嗎？', async () => {
    await updateRequestStatus(id, 'pending');
  }, '確認', 'bg-sky-500 hover:bg-sky-600 shadow-sky-200');

  const handleDelete = (id: string) => requestAction('確定要取消(刪除)這筆申請單嗎？此操作無法還原。', async () => {
    try {
      await deleteDoc(doc(db, 'requests', id));
      fetchData();
    } catch (e: any) { alert('刪除失敗：' + e.message); }
  });

  const confirmReceiveLogic = async (id: string) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    for (const item of req.items) {
      const supplyRef = doc(db, 'supplies', item.supplyId);
      const supplyDoc = await getDoc(supplyRef);
      if (supplyDoc.exists()) {
        const currentQty = supplyDoc.data().quantity || 0;
        const newQty = Math.max(0, currentQty - item.quantity); // 避免負數
        await updateDoc(supplyRef, { quantity: newQty });
      }
    }
    await updateDoc(doc(db, 'requests', id), { status: 'completed' });
  };

  const handleConfirmReceive = (id: string) => requestAction('確認領用後，將自動扣除對應物品的庫存數量，並將狀態標為「已完成」，確定執行嗎？', async () => {
    try {
      await confirmReceiveLogic(id);
      alert('領用成功！已扣除庫存。');
      fetchData();
    } catch (e: any) { alert('處理失敗：' + e.message); }
  }, '確認領用', 'bg-sky-500 hover:bg-sky-600 shadow-sky-200');

  const handleBulkConfirmReceive = () => {
    if (selectedApproved.length === 0) return alert('請先勾選申請單！');
    requestAction(`確認領用後，將自動扣除這 ${selectedApproved.length} 筆申請單對應物品的庫存數量，確定執行嗎？`, async () => {
      try {
        await Promise.all(selectedApproved.map(id => confirmReceiveLogic(id)));
        setSelectedApproved([]);
        alert('批次領用成功！已扣除庫存。');
        fetchData();
      } catch (e: any) { alert('批次處理失敗：' + e.message); }
    }, '確認批次領用', 'bg-sky-500 hover:bg-sky-600 shadow-sky-200');
  };

  const pendingRequests = requests.filter(r => !r.status || r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved' || r.status === 'purchasing');

  const paginatedPending = pendingRequests.slice((pendingPage - 1) * itemsPerPage, pendingPage * itemsPerPage);
  const paginatedApproved = approvedRequests.slice((approvedPage - 1) * itemsPerPage, approvedPage * itemsPerPage);

  const totalPendingPages = Math.ceil(pendingRequests.length / itemsPerPage) || 1;
  const totalApprovedPages = Math.ceil(approvedRequests.length / itemsPerPage) || 1;

  return (
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

      <Link href="/" className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1">
        <ArrowLeft className="w-4 h-4" /> 回首頁
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-sky-500 flex items-center gap-3">
          <ClipboardList className="text-sky-400 w-8 h-8" />
          單據流程
        </h1>
        <p className="text-gray-500 mt-2 ml-1">審核與追蹤辦公室用品申請進度 📑</p>
      </header>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('pending')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'pending' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}>
          <Clock className="w-5 h-5" /> 申請資料 ({pendingRequests.length})
        </button>
        <button onClick={() => setActiveTab('approved')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'approved' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}>
          <CheckCircle className="w-5 h-5" /> 核可資料 ({approvedRequests.length})
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-sky-100">
        
        {activeTab === 'pending' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                待核可的申請資料 (總共 {pendingRequests.length} 筆)
              </h2>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedPending(pendingRequests.map(r => r.id))} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl">全選</button>
                <button onClick={() => setSelectedPending([])} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl">全取消</button>
                <button onClick={handleBulkApprove} disabled={selectedPending.length === 0} className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" /> 批次核可 ({selectedPending.length})
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-sky-100 text-sky-700">
                    <th className="pb-3 pl-2 w-10">
                      <input 
                        type="checkbox" 
                        onChange={e => {
                          if (e.target.checked) setSelectedPending(paginatedPending.map(r => r.id));
                          else setSelectedPending(selectedPending.filter(id => !paginatedPending.find(r => r.id === id)));
                        }}
                        checked={paginatedPending.length > 0 && paginatedPending.every(r => selectedPending.includes(r.id))}
                        className="w-5 h-5 rounded border-sky-300 text-sky-500 focus:ring-sky-200"
                      />
                    </th>
                    <th className="pb-3">申請日期</th>
                    <th className="pb-3">申請單位</th>
                    <th className="pb-3">申請人員</th>
                    <th className="pb-3">申請物品</th>
                    <th className="pb-3 text-right pr-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPending.map(req => (
                    <tr key={req.id} className="border-b border-gray-100 hover:bg-sky-50/50">
                      <td className="py-4 pl-2">
                        <input 
                          type="checkbox"
                          checked={selectedPending.includes(req.id)}
                          onChange={e => {
                            if(e.target.checked) setSelectedPending([...selectedPending, req.id]);
                            else setSelectedPending(selectedPending.filter(id => id !== req.id));
                          }}
                          className="w-5 h-5 rounded border-sky-300 text-sky-500 focus:ring-sky-200"
                        />
                      </td>
                      <td className="py-4 text-gray-600">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A'}</td>
                      <td className="py-4 font-bold text-gray-800">{req.departmentName}</td>
                      <td className="py-4 text-gray-800">{req.applicantName}</td>
                      <td className="py-4">
                        <ul className="space-y-1">
                          {req.items.map((item, idx) => (
                            <li key={idx} className="text-sm">
                              <span className="text-gray-700">{item.name}</span>
                              <span className="text-sky-500 ml-2 font-bold">x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-4 text-right pr-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleApprove(req.id)} className="bg-sky-400 hover:bg-sky-500 text-white px-4 py-2 rounded-xl font-bold text-sm">
                            核可申請單
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedPending.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">目前沒有待核可的資料</td></tr>}
                </tbody>
              </table>
            </div>
            {totalPendingPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button disabled={pendingPage === 1} onClick={() => setPendingPage(p => p - 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50">上一頁</button>
                <span className="text-gray-600 font-bold">{pendingPage} / {totalPendingPages}</span>
                <button disabled={pendingPage === totalPendingPages} onClick={() => setPendingPage(p => p + 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50">下一頁</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'approved' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                已核可的申請資料 (總共 {approvedRequests.length} 筆)
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => setSelectedApproved(approvedRequests.map(r => r.id))} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl">全選</button>
                <button onClick={() => setSelectedApproved([])} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl">全取消</button>
                <button onClick={handleBulkConvertToProcurement} disabled={selectedApproved.length === 0} className="px-4 py-2 text-sm bg-orange-400 hover:bg-orange-500 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> 批次轉採購單
                </button>
                <button onClick={handleBulkConfirmReceive} disabled={selectedApproved.length === 0} className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-2">
                  <Package className="w-4 h-4" /> 批次確認領用
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-sky-100 text-sky-700">
                    <th className="pb-3 pl-2 w-10">
                      <input 
                        type="checkbox" 
                        onChange={e => {
                          if (e.target.checked) setSelectedApproved(paginatedApproved.map(r => r.id));
                          else setSelectedApproved(selectedApproved.filter(id => !paginatedApproved.find(r => r.id === id)));
                        }}
                        checked={paginatedApproved.length > 0 && paginatedApproved.every(r => selectedApproved.includes(r.id))}
                        className="w-5 h-5 rounded border-sky-300 text-sky-500 focus:ring-sky-200"
                      />
                    </th>
                    <th className="pb-3">申請日期</th>
                    <th className="pb-3">申請單位</th>
                    <th className="pb-3">申請人員</th>
                    <th className="pb-3">申請物品</th>
                    <th className="pb-3">狀態</th>
                    <th className="pb-3 text-right pr-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedApproved.map(req => (
                    <tr key={req.id} className="border-b border-gray-100 hover:bg-sky-50/50">
                      <td className="py-4 pl-2">
                        <input 
                          type="checkbox"
                          checked={selectedApproved.includes(req.id)}
                          onChange={e => {
                            if(e.target.checked) setSelectedApproved([...selectedApproved, req.id]);
                            else setSelectedApproved(selectedApproved.filter(id => id !== req.id));
                          }}
                          className="w-5 h-5 rounded border-sky-300 text-sky-500 focus:ring-sky-200"
                        />
                      </td>
                      <td className="py-4 text-gray-600">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A'}</td>
                      <td className="py-4 font-bold text-gray-800">{req.departmentName}</td>
                      <td className="py-4 text-gray-800">{req.applicantName}</td>
                      <td className="py-4">
                        <ul className="space-y-1">
                          {req.items.map((item, idx) => (
                            <li key={idx} className="text-sm">
                              <span className="text-gray-700">{item.name}</span>
                              <span className="text-sky-500 ml-2 font-bold">x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-4">
                        {req.status === 'purchasing' ? (
                          <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">採購中</span>
                        ) : (
                          <span className="bg-green-100 text-green-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">已核可</span>
                        )}
                      </td>
                      <td className="py-4 text-right pr-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          {req.status !== 'purchasing' && (
                            <button onClick={() => handleConvertToProcurement(req.id)} className="bg-orange-400 hover:bg-orange-500 text-white p-2 rounded-xl text-sm" title="轉採購單">
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleConfirmReceive(req.id)} className="bg-sky-400 hover:bg-sky-500 text-white p-2 rounded-xl text-sm" title="確認領用 (扣庫存)">
                            <Package className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRevert(req.id)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-xl text-sm" title="退回到申請單">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(req.id)} className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded-xl text-sm" title="取消申請(刪除)">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedApproved.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">目前沒有已核可的資料</td></tr>}
                </tbody>
              </table>
            </div>
            {totalApprovedPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button disabled={approvedPage === 1} onClick={() => setApprovedPage(p => p - 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50">上一頁</button>
                <span className="text-gray-600 font-bold">{approvedPage} / {totalApprovedPages}</span>
                <button disabled={approvedPage === totalApprovedPages} onClick={() => setApprovedPage(p => p + 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50">下一頁</button>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
