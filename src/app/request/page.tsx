"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Plus, Trash2, Printer } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { OfficeSupply, Department, Personnel, RequestItem, Category, RequestRecord } from '@/types';
import { useReactToPrint } from 'react-to-print';
import ConfirmModal from '@/components/ConfirmModal';

export default function RequestPage() {
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestRecord[]>([]);
  
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  
  const [selectedItems, setSelectedItems] = useState<RequestItem[]>([]);
  const [currentItemId, setCurrentItemId] = useState('');
  const [currentQty, setCurrentQty] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Ref for the printable area
  const printRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const catSnap = await getDocs(collection(db, 'categories'));
      setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));

      const supSnap = await getDocs(collection(db, 'supplies'));
      setSupplies(supSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfficeSupply)));
      
      const deptSnap = await getDocs(collection(db, 'departments'));
      setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
      
      const perSnap = await getDocs(collection(db, 'personnel'));
      setPersonnel(perSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel)));
      
      const reqSnap = await getDocs(collection(db, 'requests'));
      setPendingRequests(reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestRecord)));
    } catch (error) {
      console.error('Failed to fetch data', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    setCurrentItemId('');
    setCurrentQty(1);
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems(selectedItems.filter(item => item.supplyId !== id));
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `用品申請單-${new Date().toLocaleDateString('zh-TW')}`,
  });

  const handleSubmitClick = () => {
    if (!selectedDeptId || !selectedPersonId || selectedItems.length === 0) {
      alert('請填寫申請單位、人員，並至少選擇一項物品！');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    const dept = departments.find(d => d.id === selectedDeptId);
    const person = personnel.find(p => p.id === selectedPersonId);
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'requests'), {
        departmentId: selectedDeptId,
        departmentName: dept?.name || '未知單位',
        applicantId: selectedPersonId,
        applicantName: person?.name || '未知人員',
        items: selectedItems,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      alert('申請單已成功送出並儲存至系統！即將為您產生列印檔... ✨');
      handlePrint();
      
      // Reset form & Refresh data
      setSelectedDeptId('');
      setSelectedPersonId('');
      setSelectedCategoryId('');
      setSelectedItems([]);
      fetchData();
    } catch (error: any) {
      alert('申請單送出失敗：' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPersonnel = personnel.filter(p => p.departmentId === selectedDeptId);
  const filteredSupplies = supplies.filter(s => selectedCategoryId ? s.categoryId === selectedCategoryId : true);
  
  // 該申請人未核可(pending)的申請單
  const userPendingRequests = pendingRequests.filter(r => 
    r.applicantId === selectedPersonId && (!r.status || r.status === 'pending')
  ).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-4xl mx-auto">
      <ConfirmModal 
        isOpen={confirmOpen}
        title="確認送出申請"
        message="您確定要送出這張申請單嗎？送出後將產生 PDF 檔案供您列印。"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmOpen(false)}
      />

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
            <select 
              value={selectedDeptId}
              onChange={e => { setSelectedDeptId(e.target.value); setSelectedPersonId(''); }}
              className="w-full rounded-2xl border-2 border-sky-100 px-4 py-3 focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
            >
              <option value="">-- 選擇單位 --</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">申請人員</label>
            <select 
              value={selectedPersonId}
              onChange={e => setSelectedPersonId(e.target.value)}
              disabled={!selectedDeptId}
              className="w-full rounded-2xl border-2 border-sky-100 px-4 py-3 focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200 disabled:opacity-50"
            >
              <option value="">-- 選擇人員 --</option>
              {filteredPersonnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-sky-50 rounded-2xl p-6 mb-8">
          <h3 className="font-bold text-sky-700 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" /> 加入申請物品
          </h3>
          <div className="flex flex-col md:flex-row gap-4">
            <select 
              value={selectedCategoryId}
              onChange={e => { setSelectedCategoryId(e.target.value); setCurrentItemId(''); }}
              className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300"
            >
              <option value="">-- 先選擇類別 --</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select 
              value={currentItemId}
              onChange={e => setCurrentItemId(e.target.value)}
              disabled={!selectedCategoryId}
              className="flex-[2] rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300 disabled:opacity-50"
            >
              <option value="">-- 再選擇物品 --</option>
              {filteredSupplies.map(s => (
                <option key={s.id} value={s.id}>{s.name} (庫存: {s.quantity})</option>
              ))}
            </select>
            <input 
              type="number" 
              value={currentQty}
              onChange={e => setCurrentQty(parseInt(e.target.value))}
              min="1"
              className="w-24 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300 text-center"
            />
            <button 
              onClick={handleAddItem}
              className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-xl font-bold transition-colors"
            >
              加入
            </button>
          </div>
        </div>

        {selectedItems.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-700 mb-4">已選取清單</h3>
            <ul className="space-y-3">
              {selectedItems.map(item => (
                <li key={item.supplyId} className="flex justify-between items-center bg-white border border-sky-100 rounded-xl p-4 shadow-sm">
                  <span className="font-medium text-gray-800">{item.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sky-600 font-bold">x {item.quantity}</span>
                    <button onClick={() => handleRemoveItem(item.supplyId)} className="text-gray-400 hover:text-red-500 p-1">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button 
          onClick={handleSubmitClick}
          disabled={isSubmitting || selectedItems.length === 0}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-sky-200 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          <Printer className="w-6 h-6" />
          {isSubmitting ? '處理中...' : '送出並產生 PDF 申請單 ✨'}
        </button>
      </div>

      {selectedPersonId && (
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-sm border-2 border-sky-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            該申請人未核可的申請單 ({userPendingRequests.length})
          </h3>
          {userPendingRequests.length === 0 ? (
            <p className="text-gray-400 py-4">目前沒有未核可的申請單喔！</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-sky-100 text-sky-700">
                    <th className="pb-2">申請日期</th>
                    <th className="pb-2">申請物品 (數量)</th>
                    <th className="pb-2">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {userPendingRequests.map(req => (
                    <tr key={req.id} className="border-b border-gray-100 hover:bg-sky-50/50">
                      <td className="py-3 text-gray-600">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A'}</td>
                      <td className="py-3">
                        <ul className="space-y-1">
                          {req.items.map((item, idx) => (
                            <li key={idx} className="text-sm">
                              <span className="text-gray-700">{item.name}</span>
                              <span className="text-sky-500 ml-2 font-bold">x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-3">
                        <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-lg text-xs font-bold">未核可</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Hidden printable area */}
      <div className="hidden">
        <div ref={printRef} className="p-10 font-handwriting text-gray-800 max-w-[800px] mx-auto bg-white">
          <h1 className="text-3xl font-bold text-center mb-8 border-b-2 border-gray-800 pb-4">辦公室用品申請單</h1>
          
          <div className="flex justify-between mb-8 text-lg">
            <div>
              <p className="mb-2"><span className="font-bold">申請單位：</span> {departments.find(d => d.id === selectedDeptId)?.name || '未選擇'}</p>
              <p><span className="font-bold">申請人員：</span> {personnel.find(p => p.id === selectedPersonId)?.name || '未選擇'}</p>
            </div>
            <div>
              <p><span className="font-bold">申請日期：</span> {new Date().toLocaleDateString('zh-TW')}</p>
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
              {selectedItems.map((item, index) => (
                <tr key={item.supplyId}>
                  <td className="border-b border-gray-300 py-3">{index + 1}</td>
                  <td className="border-b border-gray-300 py-3">{item.name}</td>
                  <td className="border-b border-gray-300 py-3 text-right">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between mt-20 pt-10 text-lg">
            <div className="text-center w-48">
              <div className="border-b border-gray-800 pb-10"></div>
              <p className="mt-2 font-bold">申請人簽章</p>
            </div>
            <div className="text-center w-48">
              <div className="border-b border-gray-800 pb-10"></div>
              <p className="mt-2 font-bold">單位主管簽章</p>
            </div>
            <div className="text-center w-48">
              <div className="border-b border-gray-800 pb-10"></div>
              <p className="mt-2 font-bold">管理部核發</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
