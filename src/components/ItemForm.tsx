"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { OfficeSupply, Category, AppIcon } from '@/types';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(1, '請輸入物品名稱').max(50, '名稱太長了啦 >_<'),
  categoryId: z.string().min(1, '請選擇分類'),
  quantity: z.number({ invalid_type_error: '數量必須是數字唷' }).min(0, '數量不能是負數啦'),
  minQuantity: z.number({ invalid_type_error: '安全庫存必須是數字' }).min(0, '不能是負數'),
  iconId: z.string().min(1, '請選一個可愛的圖示'),
});

type FormData = z.infer<typeof schema>;

interface ItemFormProps {
  initialData?: OfficeSupply | null;
  categories: Category[];
  icons: AppIcon[];
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export default function ItemForm({ initialData, categories, icons, onSubmit, onCancel }: ItemFormProps) {
  const { register, handleSubmit, formState: { errors }, watch, reset, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      quantity: 0,
      minQuantity: 0,
      iconId: '',
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        categoryId: initialData.categoryId,
        quantity: initialData.quantity,
        minQuantity: initialData.minQuantity,
        iconId: initialData.iconId,
      });
    } else {
      reset({
        name: '',
        categoryId: categories.length > 0 ? categories[0].id : '',
        quantity: 0,
        minQuantity: 0,
        iconId: '',
      });
    }
  }, [initialData, reset, categories]);

  const selectedCategoryId = watch('categoryId');
  const filteredIcons = icons.filter(i => i.categoryId === selectedCategoryId);

  // When category changes, reset selected icon if it's not valid for the new category
  useEffect(() => {
    if (filteredIcons.length > 0) {
      const currentIconId = watch('iconId');
      if (!filteredIcons.find(i => i.id === currentIconId)) {
        setValue('iconId', filteredIcons[0].id);
      }
    } else {
      setValue('iconId', '');
    }
  }, [selectedCategoryId, filteredIcons, setValue, watch]);

  const selectedIconId = watch('iconId');
  const selectedIconData = icons.find(i => i.id === selectedIconId);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white p-6 rounded-3xl shadow-sm border-2 border-sky-100">
      <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
        {initialData ? <Icons.Pencil className="w-5 h-5 text-sky-400" /> : <Icons.PlusCircle className="w-5 h-5 text-sky-400" />}
        {initialData ? '編輯可愛的物品' : '新增可愛的物品'}
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">物品名稱</label>
        <input 
          {...register('name')} 
          className={cn("w-full rounded-2xl border-2 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-200 transition-colors", errors.name ? "border-red-300" : "border-sky-100 focus:border-sky-300")}
          placeholder="例如：閃亮亮原子筆"
        />
        {errors.name && <p className="text-red-400 text-xs mt-1 ml-2">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">分類</label>
          <select 
            {...register('categoryId')} 
            className="w-full rounded-2xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200 bg-white"
          >
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          {errors.categoryId && <p className="text-red-400 text-xs mt-1 ml-2">{errors.categoryId.message}</p>}
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700 mb-1">插圖</label>
           <div className="flex items-center gap-2">
             <div className="p-2 bg-sky-50 rounded-xl">
               {selectedIconData ? React.createElement((Icons as any)[selectedIconData.name] || Icons.HelpCircle, { className: 'w-6 h-6 text-sky-500' }) : <Icons.HelpCircle className="w-6 h-6 text-gray-400" />}
             </div>
             <select 
              {...register('iconId')} 
              className="flex-1 rounded-2xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300 bg-white"
             >
               {filteredIcons.length === 0 && <option value="">無對應插圖</option>}
               {filteredIcons.map(icon => <option key={icon.id} value={icon.id}>{icon.label}</option>)}
             </select>
           </div>
           {errors.iconId && <p className="text-red-400 text-xs mt-1 ml-2">{errors.iconId.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">目前數量</label>
          <input 
            type="number" 
            {...register('quantity', { valueAsNumber: true })} 
            className={cn("w-full rounded-2xl border-2 px-4 py-2 focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200", errors.quantity ? "border-red-300" : "border-sky-100")}
          />
          {errors.quantity && <p className="text-red-400 text-xs mt-1 ml-2">{errors.quantity.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">安全庫存</label>
          <input 
            type="number" 
            {...register('minQuantity', { valueAsNumber: true })} 
            className={cn("w-full rounded-2xl border-2 px-4 py-2 focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200", errors.minQuantity ? "border-red-300" : "border-sky-100")}
          />
          {errors.minQuantity && <p className="text-red-400 text-xs mt-1 ml-2">{errors.minQuantity.message}</p>}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 rounded-2xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors">取消</button>
        <button type="submit" className="flex-1 px-4 py-2 rounded-2xl bg-sky-400 text-white font-medium hover:bg-sky-500 transition-colors shadow-sm shadow-sky-200">{initialData ? '儲存修改 💙' : '新增物品 ✨'}</button>
      </div>
    </form>
  );
}
