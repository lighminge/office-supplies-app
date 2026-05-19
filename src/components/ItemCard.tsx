import React from 'react';
import { OfficeSupply } from '@/types';
import * as Icons from 'lucide-react';

interface ItemCardProps {
  item: OfficeSupply;
  onEdit: (item: OfficeSupply) => void;
  onDelete: (id: string) => void;
}

export default function ItemCard({ item, onEdit, onDelete }: ItemCardProps) {
  const IconComponent = (Icons as any)[item.iconName] || Icons.HelpCircle;
  const isLowStock = item.quantity <= item.minQuantity;

  return (
    <div className={`relative p-5 rounded-3xl border-2 transition-all hover:-translate-y-1 hover:shadow-md ${isLowStock ? 'bg-red-50 border-red-200' : 'bg-white border-sky-100'}`}>
      {isLowStock && (
        <span className="absolute -top-3 -right-3 bg-red-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm animate-bounce">
          快用完了! 😱
        </span>
      )}
      
      <div className="flex items-start gap-4">
        <div className={`p-4 rounded-2xl ${isLowStock ? 'bg-red-100 text-red-500' : 'bg-sky-100 text-sky-500'}`}>
          <IconComponent className="w-8 h-8" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-800 truncate">{item.name}</h3>
          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg mt-1 mb-2">
            {item.category}
          </span>
          
          <div className="flex items-center gap-4 text-sm mt-2">
            <div className="flex items-center gap-1">
              <span className="text-gray-500">數量:</span>
              <span className={`font-bold text-lg ${isLowStock ? 'text-red-500' : 'text-gray-700'}`}>
                {item.quantity}
              </span>
            </div>
            <div className="text-gray-400 text-xs">
              (安全: {item.minQuantity})
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t-2 border-dashed border-gray-100">
        <button 
          onClick={() => onEdit(item)}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-blue-50 text-blue-500 font-medium hover:bg-blue-100 transition-colors"
        >
          <Icons.Edit3 className="w-4 h-4" /> 編輯
        </button>
        <button 
          onClick={() => onDelete(item.id)}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-gray-50 text-gray-500 font-medium hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <Icons.Trash2 className="w-4 h-4" /> 刪除
        </button>
      </div>
    </div>
  );
}
