"use client";

import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-sky-900/40 backdrop-blur-sm"
          />

          {/* 視窗本體 */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl border border-sky-100/50 overflow-hidden"
          >
            {/* 裝飾背景 */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-bl-full -z-0 opacity-50" />

            <div className="relative z-10">
              <button 
                onClick={onCancel}
                className="absolute -top-2 -right-2 p-2 text-gray-400 hover:text-sky-500 hover:bg-sky-50 rounded-full transition-colors"
              >
                <X size={24} />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-sky-50 rounded-2xl shadow-inner">
                  <AlertCircle className="w-10 h-10 text-sky-500" />
                </div>
                <h2 className="text-2xl font-black text-gray-800">{title}</h2>
              </div>

              <p className="text-gray-600 mb-10 text-lg leading-relaxed font-medium">{message}</p>

              <div className="flex gap-4">
                <button 
                  onClick={onCancel}
                  className="flex-1 px-4 py-4 rounded-2xl border-2 border-gray-100 text-gray-500 font-bold hover:bg-gray-50 transition-all active:scale-95"
                >
                  取消
                </button>
                <button 
                  onClick={() => { onConfirm(); onCancel(); }}
                  className={`flex-1 px-4 py-4 rounded-2xl text-white font-bold transition-all active:scale-95 shadow-lg ${confirmColor || 'bg-sky-500 hover:bg-sky-600 shadow-sky-100'}`}
                >
                  {confirmText || '確定執行'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
