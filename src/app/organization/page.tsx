"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Building2, Plus, Edit3, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Department, Personnel } from '@/types';

export default function OrganizationPage() {
  const [activeTab, setActiveTab] = useState<'departments' | 'personnel'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  
  // Department Form
  const [deptId, setDeptId] = useState('');
  const [deptName, setDeptName] = useState('');
  
  // Personnel Form
  const [personId, setPersonId] = useState('');
  const [personName, setPersonName] = useState('');
  const [personDeptId, setPersonDeptId] = useState('');

  const fetchData = async () => {
    try {
      const deptSnap = await getDocs(collection(db, 'departments'));
      setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
      
      const personSnap = await getDocs(collection(db, 'personnel'));
      setPersonnel(personSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel)));
    } catch (error) {
      console.error('Error fetching organization data', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Department Handlers
  const handleSaveDept = async () => {
    if (!deptName) return alert('請輸入單位名稱！');
    try {
      if (deptId) {
        await updateDoc(doc(db, 'departments', deptId), { name: deptName, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'departments'), { name: deptName, updatedAt: serverTimestamp() });
      }
      setDeptId('');
      setDeptName('');
      fetchData();
    } catch (e: any) {
      alert('儲存失敗：' + e.message);
    }
  };

  const handleEditDept = (dept: Department) => {
    setDeptId(dept.id);
    setDeptName(dept.name);
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('確定要刪除這個單位嗎？')) return;
    try {
      await deleteDoc(doc(db, 'departments', id));
      fetchData();
    } catch (e: any) {
      alert('刪除失敗：' + e.message);
    }
  };

  // Personnel Handlers
  const handleSavePerson = async () => {
    if (!personName || !personDeptId) return alert('請輸入人員名稱並選擇所屬單位！');
    try {
      if (personId) {
        await updateDoc(doc(db, 'personnel', personId), { name: personName, departmentId: personDeptId, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'personnel'), { name: personName, departmentId: personDeptId, updatedAt: serverTimestamp() });
      }
      setPersonId('');
      setPersonName('');
      setPersonDeptId('');
      fetchData();
    } catch (e: any) {
      alert('儲存失敗：' + e.message);
    }
  };

  const handleEditPerson = (person: Personnel) => {
    setPersonId(person.id);
    setPersonName(person.name);
    setPersonDeptId(person.departmentId);
  };

  const handleDeletePerson = async (id: string) => {
    if (!confirm('確定要刪除這位人員嗎？')) return;
    try {
      await deleteDoc(doc(db, 'personnel', id));
      fetchData();
    } catch (e: any) {
      alert('刪除失敗：' + e.message);
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1">
        <ArrowLeft className="w-4 h-4" /> 回首頁
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-sky-500 flex items-center gap-3">
          <Users className="text-sky-400 w-8 h-8" />
          單位及人員資料
        </h1>
        <p className="text-gray-500 mt-2 ml-1">管理各部門單位與員工清單 🏢</p>
      </header>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('departments')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'departments' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}
        >
          <Building2 className="w-5 h-5" /> 單位管理
        </button>
        <button
          onClick={() => setActiveTab('personnel')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'personnel' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}
        >
          <Users className="w-5 h-5" /> 人員管理
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-sky-100">
        {activeTab === 'departments' && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{deptId ? '編輯單位' : '新增單位'}</h2>
            <div className="flex gap-4 mb-8">
              <input
                type="text"
                value={deptName}
                onChange={e => setDeptName(e.target.value)}
                placeholder="單位名稱 (例如：人事部)"
                className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300"
              />
              <button onClick={handleSaveDept} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors">
                <Plus className="w-5 h-5" /> {deptId ? '儲存' : '新增'}
              </button>
              {deptId && <button onClick={() => { setDeptId(''); setDeptName(''); }} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold">取消</button>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {departments.map(dept => (
                <div key={dept.id} className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex justify-between items-center group">
                  <span className="font-bold text-gray-700">{dept.name}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEditDept(dept)} className="text-sky-500 hover:text-sky-600"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteDept(dept.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            {departments.length === 0 && <p className="text-gray-400 text-center py-8">目前還沒有單位資料喔</p>}
          </div>
        )}

        {activeTab === 'personnel' && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{personId ? '編輯人員' : '新增人員'}</h2>
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <input
                type="text"
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                placeholder="人員名稱 (例如：王小明)"
                className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300"
              />
              <select
                value={personDeptId}
                onChange={e => setPersonDeptId(e.target.value)}
                className="flex-1 rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300"
              >
                <option value="">-- 選擇所屬單位 --</option>
                {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={handleSavePerson} className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors whitespace-nowrap">
                  <Plus className="w-5 h-5" /> {personId ? '儲存' : '新增'}
                </button>
                {personId && <button onClick={() => { setPersonId(''); setPersonName(''); setPersonDeptId(''); }} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold">取消</button>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {personnel.map(person => {
                const dept = departments.find(d => d.id === person.departmentId);
                return (
                  <div key={person.id} className="bg-white border-2 border-sky-100 rounded-2xl p-4 flex justify-between items-center group shadow-sm">
                    <div>
                      <div className="font-bold text-gray-800">{person.name}</div>
                      <div className="text-xs text-sky-500 font-medium bg-sky-50 px-2 py-0.5 rounded-full inline-block mt-1">
                        {dept ? dept.name : '未知單位'}
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditPerson(person)} className="text-sky-500 hover:text-sky-600"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeletePerson(person.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            {personnel.length === 0 && <p className="text-gray-400 text-center py-8">目前還沒有人員資料喔</p>}
          </div>
        )}
      </div>
    </main>
  );
}
