"use client";

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmColor?: string;
}

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText, confirmColor }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-sky-100/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-lg border-2 border-sky-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-sky-500">
          <div className="p-2 bg-sky-50 rounded-2xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        <p className="text-gray-600 mb-8 text-lg">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 px-4 py-3 rounded-2xl text-white font-bold transition-colors shadow-sm ${confirmColor || 'bg-red-400 hover:bg-red-500 shadow-red-200'}`}
          >
            {confirmText || '確定刪除'}
          </button>
        </div>
      </div>
    </div>
  );
}
