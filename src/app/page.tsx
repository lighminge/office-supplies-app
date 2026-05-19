"use client";

import { useEffect, useState } from 'react';
import { OfficeSupply } from '@/types';
import ItemCard from '@/components/ItemCard';
import ItemForm from '@/components/ItemForm';
import { PlusCircle, Search, Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

export default function Home() {
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OfficeSupply | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const fetchSupplies = async () => {
    try {
      if (!db) throw new Error("Firebase db not initialized");
      const querySnapshot = await getDocs(collection(db, 'supplies'));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OfficeSupply[];
      setSupplies(data);
    } catch (error) {
      console.error('Failed to fetch supplies', error);
      // Fallback for demo when Firebase is not configured
      if (supplies.length === 0) {
          setSupplies([
            { id: '1', name: '可愛貓咪便利貼', category: '文具', quantity: 15, minQuantity: 5, iconName: 'Sticker' },
            { id: '2', name: '星空漸層原子筆', category: '文具', quantity: 2, minQuantity: 10, iconName: 'PenTool' },
            { id: '3', name: '大容量馬克杯', category: '茶水間', quantity: 5, minQuantity: 2, iconName: 'Coffee' },
          ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplies();
  }, []);

  const handleSubmit = async (data: any) => {
    try {
      if (editingItem) {
        const docRef = doc(db, 'supplies', editingItem.id);
        await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'supplies'), { ...data, updatedAt: serverTimestamp() });
      }
      setIsFormOpen(false);
      setEditingItem(null);
      fetchSupplies();
    } catch (error) {
      console.error('Error saving item', error);
      alert('儲存失敗，請確認 Firebase 設定或是網路連線是否正常！');
      setIsFormOpen(false);
      setEditingItem(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這個可愛的物品嗎？ 🥺')) return;
    try {
      await deleteDoc(doc(db, 'supplies', id));
      fetchSupplies();
    } catch (error) {
      console.error('Error deleting item', error);
      alert('刪除失敗');
    }
  };

  const categories = ['All', ...Array.from(new Set(supplies.map(s => s.category)))];

  const filteredSupplies = supplies.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-pink-500 flex items-center gap-3">
            <Sparkles className="text-yellow-400 w-8 h-8 animate-pulse" />
            辦公室用具管理小幫手
          </h1>
          <p className="text-gray-500 mt-2 ml-1">輕鬆管理所有的辦公室小物 🎀</p>
        </div>
        <button 
          onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
          className="bg-pink-400 hover:bg-pink-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-pink-200 transition-transform hover:scale-105 flex items-center gap-2"
        >
          <PlusCircle className="w-5 h-5" />
          新增物品
        </button>
      </header>

      {isFormOpen && (
        <div className="fixed inset-0 bg-pink-100/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
            <ItemForm 
              initialData={editingItem} 
              onSubmit={handleSubmit} 
              onCancel={() => { setIsFormOpen(false); setEditingItem(null); }} 
            />
          </div>
        </div>
      )}

      <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 shadow-sm border-2 border-pink-100 mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text"
            placeholder="搜尋可愛的小物..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-pink-100 focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-pink-400 text-white' : 'bg-pink-50 text-pink-500 hover:bg-pink-100'}`}
            >
              {cat === 'All' ? '全部' : cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-pink-400 font-bold">
          <Sparkles className="animate-spin w-8 h-8 mr-2" /> 載入中...
        </div>
      ) : filteredSupplies.length === 0 ? (
        <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-pink-200">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-xl text-gray-500 font-medium">找不到符合的物品耶</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSupplies.map(item => (
            <ItemCard 
              key={item.id} 
              item={item} 
              onEdit={(item) => { setEditingItem(item); setIsFormOpen(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </main>
  );
}