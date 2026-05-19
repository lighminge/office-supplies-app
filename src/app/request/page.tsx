"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { OfficeSupply, Department, Personnel, RequestItem } from '@/types';

export default function RequestPage() {
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [selectedItems, setSelectedItems] = useState<RequestItem[]>([]);
  
  const [currentItemId, setCurrentItemId] = useState('');
  const [currentQty, setCurrentQty] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supSnap = await getDocs(collection(db, 'supplies'));
        setSupplies(supSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfficeSupply)));
        
        const deptSnap = await getDocs(collection(db, 'departments'));
        setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
        
        const perSnap = await getDocs(collection(db, 'personnel'));
        setPersonnel(perSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel)));
      } catch (error) {
        console.error('Failed to fetch data', error);
      }
    };
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

  const handleSubmit = async () => {
    if (!selectedDeptId || !selectedPersonId || selectedItems.length === 0) {
      alert('請填寫申請單位、人員，並至少選擇一項物品！');
      return;
    }
    
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
        createdAt: serverTimestamp(),
      });
      alert('申請單已成功送出！✨');
      setSelectedDeptId('');
      setSelectedPersonId('');
      setSelectedItems([]);
    } catch (error: any) {
      alert('申請單送出失敗：' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter personnel based on selected department
  const filteredPersonnel = personnel.filter(p => p.departmentId === selectedDeptId);

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-4xl mx-auto">
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

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-sky-100">
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
              value={currentItemId}
              onChange={e => setCurrentItemId(e.target.value)}
              className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300"
            >
              <option value="">-- 選擇物品 --</option>
              {supplies.map(s => (
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
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-sky-200 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
        >
          {isSubmitting ? '送出中...' : '產生申請單 ✨'}
        </button>
      </div>
    </main>
  );
}
