"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, CheckCircle, Clock, Trash2, ShoppingCart, RotateCcw, Package, CheckSquare, Edit3, Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { RequestRecord, Department, Personnel, RequestItem, OfficeSupply, Category, AppIcon } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';
import * as Icons from 'lucide-react';

export default function WorkflowPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [icons, setIcons] = useState<AppIcon[]>([]);

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
  const [confirmBtnText, setConfirmBtnText] = useState('確認');
  const [confirmBtnColor, setConfirmBtnColor] = useState('bg-sky-500 hover:bg-sky-600 shadow-sky-200');

  // Edit Request Modal
  const [editingReq, setEditingReq] = useState<RequestRecord | null>(null);
  const [editItems, setEditItems] = useState<RequestItem[]>([]);
  const [newItemCatId, setNewItemCatId] = useState('');
  const [newItemSupId, setNewItemSupId] = useState('');
  const [newItemQty, setNewItemQty] = useState<number | string>(1);

  const fetchData = async () => {
    try {
      const [reqSnap, deptSnap, perSnap, supSnap, catSnap, iconSnap] = await Promise.all([
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'departments')),
        getDocs(collection(db, 'personnel')),
        getDocs(collection(db, 'supplies')),
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'icons')),
      ]);
      setRequests(reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestRecord)).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
      setPersonnel(perSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel)));
      setSupplies(supSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfficeSupply)));
      setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      setIcons(iconSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppIcon)));
    } catch (error) {
      console.error('Error fetching workflow data', error);
    }
  };

  const renderIcon = (supplyId: string) => {
    const supply = supplies.find(s => s.id === supplyId);
    const iconData = icons.find(i => i.id === supply?.iconId);
    const IconComp = iconData ? (Icons as any)[iconData.name] : Icons.HelpCircle;
    return <IconComp className="w-5 h-5 text-sky-500 flex-shrink-0" />;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const requestAction = (msg: string, action: () => Promise<void>, btnText = '確認', btnColor = 'bg-sky-500 hover:bg-sky-600 shadow-sky-200') => {
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

  // --- Edit Logic ---
  const handleEditReq = (req: RequestRecord) => {
    setEditingReq(req);
    setEditItems([...req.items]);
  };

  const handleUpdateReq = async () => {
    if (!editingReq) return;
    requestAction('確定要儲存修改後的申請單內容嗎？', async () => {
      try {
        const cleanItems = editItems.map(item => ({
          supplyId: item.supplyId || '',
          name: item.name || '',
          quantity: Number(item.quantity) || 1
        }));
        await updateDoc(doc(db, 'requests', editingReq.id), { items: cleanItems });
        setEditingReq(null);
        fetchData();
      } catch (e: any) { alert('儲存失敗：' + e.message); }
    }, '確認修改', 'bg-sky-500 hover:bg-sky-600 shadow-sky-200');
  };

  const handleAddNewItemToReq = () => {
    const qty = Number(newItemQty) || 0;
    if (!newItemSupId || qty <= 0) return;
    const supply = supplies.find(s => s.id === newItemSupId);
    if (!supply) return;
    
    const existing = editItems.find(item => item.supplyId === newItemSupId);
    if (existing) {
      setEditItems(editItems.map(item => 
        item.supplyId === newItemSupId ? { ...item, quantity: item.quantity + qty } : item
      ));
    } else {
      setEditItems([...editItems, { supplyId: supply.id, name: supply.name, quantity: qty }]);
    }
    setNewItemCatId('');
    setNewItemSupId('');
    setNewItemQty(1);
  };

  // --- Pending Actions ---
  const handleApprove = (id: string) => requestAction('確定要核可這筆申請單嗎？', async () => {
    await updateRequestStatus(id, 'approved');
  });

  const handleBulkApprove = () => {
    if (selectedPending.length === 0) return alert('請先勾選要核可的申請單！');
    requestAction(`確定要一次核可這 ${selectedPending.length} 筆申請單嗎？`, async () => {
      try {
        await Promise.all(selectedPending.map(id => updateDoc(doc(db, 'requests', id), { status: 'approved' })));
        setSelectedPending([]);
        fetchData();
      } catch (e: any) { alert('批次核可失敗：' + e.message); }
    });
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
  });

  const handleDelete = (id: string) => requestAction('確定要取消(刪除)這筆申請單嗎？此操作無法還原。', async () => {
    try {
      await deleteDoc(doc(db, 'requests', id));
      fetchData();
    } catch (e: any) { alert('刪除失敗：' + e.message); }
  }, '確認刪除', 'bg-red-400 hover:bg-red-500 shadow-red-200');

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

  const handleConfirmReceive = (req: RequestRecord) => {
    if (req.status === 'purchasing' || req.status === 'pending-restock') {
      return alert('這筆申請單的物品尚未完成採購入庫，暫時無法領用！');
    }
    
    // Check if any item has insufficient stock
    for (const item of req.items) {
      const supply = supplies.find(s => s.id === item.supplyId);
      if (!supply || supply.quantity < item.quantity) {
        return alert(`領用失敗！物品「${item.name}」目前庫存不足。`);
      }
    }

    requestAction('確認領用後，將自動扣除對應物品的庫存數量，並將狀態標為「已完成」，確定執行嗎？', async () => {
      try {
        await confirmReceiveLogic(req.id);
        fetchData();
      } catch (e: any) { alert('處理失敗：' + e.message); }
    });
  };

  const handleBulkConfirmReceive = () => {
    const validSelections = selectedApproved.filter(id => {
      const r = requests.find(req => req.id === id);
      return r && r.status !== 'purchasing' && r.status !== 'pending-restock';
    });
    
    if (validSelections.length === 0) return alert('請先勾選可領用的申請單！(採購中或待入庫的單據無法領用)');
    
    // Check stock for all selected
    for (const id of validSelections) {
      const req = requests.find(r => r.id === id);
      if (req) {
        for (const item of req.items) {
          const supply = supplies.find(s => s.id === item.supplyId);
          if (!supply || supply.quantity < item.quantity) {
             return alert(`領用失敗！申請單 ${req.id} 內的物品「${item.name}」目前庫存不足，請先取消勾選該單據。`);
          }
        }
      }
    }

    if (validSelections.length !== selectedApproved.length) {
      alert(`已幫您自動略過 ${selectedApproved.length - validSelections.length} 筆尚未入庫的單據。`);
    }

    requestAction(`確認領用後，將自動扣除這 ${validSelections.length} 筆申請單對應物品的庫存數量，確定執行嗎？`, async () => {
      try {
        await Promise.all(validSelections.map(id => confirmReceiveLogic(id)));
        setSelectedApproved([]);
        fetchData();
      } catch (e: any) { alert('批次處理失敗：' + e.message); }
    });
  };

  const pendingRequests = requests.filter(r => !r.status || r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved' || r.status === 'purchasing' || r.status === 'pending-restock' || r.status === 'restocked');

  const totalPendingPages = Math.ceil(pendingRequests.length / itemsPerPage) || 1;
  const totalApprovedPages = Math.ceil(approvedRequests.length / itemsPerPage) || 1;

  const paginatedPending = pendingRequests.slice((pendingPage - 1) * itemsPerPage, pendingPage * itemsPerPage);
  const paginatedApproved = approvedRequests.slice((approvedPage - 1) * itemsPerPage, approvedPage * itemsPerPage);

  const editFilteredSupplies = supplies.filter(s => newItemCatId ? s.categoryId === newItemCatId : true);

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

      {/* Editing Modal */}
      {editingReq && (
        <div className="fixed inset-0 bg-sky-100/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full border-2 border-sky-100 shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-sky-600 flex items-center gap-2"><Edit3 className="w-6 h-6"/> 修改申請內容</h2>
            
            <div className="max-h-[300px] overflow-y-auto mb-6 pr-2">
              <label className="block text-sm font-bold text-gray-600 mb-2">已申請的物品</label>
              {editItems.map((item, i) => (
                <div key={i} className="flex gap-2 mb-3 items-center">
                  {renderIcon(item.supplyId)}
                  <input className="flex-1 p-3 border-2 border-gray-100 bg-gray-50 rounded-xl text-gray-700 font-medium" value={item.name} disabled />
                  <span className="text-gray-500 font-bold">x</span>
                  <input className="w-24 p-3 border-2 border-sky-100 focus:border-sky-300 focus:ring-2 focus:ring-sky-200 outline-none rounded-xl text-center font-bold text-sky-600" type="number" min="1" value={item.quantity === 0 ? '' : item.quantity} onChange={e => {
                    const newItems = [...editItems];
                    newItems[i].quantity = e.target.value === '' ? 0 : parseInt(e.target.value);
                    setEditItems(newItems);
                  }} />
                  <button onClick={() => setEditItems(editItems.filter((_, idx) => idx !== i))} className="p-3 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 className="w-5 h-5"/></button>
                </div>
              ))}
              {editItems.length === 0 && <p className="text-gray-400 text-sm py-2">目前清單為空</p>}
            </div>

            <div className="bg-sky-50 p-4 rounded-2xl mb-6">
              <label className="block text-sm font-bold text-sky-700 mb-2">追加新物品</label>
              <div className="flex flex-col gap-2">
                <select value={newItemCatId} onChange={e => {setNewItemCatId(e.target.value); setNewItemSupId('');}} className="w-full p-2 border-2 border-sky-100 rounded-xl outline-none">
                  <option value="">-- 先選擇類別 --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex gap-2 items-center">
                  {newItemSupId && <div className="p-2 bg-sky-50 rounded-xl">{renderIcon(newItemSupId)}</div>}
                  <select value={newItemSupId} onChange={e => setNewItemSupId(e.target.value)} disabled={!newItemCatId} className="flex-1 p-2 border-2 border-sky-100 rounded-xl outline-none disabled:opacity-50">
                    <option value="">-- 再選擇物品 --</option>
                    {editFilteredSupplies.map(s => <option key={s.id} value={s.id}>{s.name} (庫存:{s.quantity})</option>)}
                  </select>
                  <input type="number" min="1" value={newItemQty} onChange={e => setNewItemQty(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-20 p-2 border-2 border-sky-100 rounded-xl text-center outline-none" />
                  <button onClick={handleAddNewItemToReq} className="bg-sky-400 text-white px-4 rounded-xl font-bold hover:bg-sky-500">加入</button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditingReq(null)} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl">取消</button>
              <button onClick={handleUpdateReq} disabled={editItems.length === 0} className="flex-1 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-5 h-5"/> 儲存修改</button>
            </div>
          </div>
        </div>
      )}

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
                待核可的申請資料
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-sky-100 text-sky-700">
                    <th className="pb-3 pl-2 w-28">
                      <div className="flex flex-col items-start gap-2">
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedPending(paginatedPending.map(r => r.id))} className="text-xs bg-sky-100 text-sky-600 px-2 py-1 rounded hover:bg-sky-200">全選</button>
                          <button onClick={() => setSelectedPending([])} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200">全取消</button>
                        </div>
                        <input 
                          type="checkbox" 
                          onChange={e => {
                            if (e.target.checked) setSelectedPending(paginatedPending.map(r => r.id));
                            else setSelectedPending(selectedPending.filter(id => !paginatedPending.find(r => r.id === id)));
                          }}
                          checked={paginatedPending.length > 0 && paginatedPending.every(r => selectedPending.includes(r.id))}
                          className="w-5 h-5 rounded border-sky-300 text-sky-500 focus:ring-sky-200 ml-1"
                        />
                      </div>
                    </th>
                    <th className="pb-3">單號</th>
                    <th className="pb-3">申請日期</th>
                    <th className="pb-3">申請單位</th>
                    <th className="pb-3">申請人員</th>
                    <th className="pb-3">申請物品</th>
                    <th className="pb-3 text-right pr-4">
                      <button onClick={handleBulkApprove} disabled={selectedPending.length === 0} className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-2 ml-auto">
                        <CheckSquare className="w-4 h-4" /> 批次核可 ({selectedPending.length})
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPending.map(req => (
                    <tr key={req.id} className="border-b border-gray-100 hover:bg-sky-50/50">
                      <td className="py-4 pl-3">
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
                      <td className="py-4 font-bold text-gray-800">{req.id}</td>
                      <td className="py-4 text-gray-600">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A'}</td>
                      <td className="py-4 font-bold text-gray-800">{req.departmentName}</td>
                      <td className="py-4 text-gray-800">{req.applicantName}</td>
                      <td className="py-4">
                        <ul className="space-y-1">
                          {req.items.map((item, idx) => {
                            const supply = supplies.find(s => s.id === item.supplyId);
                            const currentStock = supply ? supply.quantity : 0;
                            const isLowStock = currentStock < item.quantity;
                            return (
                              <li key={idx} className="text-sm flex items-center gap-1">
                                <span className="text-gray-700">{item.name}</span>
                                <span className="text-sky-500 ml-1 font-bold">x{item.quantity}</span>
                                <span className={`text-xs ml-2 px-2 py-0.5 rounded-full font-bold ${isLowStock ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                  (庫存: {currentStock})
                                </span>
                                {isLowStock && <span className="text-xs text-red-500 font-bold ml-1 animate-pulse">庫存不足!</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td className="py-4 text-right pr-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEditReq(req)} className="p-2 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100" title="修改內容">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(req.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="刪除">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleApprove(req.id)} className="bg-sky-400 hover:bg-sky-500 text-white px-4 py-2 rounded-xl font-bold text-sm">
                            核可
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedPending.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">目前沒有待核可的資料</td></tr>}
                </tbody>
              </table>
            </div>
            {totalPendingPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button disabled={pendingPage === 1} onClick={() => setPendingPage(p => p - 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50 font-bold">上一頁</button>
                <span className="text-gray-600 font-bold">{pendingPage} / {totalPendingPages}</span>
                <button disabled={pendingPage === totalPendingPages} onClick={() => setPendingPage(p => p + 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50 font-bold">下一頁</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'approved' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                已核可的申請資料
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-sky-100 text-sky-700">
                    <th className="pb-3 pl-2 w-28">
                      <div className="flex flex-col items-start gap-2">
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedApproved(paginatedApproved.map(r => r.id))} className="text-xs bg-sky-100 text-sky-600 px-2 py-1 rounded hover:bg-sky-200">全選</button>
                          <button onClick={() => setSelectedApproved([])} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200">全取消</button>
                        </div>
                        <input 
                          type="checkbox" 
                          onChange={e => {
                            if (e.target.checked) setSelectedApproved(paginatedApproved.map(r => r.id));
                            else setSelectedApproved(selectedApproved.filter(id => !paginatedApproved.find(r => r.id === id)));
                          }}
                          checked={paginatedApproved.length > 0 && paginatedApproved.every(r => selectedApproved.includes(r.id))}
                          className="w-5 h-5 rounded border-sky-300 text-sky-500 focus:ring-sky-200 ml-1"
                        />
                      </div>
                    </th>
                    <th className="pb-3">單號</th>
                    <th className="pb-3">申請日期</th>
                    <th className="pb-3">申請單位</th>
                    <th className="pb-3">申請人員</th>
                    <th className="pb-3">申請物品</th>
                    <th className="pb-3">狀態</th>
                    <th className="pb-3 text-right pr-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={handleBulkConvertToProcurement} disabled={selectedApproved.length === 0} className="px-3 py-2 text-sm bg-orange-400 hover:bg-orange-500 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1">
                          <ShoppingCart className="w-4 h-4" /> 批次轉採購
                        </button>
                        <button onClick={handleBulkConfirmReceive} disabled={selectedApproved.length === 0} className="px-3 py-2 text-sm bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1">
                          <Package className="w-4 h-4" /> 批次確認領用
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedApproved.map(req => (
                    <tr key={req.id} className="border-b border-gray-100 hover:bg-sky-50/50">
                      <td className="py-4 pl-3">
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
                      <td className="py-4 font-bold text-gray-800">{req.id}</td>
                      <td className="py-4 text-gray-600">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A'}</td>
                      <td className="py-4 font-bold text-gray-800">{req.departmentName}</td>
                      <td className="py-4 text-gray-800">{req.applicantName}</td>
                      <td className="py-4">
                        <ul className="space-y-1">
                          {req.items.map((item, idx) => {
                            const supply = supplies.find(s => s.id === item.supplyId);
                            const currentStock = supply ? supply.quantity : 0;
                            const isLowStock = currentStock < item.quantity;
                            return (
                              <li key={idx} className="text-sm flex items-center gap-1">
                                <span className="text-gray-700">{item.name}</span>
                                <span className="text-sky-500 ml-1 font-bold">x{item.quantity}</span>
                                <span className={`text-xs ml-2 px-2 py-0.5 rounded-full font-bold ${isLowStock ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                  (庫存: {currentStock})
                                </span>
                                {isLowStock && <span className="text-xs text-red-500 font-bold ml-1 animate-pulse">庫存不足!</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td className="py-4">
                        {req.status === 'purchasing' ? (
                          <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">採購中</span>
                        ) : req.status === 'pending-restock' ? (
                          <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">待入庫</span>
                        ) : req.status === 'restocked' ? (
                          <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">已入庫</span>
                        ) : (
                          <span className="bg-green-100 text-green-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">已核可</span>
                        )}
                      </td>
                      <td className="py-4 text-right pr-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          {(req.status === 'approved' || req.status === 'restocked') && (
                            <button onClick={() => handleConvertToProcurement(req.id)} className="bg-orange-400 hover:bg-orange-500 text-white p-2 rounded-xl text-sm" title="轉採購單">
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleConfirmReceive(req)} 
                            className="bg-sky-400 hover:bg-sky-500 text-white px-3 py-2 rounded-xl text-sm font-bold disabled:opacity-50 disabled:bg-gray-300 flex items-center gap-1" 
                            disabled={req.status === 'purchasing' || req.status === 'pending-restock' || req.items.some(item => {
                              const supply = supplies.find(s => s.id === item.supplyId);
                              return !supply || supply.quantity < item.quantity;
                            })}
                          >
                            <Package className="w-4 h-4" /> 物品領用
                          </button>
                          <button onClick={() => handleRevert(req.id)} disabled={req.status === 'purchasing' || req.status === 'pending-restock' || req.status === 'restocked'} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-xl text-sm disabled:opacity-50 disabled:hover:bg-gray-100" title="退回到申請單">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(req.id)} disabled={req.status === 'purchasing' || req.status === 'pending-restock' || req.status === 'restocked'} className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded-xl text-sm disabled:opacity-50 disabled:hover:bg-red-50" title="取消申請(刪除)">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedApproved.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-gray-400">目前沒有已核可的資料</td></tr>}
                </tbody>
              </table>
            </div>
            {totalApprovedPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button disabled={approvedPage === 1} onClick={() => setApprovedPage(p => p - 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50 font-bold">上一頁</button>
                <span className="text-gray-600 font-bold">{approvedPage} / {totalApprovedPages}</span>
                <button disabled={approvedPage === totalApprovedPages} onClick={() => setApprovedPage(p => p + 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50 font-bold">下一頁</button>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
