"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Sparkles, Plus, Edit3, Trash2, Tag, Image as ImageIcon, ShoppingCart, Calendar, CheckSquare, Save } from 'lucide-react';
import { db, getNextSerial } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { OfficeSupply, Category, AppIcon, LUCIDE_ICONS_LIST, LUCIDE_ICONS_MAP, RequestRecord, ProcurementRecord, ProcurementItem } from '@/types';
import ItemForm from '@/components/ItemForm';
import ItemCard from '@/components/ItemCard';
import ConfirmModal from '@/components/ConfirmModal';
import * as Icons from 'lucide-react';

type TabType = 'supplies' | 'categories' | 'icons' | 'procurement';

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('supplies');
  
  // Data
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [icons, setIcons] = useState<AppIcon[]>([]);
  const [procurements, setProcurements] = useState<ProcurementRecord[]>([]);
  const [purchasingRequests, setPurchasingRequests] = useState<RequestRecord[]>([]);

  // Filters & Pagination
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState('');
  const [supplyKeywordFilter, setSupplyKeywordFilter] = useState('');
  const [iconCategoryFilter, setIconCategoryFilter] = useState('');
  const [supplyPage, setSupplyPage] = useState(1);
  const itemsPerPage = 12;

  // Modals
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmBtnText, setConfirmBtnText] = useState('確認');
  const [confirmBtnColor, setConfirmBtnColor] = useState('bg-sky-500 hover:bg-sky-600 shadow-sky-200');

  // Procurement History Filter & Pagination
  const [procStartDate, setProcStartDate] = useState('');
  const [procEndDate, setProcEndDate] = useState('');
  const [procPage, setProcPage] = useState(1);
  const procPerPage = 10;
  const [selectedProcs, setSelectedProcs] = useState<string[]>([]);
  const [restockDateModalOpen, setRestockDateModalOpen] = useState(false);
  const [restockDate, setRestockDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetProcForRestock, setTargetProcForRestock] = useState<ProcurementRecord | null>(null);
  const [procHistoryStatusFilter, setProcHistoryStatusFilter] = useState('All');

  const requestAction = (msg: string, action: () => Promise<void> | void, btnText = '確認', btnColor = 'bg-sky-500 hover:bg-sky-600 shadow-sky-200') => {
    setConfirmMessage(msg);
    setConfirmAction(() => action);
    setConfirmBtnText(btnText);
    setConfirmBtnColor(btnColor);
    setConfirmOpen(true);
  };

  const fetchData = async () => {
    try {
      const [catSnap, iconSnap, supSnap, procSnap, reqSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'icons')),
        getDocs(collection(db, 'supplies')),
        getDocs(collection(db, 'procurements')),
        getDocs(collection(db, 'requests')),
      ]);

      setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      setIcons(iconSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppIcon)));
      setSupplies(supSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfficeSupply)));
      
      const rawProc = procSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcurementRecord));
      setProcurements(rawProc.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));

      const rawReq = reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestRecord));
      setPurchasingRequests(rawReq.filter(r => r.status === 'purchasing'));

    } catch (error) {
      console.error('Error fetching management data', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Category ---
  const [catId, setCatId] = useState('');
  const [catName, setCatName] = useState('');
  const handleSaveCategory = async () => {
    if (!catName) return requestAction('請輸入類別名稱！', () => {}, '確定');
    try {
      if (catId) await updateDoc(doc(db, 'categories', catId), { name: catName, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, 'categories'), { name: catName, updatedAt: serverTimestamp() });
      setCatId(''); setCatName(''); fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); }
  };
  const handleDeleteCategory = (id: string) => requestAction('確定要刪除這個類別嗎？', async () => {
    await deleteDoc(doc(db, 'categories', id)); fetchData();
  });

  // --- Icon ---
  const [iconId, setIconId] = useState('');
  const [iconCategoryId, setIconCategoryId] = useState('');
  const [iconName, setIconName] = useState(LUCIDE_ICONS_LIST[0]);
  const [iconLabel, setIconLabel] = useState(LUCIDE_ICONS_MAP[LUCIDE_ICONS_LIST[0]]);
  const handleSaveIcon = async () => {
    if (!iconCategoryId || !iconLabel || !iconName) return requestAction('請選取物品類別、輸入插圖名稱並選擇圖示！', () => {}, '確定');
    try {
      if (iconId) await updateDoc(doc(db, 'icons', iconId), { categoryId: iconCategoryId, name: iconName, label: iconLabel, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, 'icons'), { categoryId: iconCategoryId, name: iconName, label: iconLabel, updatedAt: serverTimestamp() });
      setIconId(''); setIconCategoryId(''); setIconLabel(LUCIDE_ICONS_MAP[LUCIDE_ICONS_LIST[0]]); setIconName(LUCIDE_ICONS_LIST[0]); fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); }
  };
  const handleDeleteIcon = (id: string) => requestAction('確定要刪除這個插圖嗎？', async () => {
    await deleteDoc(doc(db, 'icons', id)); fetchData();
  });

  const filteredIcons = iconCategoryFilter ? icons.filter(i => i.categoryId === iconCategoryFilter) : icons;

  // --- Supply ---
  const [isSupplyFormOpen, setIsSupplyFormOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<OfficeSupply | null>(null);
  const handleSaveSupply = async (data: any) => {
    try {
      if (editingSupply) await updateDoc(doc(db, 'supplies', editingSupply.id), { ...data, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, 'supplies'), { ...data, updatedAt: serverTimestamp() });
      setIsSupplyFormOpen(false); setEditingSupply(null); fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); setIsSupplyFormOpen(false); }
  };
  const handleDeleteSupply = (id: string) => {
    const supply = supplies.find(s => s.id === id);
    if (supply && supply.quantity > 0) {
      return requestAction('無法刪除！此物品的庫存數量大於 0。請先將庫存清空後再刪除。', () => {}, '確定');
    }
    requestAction('確定要刪除這個可愛的物品嗎？ 🥺', async () => {
      await deleteDoc(doc(db, 'supplies', id)); fetchData();
    });
  };

  const filteredSupplies = supplies.filter(s => {
    const matchCategory = supplyCategoryFilter ? s.categoryId === supplyCategoryFilter : true;
    const matchKeyword = supplyKeywordFilter ? s.name.toLowerCase().includes(supplyKeywordFilter.toLowerCase()) : true;
    return matchCategory && matchKeyword;
  });
  const paginatedSupplies = filteredSupplies.slice((supplyPage - 1) * itemsPerPage, supplyPage * itemsPerPage);
  const totalSupplyPages = Math.ceil(filteredSupplies.length / itemsPerPage) || 1;

  // --- Procurement ---
  const [procDate, setProcDate] = useState('');
  const [procLocation, setProcLocation] = useState('');
  const [procItems, setProcItems] = useState<ProcurementItem[]>([]);
  
  const [procCatId, setProcCatId] = useState('');
  const [procSupplyId, setProcSupplyId] = useState('');
  const [procQty, setProcQty] = useState<number | string>(1);
  const [procPrice, setProcPrice] = useState<number | string>(0);
  const [procAddMode, setProcAddMode] = useState<'single' | 'bulk'>('single');
  const [bulkSelectedSupplies, setBulkSelectedSupplies] = useState<string[]>([]);
  const [editingProcSupplyId, setEditingProcSupplyId] = useState('');
  const [editingHistoryProcId, setEditingHistoryProcId] = useState('');

  // Load from purchasing requests automatically
  useEffect(() => {
    if (activeTab === 'procurement' && procItems.length === 0 && purchasingRequests.length > 0 && !editingHistoryProcId) {
      const aggregated: Record<string, { name: string, quantity: number }> = {};
      purchasingRequests.forEach(req => {
        req.items.forEach(item => {
          if (!aggregated[item.supplyId]) aggregated[item.supplyId] = { name: item.name, quantity: 0 };
          aggregated[item.supplyId].quantity += item.quantity;
        });
      });
      const newProcItems: ProcurementItem[] = Object.entries(aggregated).map(([supplyId, data]) => {
        const supply = supplies.find(s => s.id === supplyId);
        return {
          supplyId,
          name: data.name,
          quantity: data.quantity,
          unitPrice: supply ? (supply.price || 0) : 0
        };
      });
      setProcItems(newProcItems);
    }
  }, [activeTab, purchasingRequests, editingHistoryProcId, supplies, procItems.length]);

  // Clear procurement draft state when leaving procurement tab
  useEffect(() => {
    if (activeTab !== 'procurement') {
      setProcDate(''); setProcLocation(''); setProcItems([]); setProcCatId(''); setProcSupplyId(''); setProcQty(1); setProcPrice(0); setEditingProcSupplyId(''); setEditingHistoryProcId('');
    }
  }, [activeTab]);

  const handleAddProcItem = () => {
    const qty = Number(procQty) || 0;
    const price = Number(procPrice) || 0;
    if (!procCatId || !procSupplyId) {
      return requestAction('請選取物品類別與名稱！', () => {}, '確定');
    }
    if (qty <= 0 || price <= 0) {
      return requestAction('數量與單價必須大於 0 唷！', () => {}, '確定');
    }
    const supply = supplies.find(s => s.id === procSupplyId);
    if (!supply) return;

    if (editingProcSupplyId) {
       setProcItems(procItems.map(i => i.supplyId === editingProcSupplyId ? { supplyId: procSupplyId, name: supply.name, quantity: qty, unitPrice: price } : i));
       setEditingProcSupplyId('');
    } else {
      const existing = procItems.find(i => i.supplyId === procSupplyId);
      if (existing) {
        setProcItems(procItems.map(i => i.supplyId === procSupplyId ? { ...i, quantity: i.quantity + qty, unitPrice: price } : i));
      } else {
        setProcItems([...procItems, { supplyId: procSupplyId, name: supply.name, quantity: qty, unitPrice: price }]);
      }
    }
    setProcCatId(''); setProcSupplyId(''); setProcQty(1); setProcPrice(0);
  };

  const handleEditProcItem = (item: ProcurementItem) => {
    const supply = supplies.find(s => s.id === item.supplyId);
    if (supply) {
      setProcCatId(supply.categoryId); setProcSupplyId(item.supplyId); setProcQty(item.quantity); setProcPrice(item.unitPrice); setEditingProcSupplyId(item.supplyId); setProcAddMode('single');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRemoveProcItem = (id: string) => requestAction('確定要從採購清單中移除這個品項嗎？', () => {
    setProcItems(prev => prev.filter(i => i.supplyId !== id));
  }, '確定刪除');

  const handleAddBulkProcItems = () => {
    if (bulkSelectedSupplies.length === 0) return requestAction('請先勾選要加入的品項！', () => {}, '確定');
    requestAction(`確定要將這 ${bulkSelectedSupplies.length} 項物品加入到下方的採購清單中嗎？`, () => {
      let newItems = [...procItems];
      bulkSelectedSupplies.forEach(id => {
        const supply = supplies.find(s => s.id === id);
        if (!supply) return;
        const existing = newItems.find(i => i.supplyId === id);
        if (existing) newItems = newItems.map(i => i.supplyId === id ? { ...i, quantity: i.quantity + 1 } : i);
        else newItems.push({ supplyId: id, name: supply.name, quantity: 1, unitPrice: supply.price || 0 });
      });
      setProcItems(newItems); setBulkSelectedSupplies([]);
    }, '確認加入', 'bg-orange-500 hover:bg-orange-600 shadow-orange-200');
  };

  const handleSelectLowStock = () => {
    const lowStockIds = procFilteredSupplies.filter(s => s.quantity < s.minQuantity).map(s => s.id);
    if (lowStockIds.length === 0) return requestAction('目前類別沒有低於安全存量的物品！', () => {}, '確定');
    setBulkSelectedSupplies(prev => Array.from(new Set([...prev, ...lowStockIds])));
  };

  const handleSaveProcurement = async () => {
    if (!procDate || !procLocation || procItems.length === 0) {
      return requestAction('請填寫日期、地點並至少加入一項物品！', () => {}, '確定');
    }
    const totalAmount = procItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    requestAction('確定要儲存這筆採購單嗎？', async () => {
      try {
        if (editingHistoryProcId) {
          await updateDoc(doc(db, 'procurements', editingHistoryProcId), { date: procDate, location: procLocation, items: procItems, totalAmount, updatedAt: serverTimestamp() });
        } else {
          const serial = await getNextSerial('PROC');
          await setDoc(doc(db, 'procurements', serial), { id: serial, date: procDate, location: procLocation, items: procItems, totalAmount, isRestocked: false, createdAt: serverTimestamp() });
          const reqSnap = await getDocs(collection(db, 'requests'));
          const purchasingReqs = reqSnap.docs.filter(doc => doc.data().status === 'purchasing');
          for (const r of purchasingReqs) await updateDoc(doc(db, 'requests', r.id), { status: 'pending-restock' });
        }
        setProcDate(''); setProcLocation(''); setProcItems([]); setProcCatId(''); setProcSupplyId(''); setProcQty(1); setProcPrice(0); setEditingProcSupplyId(''); setEditingHistoryProcId(''); fetchData();
      } catch (e: any) { alert('儲存失敗：' + e.message); }
    });
  };

  const processRestock = async (procList: ProcurementRecord[], date: string) => {
    try {
      for (const proc of procList) {
        if (proc.isRestocked) continue;
        for (const item of proc.items) {
          const supplyRef = doc(db, 'supplies', item.supplyId);
          const supplyDoc = await getDoc(supplyRef);
          if (supplyDoc.exists()) {
            const currentQty = supplyDoc.data().quantity || 0;
            await updateDoc(supplyRef, { quantity: currentQty + item.quantity });
          }
        }
        await updateDoc(doc(db, 'procurements', proc.id), { isRestocked: true, restockDate: date });
      }
      const reqSnap = await getDocs(collection(db, 'requests'));
      const pendingRestockReqs = reqSnap.docs.filter(doc => doc.data().status === 'pending-restock');
      for (const r of pendingRestockReqs) await updateDoc(doc(db, 'requests', r.id), { status: 'restocked' });
      fetchData();
    } catch (e: any) { alert('入庫失敗：' + e.message); }
  };

  const handleRestockModalConfirm = () => {
    setRestockDateModalOpen(false);
    requestAction('確定要將採購單的物品進行入庫嗎？入庫後將無法修改與刪除。', async () => {
      if (targetProcForRestock) await processRestock([targetProcForRestock], restockDate);
      else if (selectedProcs.length > 0) await processRestock(procurements.filter(p => selectedProcs.includes(p.id)), restockDate);
      setSelectedProcs([]); setTargetProcForRestock(null);
    });
  };

  const openRestockModal = (proc?: ProcurementRecord) => {
    setRestockDate(new Date().toISOString().split('T')[0]);
    if (proc) setTargetProcForRestock(proc);
    else { if (selectedProcs.length === 0) return requestAction('請先勾選要入庫的採購單！', () => {}, '確定'); setTargetProcForRestock(null); }
    setRestockDateModalOpen(true);
  };

  const handleEditProcurementHistory = (proc: ProcurementRecord) => {
    if (proc.isRestocked) return requestAction('已入庫的採購單無法修改！', () => {}, '確定');
    setProcDate(proc.date); setProcLocation(proc.location); setProcItems(proc.items); setEditingHistoryProcId(proc.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProcurement = (id: string) => requestAction('確定要刪除這筆採購單嗎？', async () => {
    try { await deleteDoc(doc(db, 'procurements', id)); fetchData(); }
    catch (e: any) { alert('刪除失敗：' + e.message); }
  }, '確定刪除');

  const procFilteredSupplies = supplies.filter(s => procCatId ? s.categoryId === procCatId : true);
  const filteredProcurements = procurements.filter(p => {
    if (procStartDate && p.date < procStartDate) return false;
    if (procEndDate && p.date > procEndDate) return false;
    if (procHistoryStatusFilter === 'pending' && p.isRestocked) return false;
    if (procHistoryStatusFilter === 'restocked' && !p.isRestocked) return false;
    return true;
  });
  const paginatedProcs = filteredProcurements.slice((procPage - 1) * procPerPage, procPage * procPerPage);
  const totalProcPages = Math.ceil(filteredProcurements.length / procPerPage) || 1;

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto">
      <ConfirmModal isOpen={confirmOpen} title="確認執行" message={confirmMessage} onConfirm={confirmAction} onCancel={() => setConfirmOpen(false)} confirmText={confirmBtnText} confirmColor={confirmBtnColor} />
      
      {restockDateModalOpen && (
        <div className="fixed inset-0 bg-sky-100/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full border-2 border-sky-100 shadow-xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-sky-600"><Calendar className="w-5 h-5"/> 選取入庫日期</h2>
            <div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-2">入庫日期</label><input type="date" value={restockDate} onChange={e => setRestockDate(e.target.value)} className="w-full p-3 border-2 border-sky-100 rounded-xl focus:outline-none focus:border-sky-300" /></div>
            <div className="flex gap-3"><button onClick={() => setRestockDateModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold">取消</button><button onClick={handleRestockModalConfirm} className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-xl font-bold">確認入庫</button></div>
          </div>
        </div>
      )}

      <Link href="/" className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1"><ArrowLeft className="w-4 h-4" /> 回首頁</Link>

      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div><h1 className="text-4xl font-extrabold text-sky-500 flex items-center gap-3"><Sparkles className="text-yellow-400 w-8 h-8 animate-pulse" /> 用品管理</h1><p className="text-gray-500 mt-2 ml-1">全方位的辦公室資源後台 🎀</p></div>
        {activeTab === 'supplies' && <button onClick={() => { setEditingSupply(null); setIsSupplyFormOpen(true); }} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-sky-200 transition-transform hover:scale-105 flex items-center gap-2"><Plus className="w-5 h-5" /> 新增物品</button>}
      </header>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-6 pt-3 px-2 custom-scrollbar">
        <button onClick={() => setActiveTab('supplies')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'supplies' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}><Package className="w-5 h-5" /> 物品管理</button>
        <button onClick={() => setActiveTab('categories')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'categories' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}><Tag className="w-5 h-5" /> 物品類別</button>
        <button onClick={() => setActiveTab('icons')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'icons' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}><ImageIcon className="w-5 h-5" /> 插圖管理</button>
        <button onClick={() => setActiveTab('procurement')} className={`relative flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'procurement' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}>
          <ShoppingCart className="w-5 h-5" /> 物品採買
          {purchasingRequests.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 z-10">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-6 w-6 bg-orange-500 text-[10px] text-white items-center justify-center border-2 border-white shadow-sm font-black">{purchasingRequests.length}</span>
            </span>
          )}
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-sky-100">
        {activeTab === 'categories' && (
          <div><h2 className="text-xl font-bold text-gray-800 mb-4">{catId ? '編輯類別' : '新增類別'}</h2><div className="flex gap-4 mb-8"><input type="text" value={catName} onChange={e => setCatName(e.target.value)} placeholder="類別名稱" className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" /><button onClick={handleSaveCategory} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> {catId ? '儲存' : '新增'}</button>{catId && <button onClick={() => { setCatId(''); setCatName(''); }} className="bg-gray-100 text-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold">取消</button>}</div><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{categories.map(cat => (<div key={cat.id} className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex justify-between items-center group"><span className="font-bold text-gray-700">{cat.name}</span><div className="flex gap-2 opacity-0 group-hover:opacity-100"><button onClick={() => {setCatId(cat.id); setCatName(cat.name);}} className="text-sky-500 hover:text-sky-600"><Edit3 className="w-4 h-4" /></button><button onClick={() => handleDeleteCategory(cat.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div></div>))}</div></div>
        )}

        {activeTab === 'icons' && (
          <div><h2 className="text-xl font-bold text-gray-800 mb-4">{iconId ? '編輯插圖' : '新增插圖'}</h2><div className="flex flex-col md:flex-row gap-4 mb-8"><select value={iconCategoryId} onChange={e => setIconCategoryId(e.target.value)} className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300"><option value="">-- 先選取物品類別 --</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="flex items-center gap-2 flex-[1.5]"><div className="p-2 bg-sky-50 rounded-xl">{React.createElement((Icons as any)[iconName] || Icons.HelpCircle, { className: 'w-6 h-6 text-sky-500' })}</div><select value={iconName} onChange={e => { setIconName(e.target.value); if(!iconId) setIconLabel(LUCIDE_ICONS_MAP[e.target.value] || ''); }} disabled={!iconCategoryId} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300 disabled:opacity-50">{LUCIDE_ICONS_LIST.map(name => <option key={name} value={name}>{LUCIDE_ICONS_MAP[name]}</option>)}</select></div><input type="text" value={iconLabel} onChange={e => setIconLabel(e.target.value)} placeholder="自訂中文名稱" className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" /><div className="flex gap-2"><button onClick={handleSaveIcon} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-xl font-bold whitespace-nowrap"><Plus className="w-5 h-5" /> {iconId ? '儲存' : '新增'}</button>{iconId && <button onClick={() => { setIconId(''); setIconCategoryId(''); setIconLabel(LUCIDE_ICONS_MAP[LUCIDE_ICONS_LIST[0]]); setIconName(LUCIDE_ICONS_LIST[0]); }} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold">取消</button>}</div></div><div className="mb-6 flex items-center gap-2 border-t-2 border-b-2 border-dashed border-sky-100 py-6"><span className="font-bold text-gray-600">依類別篩選：</span><select value={iconCategoryFilter} onChange={e => setIconCategoryFilter(e.target.value)} className="rounded-xl border-2 border-sky-100 px-4 py-1 focus:outline-none focus:border-sky-300"><option value="">全部類別</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">{filteredIcons.map(icon => { const IconComp = (Icons as any)[icon.name] || Icons.HelpCircle; const cName = categories.find(c => c.id === icon.categoryId)?.name || '未知'; return (<div key={icon.id} className="bg-white border-2 border-sky-100 rounded-2xl p-4 flex flex-col items-center group shadow-sm"><IconComp className="w-10 h-10 text-sky-500 mb-2" /><span className="font-bold text-gray-700 text-center">{icon.label}</span><span className="text-xs text-sky-500 font-medium bg-sky-50 px-2 py-1 rounded-lg mt-2">{cName}</span><div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100"><button onClick={() => {setIconId(icon.id); setIconCategoryId(icon.categoryId); setIconLabel(icon.label); setIconName(icon.name);}} className="text-sky-500 hover:text-sky-600"><Edit3 className="w-4 h-4" /></button><button onClick={() => handleDeleteIcon(icon.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div></div>)})}</div></div>
        )}

        {activeTab === 'supplies' && (
          <div><div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-dashed border-sky-100 pb-6"><div className="flex items-center gap-2"><span className="font-bold text-gray-600">篩選：</span><select value={supplyCategoryFilter} onChange={e => { setSupplyCategoryFilter(e.target.value); setSupplyPage(1); }} className="rounded-xl border-2 border-sky-100 px-4 py-1"><option value="">全部類別</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="text" placeholder="關鍵字搜尋..." value={supplyKeywordFilter} onChange={e => { setSupplyKeywordFilter(e.target.value); setSupplyPage(1); }} className="rounded-xl border-2 border-sky-100 px-4 py-1 w-40" /></div><div className="bg-sky-50 px-4 py-2 rounded-xl text-sky-600 font-bold border border-sky-100">{supplyCategoryFilter ? categories.find(c => c.id === supplyCategoryFilter)?.name : '全部類別'} 總計 {filteredSupplies.length} 項</div></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{paginatedSupplies.map(item => (<ItemCard key={item.id} item={item} categories={categories} icons={icons} onEdit={(item) => { setEditingSupply(item); setIsSupplyFormOpen(true); }} onDelete={handleDeleteSupply} />))}</div>{totalSupplyPages > 1 && (<div className="flex justify-center items-center gap-4 mt-8"><button disabled={supplyPage === 1} onClick={() => setSupplyPage(p => p - 1)} className="px-4 py-2 bg-sky-50 rounded-xl font-bold disabled:opacity-50 font-bold">上一頁</button><span className="font-bold">{supplyPage} / {totalSupplyPages}</span><button disabled={supplyPage === totalSupplyPages} onClick={() => setSupplyPage(p => p + 1)} className="px-4 py-2 bg-sky-50 rounded-xl font-bold disabled:opacity-50 font-bold">下一頁</button></div>)}</div>
        )}

        {activeTab === 'procurement' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-orange-50 border-2 border-orange-100 rounded-3xl p-6 mb-8 shadow-sm">
              <h2 className="text-2xl font-black text-orange-700 mb-6 flex items-center gap-2">{editingHistoryProcId ? <Edit3 className="w-6 h-6"/> : <Plus className="w-6 h-6"/>} {editingHistoryProcId ? `修改採購單 (${editingHistoryProcId})` : '新增採購單'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><div className="space-y-1"><label className="block text-sm font-bold text-gray-700 ml-1">採買日期</label><input type="date" value={procDate} onChange={e => setProcDate(e.target.value)} className="w-full rounded-xl border-2 border-orange-200 px-4 py-2 focus:border-orange-400 focus:outline-none" /></div><div className="space-y-1"><label className="block text-sm font-bold text-gray-700 ml-1">採買地點</label><input type="text" value={procLocation} onChange={e => setProcLocation(e.target.value)} placeholder="例如：文具王" className="w-full rounded-xl border-2 border-orange-200 px-4 py-2 focus:border-orange-400 focus:outline-none" /></div></div>
              <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden mb-6 shadow-sm"><div className="flex bg-orange-100/50"><button onClick={() => setProcAddMode('single')} className={`flex-1 py-3 text-sm font-black transition-all ${procAddMode === 'single' ? 'bg-white text-orange-600 border-t-4 border-orange-500 shadow-sm' : 'text-gray-500 hover:bg-orange-100'}`}>單筆加入</button><button onClick={() => setProcAddMode('bulk')} className={`flex-1 py-3 text-sm font-black transition-all ${procAddMode === 'bulk' ? 'bg-white text-orange-600 border-t-4 border-orange-500 shadow-sm' : 'text-gray-500 hover:bg-orange-100'}`}>批次加入品項</button></div>
                <div className="p-5">{procAddMode === 'single' ? (
                  <div className="flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 space-y-1"><label className="text-[10px] font-bold text-gray-400">物品類別</label><select value={procCatId} onChange={e => {setProcCatId(e.target.value); setProcSupplyId('');}} className="w-full rounded-xl border-2 border-orange-100 px-3 py-2 outline-none"><option value="">-- 請選取 --</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div className="flex-[2] space-y-1"><label className="text-[10px] font-bold text-gray-400">物品名稱</label><select value={procSupplyId} onChange={e => { setProcSupplyId(e.target.value); const s = supplies.find(sup => sup.id === e.target.value); if(s) setProcPrice(s.price || 0); }} disabled={!procCatId} className="w-full rounded-xl border-2 border-orange-100 px-3 py-2 outline-none disabled:opacity-50"><option value="">-- 請選取 --</option>{procFilteredSupplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                    <div className="w-24 space-y-1"><label className="text-[10px] font-bold text-gray-400">數量</label><input type="number" value={procQty} onChange={e => setProcQty(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full rounded-xl border-2 border-orange-100 px-3 py-2 text-center" /></div>
                    <div className="w-24 space-y-1"><label className="text-[10px] font-bold text-gray-400">單價($)</label><input type="number" value={procPrice} onChange={e => setProcPrice(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full rounded-xl border-2 border-orange-100 px-3 py-2 text-center" /></div>
                    <button onClick={handleAddProcItem} className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-orange-600 transition-colors h-[44px]">儲存品項</button>
                  </div>
                ) : (
                  <div><div className="flex gap-2 mb-4 items-center"><select value={procCatId} onChange={e => setProcCatId(e.target.value)} className="rounded-xl border-2 border-orange-100 px-3 py-2 text-sm"><option value="">全部類別</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button onClick={handleSelectLowStock} className="text-xs bg-red-50 text-red-600 font-bold px-3 py-2 rounded-lg border border-red-100">全選低庫存</button><button onClick={handleAddBulkProcItems} disabled={bulkSelectedSupplies.length === 0} className="text-xs bg-orange-500 text-white font-bold px-3 py-2 rounded-lg disabled:opacity-50">批次加入 ({bulkSelectedSupplies.length})</button></div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">{procFilteredSupplies.map(s => (<label key={s.id} className={`flex flex-col p-2 rounded-xl border-2 cursor-pointer transition-all ${bulkSelectedSupplies.includes(s.id) ? 'bg-orange-50 border-orange-400 scale-[0.98]' : 'bg-white border-gray-50'}`}><div className="flex gap-1 items-start"><input type="checkbox" checked={bulkSelectedSupplies.includes(s.id)} onChange={e => { if(e.target.checked) setBulkSelectedSupplies([...bulkSelectedSupplies, s.id]); else setBulkSelectedSupplies(bulkSelectedSupplies.filter(id => id !== s.id)); }} /><span className="text-xs font-bold truncate">{s.name}</span></div><div className="text-[10px] text-gray-400 mt-1">單價: ${s.price} | 庫存: {s.quantity}</div></label>))}</div></div>
                )}</div></div>
              {procItems.length > 0 && (<div className="bg-white rounded-2xl p-5 border border-orange-100 mb-6 shadow-sm animate-in zoom-in-95 duration-200"><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-400"><th className="pb-2 w-10">序號</th><th className="pb-2">名稱</th><th className="pb-2">數量</th><th className="pb-2">單價</th><th className="pb-2">小計</th><th className="pb-2 text-right">操作</th></tr></thead><tbody>{procItems.map((it, i) => (<tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-orange-50/30"><td className="py-2 text-gray-400">{i+1}</td><td className="py-2 font-bold">{it.name}</td><td className="py-2 text-orange-500 font-black">x{it.quantity}</td><td className="py-2">${it.unitPrice}</td><td className="py-2 font-bold text-gray-700">${(it.quantity*it.unitPrice).toLocaleString()}</td><td className="py-2 text-right"><button onClick={() => handleEditProcItem(it)} className="text-sky-500 p-1 mr-1 hover:scale-110 transition-transform"><Edit3 className="w-4 h-4"/></button><button onClick={() => handleRemoveProcItem(it.supplyId)} className="text-red-400 p-1 hover:scale-110 transition-transform"><Trash2 className="w-4 h-4"/></button></td></tr>))}</tbody></table><div className="flex justify-between items-end mt-4"><div className="text-xs text-gray-400 font-bold">品項總數: {procItems.length} 項</div><div className="text-2xl font-black text-orange-600">總計金額: ${procItems.reduce((s, it) => s + (it.quantity*it.unitPrice), 0).toLocaleString()}</div></div></div>)}
              <button onClick={handleSaveProcurement} disabled={procItems.length === 0} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black text-xl shadow-lg transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-50">{editingHistoryProcId ? '儲存修改單據' : '儲存這筆採購單 ✨'}</button>{editingHistoryProcId && <button onClick={() => { setEditingHistoryProcId(''); setProcItems([]); }} className="w-full mt-3 bg-gray-100 py-3 rounded-2xl font-bold text-gray-500">取消修改</button>}
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b-2 border-gray-100 pb-2 flex items-center justify-between"><span>採購清單 (總計 {filteredProcurements.length} 筆)</span></h2>
            <div className="flex flex-col md:flex-row gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 items-center"><div className="flex items-center gap-2"><span className="text-sm font-bold">查詢：</span><input type="date" value={procStartDate} onChange={e => setProcStartDate(e.target.value)} className="rounded-lg border-2 border-gray-200 px-2 py-1 outline-none" /><span className="text-gray-400">~</span><input type="date" value={procEndDate} onChange={e => setProcEndDate(e.target.value)} className="rounded-lg border-2 border-gray-200 px-2 py-1 outline-none" /><select value={procHistoryStatusFilter} onChange={e => setProcHistoryStatusFilter(e.target.value)} className="rounded-lg border-2 border-gray-200 px-2 py-1 text-sm outline-none"><option value="All">全部狀態</option><option value="pending">待入庫</option><option value="restocked">已入庫</option></select></div><div className="flex-1"></div><button onClick={() => openRestockModal()} disabled={selectedProcs.length === 0} className="bg-green-500 hover:bg-green-600 transition-colors text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-1"><Package className="w-4 h-4"/> 批次入庫 ({selectedProcs.length})</button></div>
            <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-sky-100"><table className="w-full text-left text-sm border-collapse"><thead><tr className="bg-sky-50 text-sky-700"><th className="py-3 pl-4 rounded-tl-xl w-16"><div className="flex flex-col items-start gap-1"><button onClick={() => setSelectedProcs(paginatedProcs.filter(p => !p.isRestocked).map(p => p.id))} className="text-[10px] bg-sky-200 px-1 rounded hover:bg-sky-300">全選</button><input type="checkbox" onChange={e => { if(e.target.checked) setSelectedProcs(paginatedProcs.filter(p => !p.isRestocked).map(p => p.id)); else setSelectedProcs(selectedProcs.filter(id => !paginatedProcs.find(p => p.id === id))); }} checked={paginatedProcs.length > 0 && paginatedProcs.filter(p => !p.isRestocked).every(p => selectedProcs.includes(p.id))} className="w-4 h-4 ml-1" /></div></th><th className="py-3 font-bold text-center">序號</th><th className="py-3 font-bold">單號</th><th className="py-3 font-bold">日期/地點</th><th className="py-3 font-bold text-center">狀態</th><th className="py-3 font-bold">金額</th><th className="py-3 font-bold text-right pr-4">操作</th></tr></thead><tbody>{paginatedProcs.map((p, i) => (<tr key={p.id} className="border-b last:border-0 hover:bg-sky-50/50 transition-colors"><td className="py-3 pl-5">{!p.isRestocked && <input type="checkbox" checked={selectedProcs.includes(p.id)} onChange={e => { if(e.target.checked) setSelectedProcs([...selectedProcs, p.id]); else setSelectedProcs(selectedProcs.filter(id => id !== p.id)); }} className="w-4 h-4" />}</td><td className="py-3 text-center text-gray-400">{(procPage-1)*procPerPage+i+1}</td><td className="py-3 font-bold text-gray-800">{p.id}</td><td className="py-3"><div>{p.date}</div><div className="text-[10px] text-gray-400 font-medium">{p.location}</div></td><td className="py-3 text-center">{p.isRestocked ? <span className="text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-lg font-black whitespace-nowrap">已入庫</span> : <span className="text-[10px] bg-yellow-100 text-yellow-600 px-2 py-1 rounded-lg font-black whitespace-nowrap">待入庫</span>}</td><td className="py-3"><div className="font-bold text-orange-500">${p.totalAmount.toLocaleString()}</div></td><td className="py-3 text-right pr-4"><div className="flex justify-end gap-1">{!p.isRestocked && <><button onClick={() => handleEditProcurementHistory(p)} className="p-1.5 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-colors"><Edit3 className="w-4 h-4"/></button><button onClick={() => openRestockModal(p)} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"><Package className="w-4 h-4"/></button></>}<button onClick={() => handleDeleteProcurement(p.id)} disabled={p.isRestocked} className="p-1.5 bg-red-50 text-red-500 rounded-lg disabled:opacity-30 hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4"/></button></div></td></tr>))}</tbody></table></div>{totalProcPages > 1 && (<div className="flex justify-center items-center gap-4 mt-6"><button disabled={procPage === 1} onClick={() => setProcPage(p => p - 1)} className="px-3 py-1.5 bg-sky-50 text-sky-600 rounded-xl font-bold disabled:opacity-50">上頁</button><span className="text-sm font-bold">{procPage} / {totalProcPages}</span><button disabled={procPage === totalProcPages} onClick={() => setProcPage(p => p + 1)} className="px-3 py-1.5 bg-sky-50 text-sky-600 rounded-xl font-bold disabled:opacity-50">下頁</button></div>)}
          </div>
        )}
      </div>

      {isSupplyFormOpen && (<div className="fixed inset-0 bg-sky-100/60 z-50 flex items-center justify-center p-4"><div className="w-full max-w-md animate-in zoom-in-95 duration-200"><ItemForm initialData={editingSupply} categories={categories} icons={icons} onSubmit={handleSaveSupply} onCancel={() => { setIsSupplyFormOpen(false); setEditingSupply(null); }} /></div></div>)}
    </main>
  );
}
