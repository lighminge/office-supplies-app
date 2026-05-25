import React from 'react';
import { OfficeSupply, Category, AppIcon } from '@/types';
import * as Icons from 'lucide-react';
import { motion } from 'framer-motion';

interface ItemCardProps {
  item: OfficeSupply;
  categories: Category[];
  icons: AppIcon[];
  onEdit: (item: OfficeSupply) => void;
  onDelete: (id: string) => void;
}

export default function ItemCard({ item, categories, icons, onEdit, onDelete }: ItemCardProps) {
  const category = categories.find(c => c.id === item.categoryId);
  const iconData = icons.find(i => i.id === item.iconId);
  const IconComponent = iconData ? (Icons as any)[iconData.name] || Icons.HelpCircle : Icons.HelpCircle;
  
  const isLowStock = item.quantity <= item.minQuantity;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      className={`relative p-6 rounded-[2.5rem] border-2 transition-all shadow-sm hover:shadow-xl hover:shadow-sky-100/50 ${
        isLowStock 
        ? 'bg-rose-50/80 border-rose-100 backdrop-blur-sm' 
        : 'bg-white/80 border-sky-100 backdrop-blur-sm'
      }`}
    >
      {isLowStock && (
        <span className="absolute -top-3 -right-3 bg-rose-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg shadow-rose-200 animate-bounce tracking-tight">
          庫存告急! 😱
        </span>
      )}
      
      <div className="flex items-start gap-5">
        <div className={`p-5 rounded-3xl shadow-inner ${
          isLowStock ? 'bg-rose-100/50 text-rose-500' : 'bg-sky-100/50 text-sky-500'
        }`}>
          <IconComponent className="w-10 h-10" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-gray-800 truncate leading-tight">{item.name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="inline-block px-3 py-1 bg-gray-100/80 text-gray-600 text-[10px] font-bold rounded-xl border border-gray-200/50">
              {category ? category.name : '未知類別'}
            </span>
            <span className="inline-block px-3 py-1 bg-sky-50/80 text-sky-600 text-[10px] font-bold rounded-xl border border-sky-100/50">
              單價: ${item.price?.toLocaleString() || 0}
            </span>
          </div>
          
          <div className="flex items-end justify-between mt-4">
            <div className="flex flex-col">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">目前庫存</span>
              <span className={`font-black text-3xl leading-none ${isLowStock ? 'text-rose-500' : 'text-sky-600'}`}>
                {item.quantity}
              </span>
            </div>
            <div className="text-gray-400 text-[10px] font-bold bg-gray-50 px-2 py-1 rounded-lg">
              安全值: {item.minQuantity}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-5 border-t-2 border-dashed border-gray-100/50">
        <button 
          onClick={() => onEdit(item)} 
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-sky-50 text-sky-600 font-bold hover:bg-sky-500 hover:text-white transition-all active:scale-95"
        >
          <Icons.Edit3 size={16} /> 編輯資料
        </button>
        <button 
          onClick={() => onDelete(item.id)} 
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-50 text-rose-500 font-bold hover:bg-rose-500 hover:text-white transition-all active:scale-95"
        >
          <Icons.Trash2 size={16} /> 移除品項
        </button>
      </div>
    </motion.div>
  );
}
