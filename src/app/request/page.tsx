"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Plus, Trash2, Printer, Edit3 } from 'lucide-react';
import { db, getNextSerial } from '@/lib/firebase';
import { collection, getDocs, setDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { OfficeSupply, Department, Personnel, RequestItem, Category, RequestRecord, AppIcon } from '@/types';
import { useReactToPrint } from 'react-to-print';
import ConfirmModal from '@/components/ConfirmModal';
import * as Icons from 'lucide-react';
import React from 'react';

export default function RequestPage() {
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [icons, setIcons] = useState<AppIcon[]>([]);
  const [allRequests, setAllRequests] = useState<RequestRecord[]>([]);
  
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  
  // Pagination
  const [listPage, setListPage] = useState(1);
  const itemsPerPage = 5;

  // Create Request State
  const [selectedItems, setSelectedItems] = useState<RequestItem[]>([]);
  const [currentItemId, setCurrentItemId] = useState('');
  const [currentQty, setCurrentQty] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  
  // Modals
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Print references
  const printRef = useRef<HTMLDivElement>(null);
  const printPastRef = useRef<HTMLDivElement>(null);
  const [printingRequest, setPrintingRequest] = useState<RequestRecord | null>(null);

  // Edit Request State
  const [editingReq, setEditingReq] = useState<RequestRecord | null>(null);
  const [editItems, setEditItems] = useState<RequestItem[]>([]);
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editItemId, setEditItemId] = useState('');
  const [editQty, setEditQty] = useState(1);

  const fetchData = async () => {
    try {
      const [catSnap, supSnap, deptSnap, perSnap, reqSnap, iconSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'supplies')),
        getDocs(collection(db, 'departments')),
        getDocs(collection(db, 'personnel')),
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'icons'))
      ]);
      setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      setSupplies(supSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfficeSupply)));
      setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
      setPersonnel(perSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel)));
      setAllRequests(reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestRecord)));
      setIcons(iconSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppIcon)));
    } catch (error) { console.error('Failed to fetch data', error); }
  };

  useEffect(() => { fetchData(); }, []);

  // Ensure returning to page 1 when changing person
  useEffect(() => {
    setListPage(1);
  }, [selectedPersonId]);

  const renderIcon = (supplyId: string) => {
    const supply = supplies.find(s => s.id === supplyId);
    const iconData = icons.find(i => i.id === supply?.iconId);
    const IconComp = iconData ? (Icons as any)[iconData.name] : Icons.HelpCircle;
    return <IconComp className="w-5 h-5 text-sky-500 flex-shrink-0" />;
  };

  // Create Flow
  const handleAddItem = () => {
    if (!currentItemId || currentQty <= 0) return;
    const supply = supplies.find(s => s.id === currentItemId);
    if (!supply) return;
    
    const existing = selectedItems.find(item => item.supplyId === currentItemId);
    if (existing) {
      setSelectedItems(selectedItems.map(item => 
        item.supplyId === currentItemId ? { ...item, quantity: item.quantity + currentQty } : item
      ));
    } else {
      setSelectedItems([...selectedItems, { supplyId: supply.id, name: supply.name, quantity: currentQty }]);
    }
    setCurrentItemId(''); setCurrentQty(1); setIsAddItemModalOpen(false);
  };
  const handleRemoveItem = (id: string) => setSelectedItems(selectedItems.filter(item => item.supplyId !== id));

  // Edit Flow
  const handleEditReq = (req: RequestRecord) => {
    setEditingReq(req);
    setEditItems(req.items.map(item => ({ ...item }))); // Deep copy
  };
  const handleAddEditItem = () => {
    if (!editItemId || editQty <= 0) return;
    const supply = supplies.find(s => s.id === editItemId);
    if (!supply) return;
    
    const existing = editItems.find(item => item.supplyId === editItemId);
    if (existing) {
      setEditItems(editItems.map(item => 
        item.supplyId === editItemId ? { ...item, quantity: item.quantity + editQty } : item
      ));
    } else {
      setEditItems([...editItems, { supplyId: supply.id, name: supply.name, quantity: editQty }]);
    }
    setEditItemId(''); setEditQty(1);
  };
  const handleSaveEdit = async () => {
    if (!editingReq) return;
    try {
      const cleanItems = editItems.map(item => ({
        supplyId: item.supplyId || '',
        name: item.name || '',
        quantity: Number(item.quantity) || 1
      }));
      await updateDoc(doc(db, 'requests', editingReq.id), { items: cleanItems });
      setEditingReq(null);
      alert('修改成功！');
      fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); }
  };

  // Print Logic
  const handlePrint = useReactToPrint({ 
    content: () => printRef.current,
    documentTitle: `用品申請單-${new Date().toLocaleDateString('zh-TW')}`,
    onAfterPrint: () => setPrintingRequest(null)
  });

  const triggerPrintRequest = (req: RequestRecord) => {
    setPrintingRequest(req);
    setTimeout(() => {
      handlePrint();
    }, 100);
  };

  const handlePrintPastRequest = useReactToPrint({ 
    content: () => printPastRef.current, 
    documentTitle: `用品申請單`,
    onAfterPrint: () => setPrintingRequest(null) 
  });

  const triggerPrintPastRequest = (req: RequestRecord) => {
    setPrintingRequest(req);
    setTimeout(() => {
      handlePrintPastRequest();
    }, 100);
  };

  // Submit Logic
  const handleSubmit = async () => {
    if (!selectedDeptId || !selectedPersonId || selectedItems.length === 0) {
      alert('請填寫申請單位、人員，並至少選擇一項物品！'); return;
    }
    setIsSubmitting(true);
    try {
      const serial = await getNextSerial('REQ');
      const dept = departments.find(d => d.id === selectedDeptId);
      const person = personnel.find(p => p.id === selectedPersonId);
      
      const cleanItems = selectedItems.map(item => ({
        supplyId: item.supplyId,
        name: item.name,
        quantity: item.quantity || 1
      }));

      const newReqData = {
        id: serial,
        departmentId: selectedDeptId,
        departmentName: dept?.name || '未知單位',
        applicantId: selectedPersonId,
        applicantName: person?.name || '未知人員',
        items: cleanItems,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
      };
      
      await setDoc(doc(db, 'requests', serial), newReqData);
      alert('申請單已成功送出！✨ 即將為您產生列印檔...'); 
      
      const createdReq = { ...newReqData, createdAt: { toDate: () => new Date() } } as unknown as RequestRecord;
      triggerPrintRequest(createdReq);

      setSelectedCategoryId(''); setSelectedItems([]); fetchData();
      setActiveTab('list'); 
    } catch (error: any) { alert('申請單送出失敗：' + error.message); }
    finally { setIsSubmitting(false); setConfirmOpen(false); }
  };

  const handleDeleteRequest = async (id: string) => {
    try { await deleteDoc(doc(db, 'requests', id)); fetchData(); setDeleteId(null); }
    catch (e: any) { alert('刪除失敗'); }
  };

  const filteredPersonnel = personnel.filter(p => p.departmentId === selectedDeptId);
  const filteredSupplies = supplies.filter(s => selectedCategoryId ? s.categoryId === selectedCategoryId : true);
  const editFilteredSupplies = supplies.filter(s => editCategoryId ? s.categoryId === editCategoryId : true);
  
  const userUnfinishedRequests = allRequests.filter(r => 
    r.applicantId === selectedPersonId && r.status !== 'completed'
  ).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

  const totalPages = Math.ceil(userUnfinishedRequests.length / itemsPerPage) || 1;
  const paginatedRequests = userUnfinishedRequests.slice((listPage - 1) * itemsPerPage, listPage * itemsPerPage);

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-4xl mx-auto">
      <ConfirmModal isOpen={confirmOpen} title="確認送出" message="確定要送出這張申請單嗎？" onConfirm={handleSubmit} onCancel={() => setConfirmOpen(false)} confirmText="確認" confirmColor="bg-sky-500 hover:bg-sky-600 shadow-sky-200" />
      <ConfirmModal isOpen={!!deleteId} title="確認刪除" message="確定要刪除這筆申請單嗎？" onConfirm={() => deleteId && handleDeleteRequest(deleteId)} onCancel={() => setDeleteId(null)} confirmText="確認" />

      {/* Editing Modal */}
      {editingReq && (
        <div className="fixed inset-0 bg-sky-100/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full border-2 border-sky-100 shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-sky-600 flex items-center gap-2"><Edit3 className="w-6 h-6"/> 修改申請單 ({editingReq.id})</h2>
            
            <div className="max-h-[300px] overflow-y-auto mb-6 pr-2">
              <label className="block text-sm font-bold text-gray-600 mb-2">已申請的物品</label>
              {editItems.map((item, i) => (
                <div key={i} className="flex gap-2 mb-3 items-center">
                  {renderIcon(item.supplyId)}
                  <input className="flex-1 p-3 border-2 border-gray-100 bg-gray-50 rounded-xl text-gray-700 font-medium" value={item.name} disabled />
                  <span className="text-gray-500 font-bold">x</span>
                  <input className="w-24 p-3 border-2 border-sky-100 focus:border-sky-300 focus:ring-2 focus:ring-sky-200 outline-none rounded-xl text-center font-bold text-sky-600" type="number" min="1" value={item.quantity} onChange={e => {
                    const newItems = [...editItems];
                    newItems[i].quantity = parseInt(e.target.value) || 1;
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
                <select value={editCategoryId} onChange={e => {setEditCategoryId(e.target.value); setEditItemId('');}} className="w-full p-2 border-2 border-sky-100 rounded-xl outline-none">
                  <option value="">-- 先選擇類別 --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex gap-2 items-center">
                  {editItemId && <div className="p-2 bg-sky-50 rounded-xl">{renderIcon(editItemId)}</div>}
                  <select value={editItemId} onChange={e => setEditItemId(e.target.value)} disabled={!editCategoryId} className="flex-1 p-2 border-2 border-sky-100 rounded-xl outline-none disabled:opacity-50">
                    <option value="">-- 再選擇物品 --</option>
                    {editFilteredSupplies.map(s => <option key={s.id} value={s.id}>{s.name} (庫存:{s.quantity})</option>)}
                  </select>
                  <input type="number" min="1" value={editQty} onChange={e => setEditQty(parseInt(e.target.value) || 1)} className="w-20 p-2 border-2 border-sky-100 rounded-xl text-center outline-none" />
                  <button onClick={handleAddEditItem} className="bg-sky-400 text-white px-4 py-2 rounded-xl font-bold hover:bg-sky-500">加入</button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditingReq(null)} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl">取消</button>
              <button onClick={handleSaveEdit} disabled={editItems.length === 0} className="flex-1 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">儲存修改</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 bg-sky-100/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-lg border-2 border-sky-100 animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-sky-700 text-xl mb-6 flex items-center gap-2">
              <Plus className="w-6 h-6" /> 加入申請物品
            </h3>
            <div className="flex flex-col gap-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">物品類別</label>
                <select 
                  value={selectedCategoryId}
                  onChange={e => { setSelectedCategoryId(e.target.value); setCurrentItemId(''); }}
                  className="w-full rounded-xl border-2 border-sky-100 px-4 py-3 focus:outline-none focus:border-sky-300"
                >
                  <option value="">-- 先選擇類別 --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">物品名稱</label>
                <div className="flex items-center gap-2">
                  {currentItemId && <div className="p-2 bg-sky-50 rounded-xl">{renderIcon(currentItemId)}</div>}
                  <select 
                    value={currentItemId}
                    onChange={e => setCurrentItemId(e.target.value)}
                    disabled={!selectedCategoryId}
                    className="w-full rounded-xl border-2 border-sky-100 px-4 py-3 focus:outline-none focus:border-sky-300 disabled:opacity-50"
                  >
                    <option value="">-- 再選擇物品 --</option>
                    {filteredSupplies.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (庫存: {s.quantity})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申請數量</label>
                <input 
                  type="number" 
                  value={currentQty}
                  onChange={e => setCurrentQty(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full rounded-xl border-2 border-sky-100 px-4 py-3 focus:outline-none focus:border-sky-300 text-center"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsAddItemModalOpen(false)} className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50">取消</button>
              <button onClick={handleAddItem} className="flex-1 px-4 py-3 rounded-2xl bg-sky-400 text-white font-bold hover:bg-sky-500 shadow-sm shadow-sky-200">確認加入</button>
            </div>
          </div>
        </div>
      )}

      <Link href="/" className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1">
        <ArrowLeft className="w-4 h-4" /> 回首頁
      </Link>
      
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-sky-500 flex items-center gap-3">
          <FileText className="text-sky-400 w-8 h-8" />
          用品申請
        </h1>
        <p className="text-gray-500 mt-2 ml-1">填寫資料來申請辦公室用品 📝</p>
      </header>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-sky-100 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">申請單位</label>
            <select value={selectedDeptId} onChange={e => { setSelectedDeptId(e.target.value); setSelectedPersonId(''); }} className="w-full rounded-2xl border-2 border-sky-100 px-4 py-3 focus:outline-none focus:border-sky-300">
              <option value="">-- 選擇單位 --</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">申請人員</label>
            <select value={selectedPersonId} onChange={e => setSelectedPersonId(e.target.value)} disabled={!selectedDeptId} className="w-full rounded-2xl border-2 border-sky-100 px-4 py-3 focus:outline-none focus:border-sky-300 disabled:opacity-50">
              <option value="">-- 選擇人員 --</option>
              {filteredPersonnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {selectedPersonId && (
          <div>
            <div className="flex gap-4 mb-6 border-b-2 border-sky-100 pb-2">
              <button onClick={() => setActiveTab('list')} className={`px-6 py-2 font-bold text-lg rounded-t-2xl transition-colors ${activeTab === 'list' ? 'bg-sky-100 text-sky-600' : 'text-gray-500 hover:text-sky-500'}`}>
                <div className="flex items-center gap-2">未領用單據 ({userUnfinishedRequests.length})</div>
              </button>
              <button onClick={() => setActiveTab('create')} className={`px-6 py-2 font-bold text-lg rounded-t-2xl transition-colors ${activeTab === 'create' ? 'bg-sky-100 text-sky-600' : 'text-gray-500 hover:text-sky-500'}`}>
                <div className="flex items-center gap-2">登打申請單</div>
              </button>
            </div>

            {activeTab === 'list' && (
              <div className="animate-in fade-in duration-300">
                <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-sky-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-sky-50 text-sky-700">
                        <th className="pb-3 pl-4 pt-3 rounded-tl-xl font-bold w-16">序號</th>
                        <th className="pb-3 pt-3 font-bold">申請單號</th>
                        <th className="pb-3 pt-3 font-bold">申請日期</th>
                        <th className="pb-3 pt-3 font-bold">申請物品</th>
                        <th className="pb-3 pt-3 font-bold">狀態</th>
                        <th className="pb-3 pt-3 pr-4 text-right rounded-tr-xl font-bold">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRequests.map((req, i) => (
                        <tr key={req.id} className="border-b border-gray-50 hover:bg-sky-50/50">
                          <td className="py-3 pl-4 text-gray-500 font-medium">{(listPage - 1) * itemsPerPage + i + 1}</td>
                          <td className="py-3 font-bold text-gray-800">{req.id}</td>
                          <td className="py-3 text-gray-600">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A'}</td>
                          <td className="py-3">
                            <ul className="space-y-1">
                              {req.items.map((item, idx) => (
                                <li key={idx} className="text-xs flex items-center gap-1">
                                  {renderIcon(item.supplyId)}
                                  <span className="text-gray-700">{item.name}</span>
                                  <span className="text-sky-500 ml-1 font-bold">x{item.quantity}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-3">
                            {req.status === 'approved' ? (
                              <span className="bg-green-100 text-green-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">已核可</span>
                            ) : req.status === 'purchasing' ? (
                              <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">採購中</span>
                            ) : (
                              <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap">未核可</span>
                            )}
                          </td>
                          <td className="py-3 text-right pr-4">
                            <div className="flex justify-end gap-2">
                              {(!req.status || req.status === 'pending') && (
                                <>
                                  <button onClick={() => handleEditReq(req)} className="p-2 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100" title="修改"><Edit3 className="w-4 h-4" /></button>
                                  <button onClick={() => setDeleteId(req.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="刪除"><Trash2 className="w-4 h-4" /></button>
                                </>
                              )}
                              <button onClick={() => triggerPrintPastRequest(req)} className="p-2 bg-sky-50 text-sky-500 rounded-lg hover:bg-sky-100" title="補列印申請單"><Printer className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {paginatedRequests.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">目前沒有未結案的單據喔！</td></tr>}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 mt-6">
                    <button disabled={listPage === 1} onClick={() => setListPage(p => p - 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50 font-bold">上一頁</button>
                    <span className="text-gray-600 font-bold">{listPage} / {totalPages}</span>
                    <button disabled={listPage === totalPages} onClick={() => setListPage(p => p + 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50 font-bold">下一頁</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'create' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-700 text-lg">申請物品清單</h3>
                  <button onClick={() => setIsAddItemModalOpen(true)} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors"><Plus className="w-5 h-5" /> 新增申請物品</button>
                </div>

                <ul className="space-y-3 mb-8">
                  {selectedItems.map(item => (
                    <li key={item.supplyId} className="flex justify-between items-center bg-white border border-sky-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        {renderIcon(item.supplyId)}
                        <span className="font-medium text-gray-800">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sky-600 font-bold">x {item.quantity}</span>
                        <button onClick={() => handleRemoveItem(item.supplyId)} className="text-red-400"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </li>
                  ))}
                  {selectedItems.length === 0 && <li className="text-center py-10 bg-sky-50 rounded-xl border-2 border-dashed border-sky-100 text-gray-400">目前還沒有加入任何物品喔！</li>}
                </ul>

                <button onClick={() => setConfirmOpen(true)} disabled={isSubmitting || selectedItems.length === 0} className="w-full bg-sky-500 hover:bg-sky-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-sky-200 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2">
                  <Printer className="w-6 h-6" /> {isSubmitting ? '處理中...' : '送出申請單 ✨'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Hidden printable area */}
      <div className="hidden">
        <div ref={printRef} className="p-10 font-handwriting text-gray-800 max-w-[800px] mx-auto bg-white">
          <h1 className="text-3xl font-bold text-center mb-8 border-b-2 border-gray-800 pb-4">辦公室用品申請單</h1>
          
          <div className="flex justify-between mb-8 text-lg">
            <div>
              <p className="mb-2"><span className="font-bold">申請單號：</span> {printingRequest?.id}</p>
              <p className="mb-2"><span className="font-bold">申請單位：</span> {printingRequest?.departmentName || departments.find(d => d.id === selectedDeptId)?.name}</p>
              <p><span className="font-bold">申請人員：</span> {printingRequest?.applicantName || personnel.find(p => p.id === selectedPersonId)?.name}</p>
            </div>
            <div>
              <p><span className="font-bold">申請日期：</span> {printingRequest?.createdAt?.toDate ? printingRequest.createdAt.toDate().toLocaleDateString('zh-TW') : new Date().toLocaleDateString('zh-TW')}</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse mb-10 text-lg">
            <thead>
              <tr>
                <th className="border-b-2 border-gray-800 py-2">項次</th>
                <th className="border-b-2 border-gray-800 py-2">物品名稱</th>
                <th className="border-b-2 border-gray-800 py-2 text-right">數量</th>
              </tr>
            </thead>
            <tbody>
              {(printingRequest?.items || selectedItems).map((item, index) => (
                <tr key={item.supplyId}>
                  <td className="border-b border-gray-300 py-3">{index + 1}</td>
                  <td className="border-b border-gray-300 py-3">{item.name}</td>
                  <td className="border-b border-gray-300 py-3 text-right">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between mt-20 pt-10 text-lg">
            <div className="text-center w-48"><div className="border-b border-gray-800 pb-10"></div><p className="mt-2 font-bold">申請人簽章</p></div>
            <div className="text-center w-48"><div className="border-b border-gray-800 pb-10"></div><p className="mt-2 font-bold">單位主管簽章</p></div>
            <div className="text-center w-48"><div className="border-b border-gray-800 pb-10"></div><p className="mt-2 font-bold">管理部核發</p></div>
          </div>
        </div>
      </div>
    </main>
  );
}
