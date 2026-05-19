"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Sparkles, Plus, Edit3, Trash2, Tag, Image as ImageIcon } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { OfficeSupply, Category, AppIcon, LUCIDE_ICONS_LIST } from '@/types';
import ItemForm from '@/components/ItemForm';
import ItemCard from '@/components/ItemCard';
import * as Icons from 'lucide-react';

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState<'supplies' | 'categories' | 'icons'>('supplies');
  
  // Data
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [icons, setIcons] = useState<AppIcon[]>([]);
  
  // Category Form
  const [catId, setCatId] = useState('');
  const [catName, setCatName] = useState('');
  
  // Icon Form
  const [iconId, setIconId] = useState('');
  const [iconName, setIconName] = useState(LUCIDE_ICONS_LIST[0]);
  const [iconLabel, setIconLabel] = useState('');

  // Supply Form UI state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OfficeSupply | null>(null);

  const fetchData = async () => {
    try {
      const catSnap = await getDocs(collection(db, 'categories'));
      setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      
      const iconSnap = await getDocs(collection(db, 'icons'));
      setIcons(iconSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppIcon)));

      const supSnap = await getDocs(collection(db, 'supplies'));
      setSupplies(supSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfficeSupply)));
    } catch (error) {
      console.error('Error fetching management data', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Category Handlers
  const handleSaveCategory = async () => {
    if (!catName) return alert('請輸入類別名稱！');
    try {
      if (catId) {
        await updateDoc(doc(db, 'categories', catId), { name: catName, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'categories'), { name: catName, updatedAt: serverTimestamp() });
      }
      setCatId(''); setCatName(''); fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); }
  };
  const handleDeleteCategory = async (id: string) => {
    if (!confirm('確定刪除？')) return;
    try { await deleteDoc(doc(db, 'categories', id)); fetchData(); } 
    catch (e: any) { alert('刪除失敗'); }
  };

  // Icon Handlers
  const handleSaveIcon = async () => {
    if (!iconLabel || !iconName) return alert('請輸入插圖名稱並選擇圖示！');
    try {
      if (iconId) {
        await updateDoc(doc(db, 'icons', iconId), { name: iconName, label: iconLabel, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'icons'), { name: iconName, label: iconLabel, updatedAt: serverTimestamp() });
      }
      setIconId(''); setIconLabel(''); setIconName(LUCIDE_ICONS_LIST[0]); fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); }
  };
  const handleDeleteIcon = async (id: string) => {
    if (!confirm('確定刪除？')) return;
    try { await deleteDoc(doc(db, 'icons', id)); fetchData(); } 
    catch (e: any) { alert('刪除失敗'); }
  };

  // Supply Handlers
  const handleSaveSupply = async (data: any) => {
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'supplies', editingItem.id), { ...data, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'supplies'), { ...data, updatedAt: serverTimestamp() });
      }
      setIsFormOpen(false); setEditingItem(null); fetchData();
    } catch (e: any) { alert('儲存失敗：' + e.message); setIsFormOpen(false); }
  };
  const handleDeleteSupply = async (id: string) => {
    if (!confirm('確定刪除？🥺')) return;
    try { await deleteDoc(doc(db, 'supplies', id)); fetchData(); } 
    catch (e) { alert('刪除失敗'); }
  };

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-6xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1">
        <ArrowLeft className="w-4 h-4" /> 回首頁
      </Link>

      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-sky-500 flex items-center gap-3">
            <Sparkles className="text-yellow-400 w-8 h-8 animate-pulse" />
            用品管理
          </h1>
          <p className="text-gray-500 mt-2 ml-1">管理辦公室用品、類別及可愛插圖 🎀</p>
        </div>
        {activeTab === 'supplies' && (
          <button 
            onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
            className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-sky-200 transition-transform hover:scale-105 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> 新增物品
          </button>
        )}
      </header>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        <button onClick={() => setActiveTab('supplies')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'supplies' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}>
          <Package className="w-5 h-5" /> 物品管理
        </button>
        <button onClick={() => setActiveTab('categories')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'categories' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}>
          <Tag className="w-5 h-5" /> 物品類別
        </button>
        <button onClick={() => setActiveTab('icons')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-colors ${activeTab === 'icons' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}>
          <ImageIcon className="w-5 h-5" /> 插圖管理
        </button>
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
              <input type="text" value={iconLabel} onChange={e => setIconLabel(e.target.value)} placeholder="中文名稱 (例如：原子筆)" className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
              <div className="flex items-center gap-2 flex-1">
                <div className="p-2 bg-sky-50 rounded-xl">
                  {React.createElement((Icons as any)[iconName] || Icons.HelpCircle, { className: 'w-6 h-6 text-sky-500' })}
                </div>
                <select value={iconName} onChange={e => setIconName(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                  {LUCIDE_ICONS_LIST.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveIcon} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> {iconId ? '儲存' : '新增'}</button>
                {iconId && <button onClick={() => { setIconId(''); setIconLabel(''); setIconName(LUCIDE_ICONS_LIST[0]); }} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold">取消</button>}
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
                    onEdit={(item) => { setEditingItem(item); setIsFormOpen(true); }}
                    onDelete={handleDeleteSupply}
                  />
                ))}
                {supplies.length === 0 && <p className="col-span-full text-center text-gray-400 py-10">目前沒有任何物品喔</p>}
              </div>
            )}
          </div>
        )}

      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-sky-100/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
            <ItemForm 
              initialData={editingItem} 
              categories={categories}
              icons={icons}
              onSubmit={handleSaveSupply} 
              onCancel={() => { setIsFormOpen(false); setEditingItem(null); }} 
            />
          </div>
        </div>
      )}
    </main>
  );
}