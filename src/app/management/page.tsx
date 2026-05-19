"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Sparkles, Plus, Edit3, Trash2, Tag, Image as ImageIcon, ShoppingCart } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
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

  // Filters
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState('');

  // Modals
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState('');

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

      // Fetch requests that are 'purchasing'
      const rawReq = reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestRecord));
      setPurchasingRequests(rawReq.filter(r => r.status === 'purchasing'));

    } catch (error) {
      console.error('Error fetching management data', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const requestDelete = (msg: string, action: () => Promise<void>) => {
    setConfirmMessage(msg);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  // --- Category ---
  const [catId, setCatId] = useState('');
  const [catName, setCatName] = useState('');
  const handleSaveCategory = async () => {
    if (!catName) return alert('請輸入類別名稱！');
    try {
      if (catId) await updateDoc(doc(db, 'categories', catId), { name: catName, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, 'categories'), { name: catName, updatedAt: serverTimestamp() });
      setCatId(''); setCatName(''); fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); }
  };
  const handleDeleteCategory = (id: string) => requestDelete('確定要刪除這個類別嗎？', async () => {
    await deleteDoc(doc(db, 'categories', id)); fetchData();
  });

  // --- Icon ---
  const [iconId, setIconId] = useState('');
  const [iconCategoryId, setIconCategoryId] = useState('');
  const [iconName, setIconName] = useState(LUCIDE_ICONS_LIST[0]);
  const [iconLabel, setIconLabel] = useState(LUCIDE_ICONS_MAP[LUCIDE_ICONS_LIST[0]]);
  const handleSaveIcon = async () => {
    if (!iconCategoryId || !iconLabel || !iconName) return alert('請選取物品類別、輸入插圖名稱並選擇圖示！');
    try {
      if (iconId) await updateDoc(doc(db, 'icons', iconId), { categoryId: iconCategoryId, name: iconName, label: iconLabel, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, 'icons'), { categoryId: iconCategoryId, name: iconName, label: iconLabel, updatedAt: serverTimestamp() });
      setIconId(''); setIconCategoryId(''); setIconLabel(LUCIDE_ICONS_MAP[LUCIDE_ICONS_LIST[0]]); setIconName(LUCIDE_ICONS_LIST[0]); fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); }
  };
  const handleDeleteIcon = (id: string) => requestDelete('確定要刪除這個插圖嗎？', async () => {
    await deleteDoc(doc(db, 'icons', id)); fetchData();
  });

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
  const handleDeleteSupply = (id: string) => requestDelete('確定要刪除這個可愛的物品嗎？ 🥺', async () => {
    await deleteDoc(doc(db, 'supplies', id)); fetchData();
  });

  const filteredSupplies = supplyCategoryFilter ? supplies.filter(s => s.categoryId === supplyCategoryFilter) : supplies;

  // --- Procurement ---
  const [procDate, setProcDate] = useState('');
  const [procLocation, setProcLocation] = useState('');
  const [procItems, setProcItems] = useState<ProcurementItem[]>([]);
  
  const [procCatId, setProcCatId] = useState('');
  const [procSupplyId, setProcSupplyId] = useState('');
  const [procQty, setProcQty] = useState(1);
  const [procPrice, setProcPrice] = useState(0);

  // Load from purchasing requests automatically
  useEffect(() => {
    if (activeTab === 'procurement' && procItems.length === 0 && purchasingRequests.length > 0) {
      const aggregated: Record<string, { name: string, quantity: number }> = {};
      purchasingRequests.forEach(req => {
        req.items.forEach(item => {
          if (!aggregated[item.supplyId]) aggregated[item.supplyId] = { name: item.name, quantity: 0 };
          aggregated[item.supplyId].quantity += item.quantity;
        });
      });
      const newProcItems: ProcurementItem[] = Object.entries(aggregated).map(([supplyId, data]) => ({
        supplyId,
        name: data.name,
        quantity: data.quantity,
        unitPrice: 0
      }));
      setProcItems(newProcItems);
    }
  }, [activeTab, purchasingRequests]);

  const handleAddProcItem = () => {
    if (!procSupplyId || procQty <= 0) return;
    const supply = supplies.find(s => s.id === procSupplyId);
    if (!supply) return;

    const existing = procItems.find(i => i.supplyId === procSupplyId);
    if (existing) {
      setProcItems(procItems.map(i => i.supplyId === procSupplyId ? { ...i, quantity: i.quantity + procQty, unitPrice: procPrice } : i));
    } else {
      setProcItems([...procItems, { supplyId: procSupplyId, name: supply.name, quantity: procQty, unitPrice: procPrice }]);
    }
    setProcSupplyId('');
    setProcQty(1);
    setProcPrice(0);
  };

  const handleEditProcItem = (item: ProcurementItem) => {
    const supply = supplies.find(s => s.id === item.supplyId);
    if (supply) {
      setProcCatId(supply.categoryId);
      setProcSupplyId(item.supplyId);
      setProcQty(item.quantity);
      setProcPrice(item.unitPrice);
      setProcItems(procItems.filter(i => i.supplyId !== item.supplyId));
    }
  };

  const handleRemoveProcItem = (id: string) => requestDelete('確定要從採購清單中移除這個品項嗎？', async () => {
    setProcItems(procItems.filter(i => i.supplyId !== id));
  });

  const handleSaveProcurement = async () => {
    if (!procDate || !procLocation || procItems.length === 0) return alert('請填寫日期、地點並至少加入一項物品！');
    const totalAmount = procItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    try {
      await addDoc(collection(db, 'procurements'), {
        date: procDate,
        location: procLocation,
        items: procItems,
        totalAmount,
        isRestocked: false,
        createdAt: serverTimestamp()
      });
      // Optionally update purchasing requests to completed/ordered if needed. 
      // For now we just create the Procurement.
      alert('採購單建立成功！');
      setProcDate(''); setProcLocation(''); setProcItems([]); fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); }
  };

  const handleRestock = (proc: ProcurementRecord) => requestDelete(`確定要將此採購單的物品入庫嗎？總共將更新 ${proc.items.length} 項物品庫存。`, async () => {
    try {
      for (const item of proc.items) {
        const supplyRef = doc(db, 'supplies', item.supplyId);
        const supplyDoc = await getDoc(supplyRef);
        if (supplyDoc.exists()) {
          const currentQty = supplyDoc.data().quantity || 0;
          await updateDoc(supplyRef, { quantity: currentQty + item.quantity });
        }
      }
      await updateDoc(doc(db, 'procurements', proc.id), { isRestocked: true });
      alert('入庫成功！');
      fetchData();
    } catch (e: any) {
      alert('入庫失敗：' + e.message);
    }
  });

  const handleDeleteProcurement = (id: string) => requestDelete('確定要刪除這筆採購單嗎？', async () => {
    await deleteDoc(doc(db, 'procurements', id)); fetchData();
  });

  const procFilteredSupplies = supplies.filter(s => procCatId ? s.categoryId === procCatId : true);

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto">
      <ConfirmModal 
        isOpen={confirmOpen}
        title="確認執行"
        message={confirmMessage}
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />

      <Link href="/" className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1">
        <ArrowLeft className="w-4 h-4" /> 回首頁
      </Link>

      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-sky-500 flex items-center gap-3">
            <Sparkles className="text-yellow-400 w-8 h-8 animate-pulse" />
            用品管理
          </h1>
          <p className="text-gray-500 mt-2 ml-1">全方位的辦公室資源後台 🎀</p>
        </div>
        {activeTab === 'supplies' && (
          <button onClick={() => { setEditingSupply(null); setIsSupplyFormOpen(true); }} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-sky-200 transition-transform hover:scale-105 flex items-center gap-2">
            <Plus className="w-5 h-5" /> 新增物品
          </button>
        )}
      </header>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2 custom-scrollbar">
        <button onClick={() => setActiveTab('supplies')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'supplies' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}><Package className="w-5 h-5" /> 物品管理</button>
        <button onClick={() => setActiveTab('categories')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'categories' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}><Tag className="w-5 h-5" /> 物品類別</button>
        <button onClick={() => setActiveTab('icons')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'icons' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}><ImageIcon className="w-5 h-5" /> 插圖管理</button>
        <button onClick={() => setActiveTab('procurement')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'procurement' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}><ShoppingCart className="w-5 h-5" /> 物品採買</button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-sky-100">
        
        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{catId ? '編輯類別' : '新增類別'}</h2>
            <div className="flex gap-4 mb-8">
              <input type="text" value={catName} onChange={e => setCatName(e.target.value)} placeholder="類別名稱 (例如：文具)" className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
              <button onClick={handleSaveCategory} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> {catId ? '儲存' : '新增'}</button>
              {catId && <button onClick={() => { setCatId(''); setCatName(''); }} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold">取消</button>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map(cat => (
                <div key={cat.id} className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex justify-between items-center group">
                  <span className="font-bold text-gray-700">{cat.name}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                    <button onClick={() => {setCatId(cat.id); setCatName(cat.name);}} className="text-sky-500 hover:text-sky-600"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Icons Tab */}
        {activeTab === 'icons' && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{iconId ? '編輯插圖' : '新增插圖'}</h2>
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <select value={iconCategoryId} onChange={e => setIconCategoryId(e.target.value)} className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                <option value="">-- 先選取物品類別 --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <div className="flex items-center gap-2 flex-[1.5]">
                <div className="p-2 bg-sky-50 rounded-xl">
                  {React.createElement((Icons as any)[iconName] || Icons.HelpCircle, { className: 'w-6 h-6 text-sky-500' })}
                </div>
                <select value={iconName} onChange={e => { setIconName(e.target.value); if(!iconId) setIconLabel(LUCIDE_ICONS_MAP[e.target.value] || ''); }} disabled={!iconCategoryId} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300 disabled:opacity-50">
                  {LUCIDE_ICONS_LIST.map(name => <option key={name} value={name}>{LUCIDE_ICONS_MAP[name]} ({name})</option>)}
                </select>
              </div>

              <input type="text" value={iconLabel} onChange={e => setIconLabel(e.target.value)} placeholder="自訂中文名稱" className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
              
              <div className="flex gap-2">
                <button onClick={handleSaveIcon} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap"><Plus className="w-5 h-5" /> {iconId ? '儲存' : '新增'}</button>
                {iconId && <button onClick={() => { setIconId(''); setIconCategoryId(''); setIconLabel(LUCIDE_ICONS_MAP[LUCIDE_ICONS_LIST[0]]); setIconName(LUCIDE_ICONS_LIST[0]); }} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold">取消</button>}
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {icons.map(icon => {
                const IconComponent = (Icons as any)[icon.name] || Icons.HelpCircle;
                const catName = categories.find(c => c.id === icon.categoryId)?.name || '未知';
                return (
                <div key={icon.id} className="bg-white border-2 border-sky-100 rounded-2xl p-4 flex flex-col items-center group shadow-sm">
                  <IconComponent className="w-10 h-10 text-sky-500 mb-2" />
                  <span className="font-bold text-gray-700 text-center">{icon.label}</span>
                  <span className="text-xs text-sky-500 font-medium bg-sky-50 px-2 py-1 rounded-lg mt-2">{catName}</span>
                  <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100">
                    <button onClick={() => {setIconId(icon.id); setIconCategoryId(icon.categoryId); setIconLabel(icon.label); setIconName(icon.name);}} className="text-sky-500 hover:text-sky-600"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteIcon(icon.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

        {/* Supplies Tab */}
        {activeTab === 'supplies' && (
          <div>
            <div className="mb-6 flex items-center gap-2 border-b-2 border-dashed border-sky-100 pb-6">
              <span className="font-bold text-gray-600">依類別篩選：</span>
              <select 
                value={supplyCategoryFilter}
                onChange={e => setSupplyCategoryFilter(e.target.value)}
                className="rounded-xl border-2 border-sky-100 px-4 py-1 focus:outline-none focus:border-sky-300"
              >
                <option value="">全部類別</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {categories.length === 0 || icons.length === 0 ? (
              <div className="text-center py-10 bg-sky-50 rounded-2xl border border-sky-100 text-sky-700 font-bold">
                請先新增一些「物品類別」與「插圖」後，再來新增物品喔！
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSupplies.map(item => (
                  <ItemCard 
                    key={item.id} 
                    item={item} 
                    categories={categories}
                    icons={icons}
                    onEdit={(item) => { setEditingSupply(item); setIsSupplyFormOpen(true); }}
                    onDelete={handleDeleteSupply}
                  />
                ))}
                {filteredSupplies.length === 0 && <p className="col-span-full text-center text-gray-400 py-10">目前沒有符合條件的物品喔</p>}
              </div>
            )}
          </div>
        )}

        {/* Procurement Tab */}
        {activeTab === 'procurement' && (
          <div>
            {purchasingRequests.length > 0 && (
              <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl">
                <p className="font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5"/>
                  核可資料中，有已轉採購單的品項！系統已自動幫您匯入下方的採購清單。
                </p>
              </div>
            )}

            <div className="bg-orange-50 border-2 border-orange-100 rounded-2xl p-6 mb-8">
              <h2 className="text-xl font-bold text-orange-700 mb-6 flex items-center gap-2"><Plus className="w-5 h-5"/> 新增採購單</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">採買日期</label>
                  <input type="date" value={procDate} onChange={e => setProcDate(e.target.value)} className="w-full rounded-xl border-2 border-orange-100 px-4 py-2 focus:outline-none focus:border-orange-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">採買地點</label>
                  <input type="text" value={procLocation} onChange={e => setProcLocation(e.target.value)} placeholder="例如：文具王、PChome" className="w-full rounded-xl border-2 border-orange-100 px-4 py-2 focus:outline-none focus:border-orange-300" />
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-orange-100 mb-6">
                <h3 className="font-bold text-gray-700 mb-3 text-sm">加入或編輯採買品項</h3>
                <div className="flex flex-col md:flex-row gap-2">
                  <select value={procCatId} onChange={e => {setProcCatId(e.target.value); setProcSupplyId('');}} className="flex-1 rounded-xl border-2 border-orange-100 px-3 py-2">
                    <option value="">-- 先選物品類別 --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={procSupplyId} onChange={e => setProcSupplyId(e.target.value)} disabled={!procCatId} className="flex-[2] rounded-xl border-2 border-orange-100 px-3 py-2 disabled:opacity-50">
                    <option value="">-- 再選物品名稱 --</option>
                    {procFilteredSupplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <div className="flex flex-col flex-1">
                    <input type="number" placeholder="數量" value={procQty} onChange={e => setProcQty(parseInt(e.target.value))} min="1" className="w-full rounded-xl border-2 border-orange-100 px-3 py-2" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <input type="number" placeholder="單價($)" value={procPrice} onChange={e => setProcPrice(parseInt(e.target.value))} min="0" className="w-full rounded-xl border-2 border-orange-100 px-3 py-2" />
                  </div>
                  <button onClick={handleAddProcItem} className="bg-orange-400 hover:bg-orange-500 text-white px-6 py-2 rounded-xl font-bold whitespace-nowrap">儲存品項</button>
                </div>
              </div>

              {procItems.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-orange-100 mb-6">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-gray-500 text-sm border-b border-orange-100">
                        <th className="pb-2">採買品項名稱</th>
                        <th className="pb-2">數量</th>
                        <th className="pb-2">單價</th>
                        <th className="pb-2">小計金額</th>
                        <th className="pb-2 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {procItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-orange-50/50">
                          <td className="py-3 font-bold text-gray-800">{item.name}</td>
                          <td className="py-3 text-orange-500 font-bold">x {item.quantity}</td>
                          <td className="py-3 text-gray-600">${item.unitPrice}</td>
                          <td className="py-3 font-bold text-gray-800">${item.quantity * item.unitPrice}</td>
                          <td className="py-3 text-right">
                            <button onClick={() => handleEditProcItem(item)} className="p-2 text-sky-500 hover:bg-sky-100 rounded-lg mr-1"><Edit3 className="w-4 h-4"/></button>
                            <button onClick={() => handleRemoveProcItem(item.supplyId)} className="p-2 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-right pt-4 text-2xl font-extrabold text-orange-600">
                    採購總金額: ${procItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)}
                  </div>
                </div>
              )}

              <button onClick={handleSaveProcurement} disabled={procItems.length === 0} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 transition-transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg shadow-orange-200">
                儲存這筆採購單 ✨
              </button>
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-4">歷史採購紀錄</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {procurements.map(proc => (
                <div key={proc.id} className="bg-white border-2 border-sky-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-3">
                    <div>
                      <div className="font-bold text-gray-800 text-lg mb-1">{proc.location}</div>
                      <div className="text-sm text-gray-500">{proc.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-orange-500">${proc.totalAmount}</div>
                      {proc.isRestocked ? (
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-lg font-bold">已入庫</span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-1 rounded-lg font-bold">待入庫</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-4">
                    {proc.items.map(i => `${i.name} (x${i.quantity})`).join('、')}
                  </div>
                  <div className="flex gap-2">
                    {!proc.isRestocked && (
                      <button onClick={() => handleRestock(proc)} className="flex-1 bg-green-400 hover:bg-green-500 text-white py-2 rounded-xl font-bold flex justify-center items-center gap-1">
                        <Package className="w-4 h-4" /> 確認入庫
                      </button>
                    )}
                    <button onClick={() => handleDeleteProcurement(proc.id)} className="px-4 bg-gray-100 hover:bg-red-100 hover:text-red-500 text-gray-500 py-2 rounded-xl font-bold flex justify-center items-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {procurements.length === 0 && <p className="text-gray-400 col-span-full text-center py-8">沒有歷史採購紀錄</p>}
            </div>
          </div>
        )}

      </div>

      {isSupplyFormOpen && (
        <div className="fixed inset-0 bg-sky-100/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
            <ItemForm 
              initialData={editingSupply} 
              categories={categories}
              icons={icons}
              onSubmit={handleSaveSupply} 
              onCancel={() => { setIsSupplyFormOpen(false); setEditingSupply(null); }} 
            />
          </div>
        </div>
      )}
    </main>
  );
}
