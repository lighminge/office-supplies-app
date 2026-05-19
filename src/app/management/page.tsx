"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Sparkles, Plus, Edit3, Trash2, Tag, Image as ImageIcon, ClipboardList, ShoppingCart, Printer } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { OfficeSupply, Category, AppIcon, LUCIDE_ICONS_LIST, LUCIDE_ICONS_MAP, RequestRecord, Department, Personnel, ProcurementRecord, ProcurementItem } from '@/types';
import ItemForm from '@/components/ItemForm';
import ItemCard from '@/components/ItemCard';
import ConfirmModal from '@/components/ConfirmModal';
import * as Icons from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

type TabType = 'supplies' | 'categories' | 'icons' | 'requests' | 'procurement';

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('supplies');
  
  // Data
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [icons, setIcons] = useState<AppIcon[]>([]);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [procurements, setProcurements] = useState<ProcurementRecord[]>([]);
  
  // Dependencies for requests/procurement
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);

  // Modals
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState('');

  const fetchData = async () => {
    try {
      const [catSnap, iconSnap, supSnap, reqSnap, procSnap, deptSnap, perSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'icons')),
        getDocs(collection(db, 'supplies')),
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'procurements')),
        getDocs(collection(db, 'departments')),
        getDocs(collection(db, 'personnel')),
      ]);

      setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      setIcons(iconSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppIcon)));
      setSupplies(supSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfficeSupply)));
      
      const rawReq = reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestRecord));
      setRequests(rawReq.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      
      const rawProc = procSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcurementRecord));
      setProcurements(rawProc.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));

      setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
      setPersonnel(perSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel)));
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
  const [iconName, setIconName] = useState(LUCIDE_ICONS_LIST[0]);
  const [iconLabel, setIconLabel] = useState(LUCIDE_ICONS_MAP[LUCIDE_ICONS_LIST[0]]);
  const handleSaveIcon = async () => {
    if (!iconLabel || !iconName) return alert('請輸入插圖名稱並選擇圖示！');
    try {
      if (iconId) await updateDoc(doc(db, 'icons', iconId), { name: iconName, label: iconLabel, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, 'icons'), { name: iconName, label: iconLabel, updatedAt: serverTimestamp() });
      setIconId(''); setIconLabel(LUCIDE_ICONS_MAP[LUCIDE_ICONS_LIST[0]]); setIconName(LUCIDE_ICONS_LIST[0]); fetchData();
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

  // --- Requests ---
  const [reqDeptFilter, setReqDeptFilter] = useState('');
  const [reqPersonFilter, setReqPersonFilter] = useState('');
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const printRequestRef = useRef<HTMLDivElement>(null);
  const [printingRequest, setPrintingRequest] = useState<RequestRecord | null>(null);

  const handlePrintRequest = useReactToPrint({
    content: () => printRequestRef.current,
    documentTitle: `用品申請單`,
    onAfterPrint: () => setPrintingRequest(null)
  });

  const handleDeleteRequest = (id: string) => requestDelete('確定要刪除這筆申請單嗎？', async () => {
    await deleteDoc(doc(db, 'requests', id)); fetchData();
  });

  const triggerPrintRequest = (req: RequestRecord) => {
    setPrintingRequest(req);
    setTimeout(() => {
      handlePrintRequest();
    }, 100);
  };

  const handleAggregateToProcurement = () => {
    if (selectedRequests.length === 0) return alert('請先勾選申請單！');
    
    const selected = requests.filter(r => selectedRequests.includes(r.id));
    const aggregated: Record<string, { name: string, quantity: number }> = {};
    
    selected.forEach(req => {
      req.items.forEach(item => {
        if (!aggregated[item.supplyId]) {
          aggregated[item.supplyId] = { name: item.name, quantity: 0 };
        }
        aggregated[item.supplyId].quantity += item.quantity;
      });
    });

    const newProcItems: ProcurementItem[] = Object.entries(aggregated).map(([supplyId, data]) => ({
      supplyId,
      name: data.name,
      quantity: data.quantity,
      unitPrice: 0 // to be filled
    }));

    setProcItems(newProcItems);
    setProcDate(new Date().toISOString().split('T')[0]);
    setProcLocation('');
    setActiveTab('procurement');
  };

  // --- Procurement ---
  const [procDate, setProcDate] = useState('');
  const [procLocation, setProcLocation] = useState('');
  const [procItems, setProcItems] = useState<ProcurementItem[]>([]);
  
  // adding item to procurement
  const [procCatId, setProcCatId] = useState('');
  const [procSupplyId, setProcSupplyId] = useState('');
  const [procQty, setProcQty] = useState(1);
  const [procPrice, setProcPrice] = useState(0);

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

  const handleRemoveProcItem = (id: string) => {
    setProcItems(procItems.filter(i => i.supplyId !== id));
  };

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
      alert('採購單建立成功！');
      setProcDate(''); setProcLocation(''); setProcItems([]); fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); }
  };

  const handleRestock = (proc: ProcurementRecord) => requestDelete(`確定要將此採購單的物品入庫嗎？總共將更新 ${proc.items.length} 項物品庫存。`, async () => {
    try {
      // Update each supply quantity
      for (const item of proc.items) {
        const supplyRef = doc(db, 'supplies', item.supplyId);
        const supplyDoc = await getDoc(supplyRef);
        if (supplyDoc.exists()) {
          const currentQty = supplyDoc.data().quantity || 0;
          await updateDoc(supplyRef, { quantity: currentQty + item.quantity });
        }
      }
      // Mark as restocked
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


  const filteredRequests = requests.filter(r => {
    if (reqDeptFilter && r.departmentId !== reqDeptFilter) return false;
    if (reqPersonFilter && r.applicantId !== reqPersonFilter) return false;
    return true;
  });

  const reqFilteredPersonnel = personnel.filter(p => reqDeptFilter ? p.departmentId === reqDeptFilter : true);
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
        <button onClick={() => setActiveTab('requests')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'requests' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}><ClipboardList className="w-5 h-5" /> 申請資料</button>
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
              <div className="flex items-center gap-2 flex-1">
                <div className="p-2 bg-sky-50 rounded-xl">
                  {React.createElement((Icons as any)[iconName] || Icons.HelpCircle, { className: 'w-6 h-6 text-sky-500' })}
                </div>
                <select value={iconName} onChange={e => { setIconName(e.target.value); if(!iconId) setIconLabel(LUCIDE_ICONS_MAP[e.target.value] || ''); }} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                  {LUCIDE_ICONS_LIST.map(name => <option key={name} value={name}>{LUCIDE_ICONS_MAP[name]} ({name})</option>)}
                </select>
              </div>
              <input type="text" value={iconLabel} onChange={e => setIconLabel(e.target.value)} placeholder="自訂中文名稱" className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
              <div className="flex gap-2">
                <button onClick={handleSaveIcon} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap"><Plus className="w-5 h-5" /> {iconId ? '儲存' : '新增'}</button>
                {iconId && <button onClick={() => { setIconId(''); setIconLabel(LUCIDE_ICONS_MAP[LUCIDE_ICONS_LIST[0]]); setIconName(LUCIDE_ICONS_LIST[0]); }} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold">取消</button>}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {icons.map(icon => {
                const IconComponent = (Icons as any)[icon.name] || Icons.HelpCircle;
                return (
                <div key={icon.id} className="bg-white border-2 border-sky-100 rounded-2xl p-4 flex flex-col items-center group shadow-sm">
                  <IconComponent className="w-10 h-10 text-sky-500 mb-2" />
                  <span className="font-bold text-gray-700 text-center">{icon.label}</span>
                  <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100">
                    <button onClick={() => {setIconId(icon.id); setIconLabel(icon.label); setIconName(icon.name);}} className="text-sky-500 hover:text-sky-600"><Edit3 className="w-4 h-4" /></button>
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
            {categories.length === 0 || icons.length === 0 ? (
              <div className="text-center py-10 bg-sky-50 rounded-2xl border border-sky-100 text-sky-700 font-bold">
                請先新增一些「物品類別」與「插圖」後，再來新增物品喔！
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {supplies.map(item => (
                  <ItemCard 
                    key={item.id} 
                    item={item} 
                    categories={categories}
                    icons={icons}
                    onEdit={(item) => { setEditingSupply(item); setIsSupplyFormOpen(true); }}
                    onDelete={handleDeleteSupply}
                  />
                ))}
                {supplies.length === 0 && <p className="col-span-full text-center text-gray-400 py-10">目前沒有任何物品喔</p>}
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-6 bg-sky-50 p-4 rounded-2xl border border-sky-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-600 whitespace-nowrap">篩選：</span>
                <select value={reqDeptFilter} onChange={e => {setReqDeptFilter(e.target.value); setReqPersonFilter('');}} className="rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                  <option value="">全部單位</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select value={reqPersonFilter} onChange={e => setReqPersonFilter(e.target.value)} className="rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                  <option value="">全部人員</option>
                  {reqFilteredPersonnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex-1"></div>
              <button 
                onClick={handleAggregateToProcurement}
                disabled={selectedRequests.length === 0}
                className="bg-orange-400 hover:bg-orange-500 text-white px-6 py-2 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" /> 產生採購單 ({selectedRequests.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-sky-200 text-sky-700">
                    <th className="pb-3 pl-2 w-10">
                      <input 
                        type="checkbox" 
                        onChange={e => {
                          if (e.target.checked) setSelectedRequests(filteredRequests.map(r => r.id));
                          else setSelectedRequests([]);
                        }}
                        checked={selectedRequests.length === filteredRequests.length && filteredRequests.length > 0}
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
                  {filteredRequests.map(req => (
                    <tr key={req.id} className="border-b border-sky-100 hover:bg-sky-50/50">
                      <td className="py-4 pl-2">
                        <input 
                          type="checkbox"
                          checked={selectedRequests.includes(req.id)}
                          onChange={e => {
                            if(e.target.checked) setSelectedRequests([...selectedRequests, req.id]);
                            else setSelectedRequests(selectedRequests.filter(id => id !== req.id));
                          }}
                          className="w-5 h-5 rounded border-sky-300 text-sky-500 focus:ring-sky-200"
                        />
                      </td>
                      <td className="py-4 text-gray-600">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A'}</td>
                      <td className="py-4 font-bold text-gray-800">{req.departmentName}</td>
                      <td className="py-4 font-bold text-gray-800">{req.applicantName}</td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-1">
                          {req.items.map((item, idx) => (
                            <span key={idx} className="bg-white border border-sky-100 text-xs px-2 py-1 rounded-lg">
                              {item.name} <span className="text-sky-500 font-bold">x{item.quantity}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 text-right pr-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => triggerPrintRequest(req)} className="p-2 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100" title="補印申請單"><Printer className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteRequest(req.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100" title="刪除"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRequests.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">沒有符合的申請資料</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Procurement Tab */}
        {activeTab === 'procurement' && (
          <div>
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
                <h3 className="font-bold text-gray-700 mb-3 text-sm">加入採買品項</h3>
                <div className="flex flex-col md:flex-row gap-2">
                  <select value={procCatId} onChange={e => {setProcCatId(e.target.value); setProcSupplyId('');}} className="flex-1 rounded-xl border-2 border-orange-100 px-3 py-2">
                    <option value="">-- 類別 --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={procSupplyId} onChange={e => setProcSupplyId(e.target.value)} disabled={!procCatId} className="flex-[2] rounded-xl border-2 border-orange-100 px-3 py-2 disabled:opacity-50">
                    <option value="">-- 物品 --</option>
                    {procFilteredSupplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input type="number" placeholder="數量" value={procQty} onChange={e => setProcQty(parseInt(e.target.value))} min="1" className="w-20 rounded-xl border-2 border-orange-100 px-3 py-2" />
                  <input type="number" placeholder="單價($)" value={procPrice} onChange={e => setProcPrice(parseInt(e.target.value))} min="0" className="w-24 rounded-xl border-2 border-orange-100 px-3 py-2" />
                  <button onClick={handleAddProcItem} className="bg-orange-400 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold">加入</button>
                </div>
              </div>

              {procItems.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-orange-100 mb-6">
                  <table className="w-full text-left">
                    <thead><tr className="text-gray-500 text-sm border-b"><th className="pb-2">物品</th><th className="pb-2">數量</th><th className="pb-2">單價</th><th className="pb-2">小計</th><th></th></tr></thead>
                    <tbody>
                      {procItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 font-bold">{item.name}</td>
                          <td className="py-2 text-orange-500 font-bold">x{item.quantity}</td>
                          <td className="py-2">${item.unitPrice}</td>
                          <td className="py-2 font-bold text-gray-700">${item.quantity * item.unitPrice}</td>
                          <td className="py-2 text-right"><button onClick={() => handleRemoveProcItem(item.supplyId)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-right pt-4 text-xl font-extrabold text-orange-600">
                    總金額: ${procItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)}
                  </div>
                </div>
              )}

              <button onClick={handleSaveProcurement} disabled={procItems.length === 0} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold text-lg disabled:opacity-50">
                儲存採購單
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
              {procurements.length === 0 && <p className="text-gray-400 col-span-full text-center py-8">沒有採購紀錄</p>}
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

      {/* Hidden printable area for Requests */}
      <div className="hidden">
        <div ref={printRequestRef} className="p-10 font-handwriting text-gray-800 max-w-[800px] mx-auto bg-white">
          <h1 className="text-3xl font-bold text-center mb-8 border-b-2 border-gray-800 pb-4">辦公室用品申請單</h1>
          
          <div className="flex justify-between mb-8 text-lg">
            <div>
              <p className="mb-2"><span className="font-bold">申請單號：</span> {printingRequest?.id}</p>
              <p className="mb-2"><span className="font-bold">申請單位：</span> {printingRequest?.departmentName}</p>
              <p><span className="font-bold">申請人員：</span> {printingRequest?.applicantName}</p>
            </div>
            <div>
              <p><span className="font-bold">申請日期：</span> {printingRequest?.createdAt?.toDate ? printingRequest.createdAt.toDate().toLocaleDateString('zh-TW') : ''}</p>
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
              {printingRequest?.items.map((item, index) => (
                <tr key={index}>
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
