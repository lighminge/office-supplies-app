"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Search, Filter, Printer, Download, PieChart as PieChartIcon, BarChart as BarChartIcon, LineChart as LineChartIcon, Table as TableIcon } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Category, RequestRecord, ProcurementRecord, Department, Personnel, OfficeSupply } from '@/types';
import { useReactToPrint } from 'react-to-print';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

type TabType = 'list' | 'chart';
type ChartType = 'table' | 'pie' | 'bar' | 'line';

const COLORS = ['#0ea5e9', '#f43f5e', '#8b5cf6', '#10b981', '#f59e0b', '#8b5cf6', '#6366f1', '#ec4899'];

export default function ReportPage() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState<TabType>('list');
  
  // Common Filters
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  
  // List Filters
  const [docType, setDocType] = useState<'All' | 'requests' | 'procurements'>('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [keyword, setKeyword] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('All');
  const [selectedPersonId, setSelectedPersonId] = useState('All');
  
  // Chart Filters
  const [chartType, setChartType] = useState<ChartType>('table');
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [selectedSupplyIds, setSelectedSupplyIds] = useState<string[]>([]);
  const [includeAmount, setIncludeAmount] = useState(false);
  
  // Data
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [procurements, setProcurements] = useState<ProcurementRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [listPage, setListPage] = useState(1);
  const itemsPerPage = 10;

  // Print & Export Refs
  const printRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [printingRecord, setPrintingRecord] = useState<{type: 'request' | 'procurement', data: any} | null>(null);

  useEffect(() => {
    const fetchDeps = async () => {
      try {
        const [deptSnap, perSnap, catSnap, supSnap] = await Promise.all([
          getDocs(collection(db, 'departments')),
          getDocs(collection(db, 'personnel')),
          getDocs(collection(db, 'categories')),
          getDocs(collection(db, 'supplies'))
        ]);
        setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
        setPersonnel(perSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Personnel)));
        setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        setSupplies(supSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfficeSupply)));
      } catch (e) { console.error(e); }
    };
    fetchDeps();
  }, []);

  const generateReport = async () => {
    if (!startDate || !endDate) return alert("請選擇開始與結束日期！");
    setLoading(true);
    setListPage(1);
    try {
      const [reqSnap, procSnap] = await Promise.all([
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'procurements'))
      ]);
      
      let reqData = reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestRecord));
      reqData = reqData.filter(r => {
        const rDate = r.createdAt?.toDate ? r.createdAt.toDate().toISOString().split('T')[0] : '';
        return rDate >= startDate && rDate <= endDate;
      });
      setRequests(reqData);

      let procData = procSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcurementRecord));
      procData = procData.filter(p => p.date >= startDate && p.date <= endDate);
      setProcurements(procData);

    } catch (error: any) {
      alert('產生報表失敗：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- List Logic ---
  const unifiedData = [
    ...requests.map(r => ({ type: 'request' as const, date: r.createdAt?.toDate ? r.createdAt.toDate().toISOString().split('T')[0] : '', data: r })),
    ...procurements.map(p => ({ type: 'procurement' as const, date: p.date, data: p }))
  ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredUnified = unifiedData.filter(item => {
    if (docType !== 'All' && item.type !== docType) return false;
    
    if (item.type === 'request') {
      const r = item.data as RequestRecord;
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (selectedDeptId !== 'All' && r.departmentId !== selectedDeptId) return false;
      if (selectedPersonId !== 'All' && r.applicantId !== selectedPersonId) return false;
      if (keyword) {
        const match = r.items.some(i => i.name.toLowerCase().includes(keyword.toLowerCase())) || r.id.toLowerCase().includes(keyword.toLowerCase());
        if (!match) return false;
      }
    } else {
      const p = item.data as ProcurementRecord;
      if (statusFilter !== 'All') {
        if (statusFilter === 'restocked' && !p.isRestocked) return false;
        if (statusFilter === 'pending' && p.isRestocked) return false;
        // procurement doesn't have other statuses, filter out if other selected
        if (!['pending', 'restocked'].includes(statusFilter)) return false;
      }
      if (keyword) {
        const match = p.items.some(i => i.name.toLowerCase().includes(keyword.toLowerCase())) || p.id.toLowerCase().includes(keyword.toLowerCase());
        if (!match) return false;
      }
    }
    return true;
  });

  const totalPages = Math.ceil(filteredUnified.length / itemsPerPage) || 1;
  const paginatedData = filteredUnified.slice((listPage - 1) * itemsPerPage, listPage * itemsPerPage);
  const filteredPersonnel = selectedDeptId === 'All' ? personnel : personnel.filter(p => p.departmentId === selectedDeptId);

  // --- Print Logic ---
  const handlePrint = useReactToPrint({ 
    content: () => printRef.current,
    onAfterPrint: () => setPrintingRecord(null) 
  });

  const triggerPrint = (type: 'request' | 'procurement', data: any) => {
    setPrintingRecord({ type, data });
    setTimeout(handlePrint, 100);
  };

  // --- Chart Logic ---
  const chartFilteredSupplies = supplies.filter(s => selectedCatIds.length === 0 || selectedCatIds.includes(s.categoryId));

  const generateChartData = () => {
    const stats: Record<string, { name: string, quantity: number, amount: number }> = {};
    
    const countItems = (items: any[], type: 'req' | 'proc') => {
      items.forEach(item => {
        const supply = supplies.find(s => s.id === item.supplyId);
        if (!supply) return;
        if (selectedCatIds.length > 0 && !selectedCatIds.includes(supply.categoryId)) return;
        if (selectedSupplyIds.length > 0 && !selectedSupplyIds.includes(supply.id)) return;

        if (!stats[supply.name]) stats[supply.name] = { name: supply.name, quantity: 0, amount: 0 };
        
        if (type === 'req') {
           stats[supply.name].quantity += item.quantity;
           stats[supply.name].amount += item.quantity * (supply.price || 0);
        } else {
           stats[supply.name].quantity += item.quantity;
           stats[supply.name].amount += item.quantity * (item.unitPrice || supply.price || 0);
        }
      });
    };

    requests.forEach(r => countItems(r.items, 'req'));
    procurements.forEach(p => countItems(p.items, 'proc'));

    return Object.values(stats).sort((a,b) => b.quantity - a.quantity);
  };

  const chartData = generateChartData();

  const exportAsImage = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { scale: 2 });
    const link = document.createElement('a');
    link.download = `統計圖表-${getTodayStr()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportAsPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`統計圖表-${getTodayStr()}.pdf`);
  };

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1">
        <ArrowLeft className="w-4 h-4" /> 回首頁
      </Link>
      
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-sky-500 flex items-center gap-3">
          <BarChart3 className="text-sky-400 w-8 h-8" /> 統計報表
        </h1>
        <p className="text-gray-500 mt-2 ml-1">進階查詢申請與採購紀錄 📊</p>
      </header>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('list')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'list' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}>
          <Search className="w-5 h-5" /> 資料清單
        </button>
        <button onClick={() => setActiveTab('chart')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'chart' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}>
          <PieChartIcon className="w-5 h-5" /> 統計圖表
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-sky-100 mb-8">
        <h2 className="text-lg font-bold text-sky-700 mb-4 flex items-center gap-2 border-b-2 border-sky-50 pb-2"><Filter className="w-5 h-5"/> 共通查詢條件</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
          </div>
          <button onClick={generateReport} className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 h-[44px]">
            <Search className="w-4 h-4" /> 載入區間資料
          </button>
        </div>

        {activeTab === 'list' && (
          <div className="border-t-2 border-dashed border-sky-100 pt-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">單據類型</label>
                <select value={docType} onChange={e => {setDocType(e.target.value as any); setStatusFilter('All');}} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                  <option value="All">全部類型</option>
                  <option value="requests">申請單</option>
                  <option value="procurements">採購單</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">單據狀態</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                  <option value="All">全部狀態</option>
                  <option value="pending">未核可 (待入庫)</option>
                  <option value="approved">已核可</option>
                  <option value="purchasing">採購中</option>
                  <option value="pending-restock">待入庫(申請)</option>
                  <option value="restocked">已入庫</option>
                  <option value="completed">已領用(結案)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申請單位</label>
                <select value={selectedDeptId} onChange={e => {setSelectedDeptId(e.target.value); setSelectedPersonId('All');}} disabled={docType === 'procurements'} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300 disabled:opacity-50">
                  <option value="All">全部單位</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申請人員</label>
                <select value={selectedPersonId} onChange={e => setSelectedPersonId(e.target.value)} disabled={docType === 'procurements'} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300 disabled:opacity-50">
                  <option value="All">全部人員</option>
                  {filteredPersonnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2 md:col-span-3">
                 <label className="block text-sm font-medium text-gray-700 mb-1">關鍵字搜尋 (單號、物品名稱)</label>
                 <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="輸入關鍵字..." className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="border-t-2 border-dashed border-sky-100 pt-6 animate-in fade-in duration-300">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">圖表呈現方式</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setChartType('table')} className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold ${chartType === 'table' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'}`}><TableIcon className="w-4 h-4"/> 表格</button>
                    <button onClick={() => setChartType('pie')} className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold ${chartType === 'pie' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'}`}><PieChartIcon className="w-4 h-4"/> 圓餅圖</button>
                    <button onClick={() => setChartType('bar')} className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold ${chartType === 'bar' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'}`}><BarChartIcon className="w-4 h-4"/> 長條圖</button>
                    <button onClick={() => setChartType('line')} className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold ${chartType === 'line' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'}`}><LineChartIcon className="w-4 h-4"/> 折線圖</button>
                  </div>
                  
                  <label className="block text-sm font-bold text-gray-700 mt-4 mb-2 flex items-center gap-2">
                    <input type="checkbox" checked={includeAmount} onChange={e => setIncludeAmount(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-sky-500 focus:ring-sky-500" />
                    統計金額 (如未勾選則統計數量)
                  </label>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">過濾物品類別 (可複選)</label>
                    <div className="max-h-32 overflow-y-auto border-2 border-sky-100 rounded-xl p-3 bg-gray-50 flex flex-wrap gap-2">
                       {categories.map(c => (
                         <label key={c.id} className="flex items-center gap-1 text-sm bg-white border border-gray-200 px-2 py-1 rounded cursor-pointer hover:bg-sky-50">
                           <input type="checkbox" checked={selectedCatIds.includes(c.id)} onChange={e => {
                             if(e.target.checked) setSelectedCatIds([...selectedCatIds, c.id]);
                             else setSelectedCatIds(selectedCatIds.filter(id => id !== c.id));
                           }} /> {c.name}
                         </label>
                       ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">過濾指定物品 (可複選)</label>
                    <div className="max-h-32 overflow-y-auto border-2 border-sky-100 rounded-xl p-3 bg-gray-50 flex flex-wrap gap-2">
                       {chartFilteredSupplies.map(s => (
                         <label key={s.id} className="flex items-center gap-1 text-sm bg-white border border-gray-200 px-2 py-1 rounded cursor-pointer hover:bg-sky-50">
                           <input type="checkbox" checked={selectedSupplyIds.includes(s.id)} onChange={e => {
                             if(e.target.checked) setSelectedSupplyIds([...selectedSupplyIds, s.id]);
                             else setSelectedSupplyIds(selectedSupplyIds.filter(id => id !== s.id));
                           }} /> {s.name}
                         </label>
                       ))}
                       {chartFilteredSupplies.length === 0 && <span className="text-sm text-gray-400">目前類別無物品</span>}
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )}

      </div>

      {activeTab === 'list' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-sky-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">查詢結果清單</h2>
            <div className="bg-sky-100 text-sky-700 px-4 py-1.5 rounded-lg font-bold text-sm">
              查詢條件總計：{filteredUnified.length} 筆單據
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 text-sky-400 font-bold">載入中...</div>
          ) : filteredUnified.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">沒有符合條件的紀錄</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-sky-100 text-sky-700">
                    <th className="pb-3 pl-2 w-16">序號</th>
                    <th className="pb-3">類型</th>
                    <th className="pb-3">單據編號</th>
                    <th className="pb-3">日期</th>
                    <th className="pb-3">申請人 / 地點</th>
                    <th className="pb-3">物品 (數量)</th>
                    <th className="pb-3">狀態</th>
                    <th className="pb-3 text-right pr-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item, i) => {
                    const idx = (listPage - 1) * itemsPerPage + i + 1;
                    if (item.type === 'request') {
                      const req = item.data as RequestRecord;
                      return (
                        <tr key={`req-${req.id}`} className="border-b border-gray-100 hover:bg-sky-50/50">
                          <td className="py-4 pl-2 text-gray-500 font-medium">{idx}</td>
                          <td className="py-4"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">申請單</span></td>
                          <td className="py-4 font-bold text-gray-800">{req.id}</td>
                          <td className="py-4 text-gray-600">{item.date}</td>
                          <td className="py-4 font-medium text-gray-800">
                            <span className="text-lg text-sky-600">{req.applicantName}</span> <br/>
                            <span className="text-xs text-gray-500">{req.departmentName}</span>
                          </td>
                          <td className="py-4">
                            <ul className="space-y-1">
                              {req.items.map((i, idx) => (
                                <li key={idx} className="text-sm">{i.name} <span className="text-sky-500 font-bold">x{i.quantity}</span></li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-4">
                            {req.status === 'completed' ? <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold">已結案</span> :
                             req.status === 'restocked' ? <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold">已入庫</span> :
                             req.status === 'pending-restock' ? <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-lg text-xs font-bold">待入庫</span> :
                             req.status === 'purchasing' ? <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-xs font-bold">採購中</span> :
                             req.status === 'approved' ? <span className="bg-green-100 text-green-600 px-2 py-1 rounded-lg text-xs font-bold">已核可</span> :
                             <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-lg text-xs font-bold">未核可</span>}
                          </td>
                          <td className="py-4 text-right pr-2">
                             <button onClick={() => triggerPrint('request', req)} className="p-2 bg-sky-50 text-sky-500 rounded-lg hover:bg-sky-100" title="列印申請單"><Printer className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      );
                    } else {
                      const proc = item.data as ProcurementRecord;
                      return (
                        <tr key={`proc-${proc.id}`} className="border-b border-gray-100 hover:bg-sky-50/50">
                          <td className="py-4 pl-2 text-gray-500 font-medium">{idx}</td>
                          <td className="py-4"><span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">採購單</span></td>
                          <td className="py-4 font-bold text-gray-800">{proc.id}</td>
                          <td className="py-4 text-gray-600">{item.date}</td>
                          <td className="py-4 font-medium text-gray-800">{proc.location}</td>
                          <td className="py-4">
                            <ul className="space-y-1">
                              {proc.items.map((i, idx) => (
                                <li key={idx} className="text-sm">{i.name} <span className="text-orange-500 font-bold">x{i.quantity}</span></li>
                              ))}
                            </ul>
                            <div className="text-xs text-gray-500 mt-1 font-bold">總額: ${proc.totalAmount}</div>
                          </td>
                          <td className="py-4">
                            {proc.isRestocked ? <span className="bg-green-100 text-green-600 px-2 py-1 rounded-lg text-xs font-bold">已入庫</span> :
                             <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-lg text-xs font-bold">待入庫</span>}
                          </td>
                          <td className="py-4 text-right pr-2">
                            <button onClick={() => triggerPrint('procurement', proc)} className="p-2 bg-orange-50 text-orange-500 rounded-lg hover:bg-orange-100" title="列印採購單"><Printer className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8 pt-6 border-t-2 border-dashed border-sky-100">
              <button disabled={listPage === 1} onClick={() => setListPage(p => p - 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50 font-bold">上一頁</button>
              <span className="text-gray-600 font-bold">{listPage} / {totalPages}</span>
              <button disabled={listPage === totalPages} onClick={() => setListPage(p => p + 1)} className="px-4 py-2 bg-sky-50 text-sky-500 rounded-xl disabled:opacity-50 font-bold">下一頁</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'chart' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-sky-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">統計結果圖表</h2>
            <div className="flex gap-2">
               <button onClick={exportAsImage} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex items-center gap-1"><Download className="w-4 h-4"/> 匯出圖片</button>
               <button onClick={exportAsPDF} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex items-center gap-1"><Download className="w-4 h-4"/> 匯出 PDF</button>
            </div>
          </div>
          
          <div ref={chartRef} className="bg-white p-4 min-h-[400px]">
             {chartType === 'table' ? (
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b-2 border-gray-200 text-gray-600">
                     <th className="py-2">排名</th>
                     <th className="py-2">物品名稱</th>
                     <th className="py-2 text-right">總{includeAmount ? '金額' : '數量'}</th>
                   </tr>
                 </thead>
                 <tbody>
                   {chartData.map((d, i) => (
                     <tr key={i} className="border-b border-gray-100">
                       <td className="py-3 font-bold text-gray-500">{i+1}</td>
                       <td className="py-3 font-bold">{d.name}</td>
                       <td className="py-3 text-right font-extrabold text-sky-600">{includeAmount ? `$${d.amount}` : d.quantity}</td>
                     </tr>
                   ))}
                   {chartData.length === 0 && <tr><td colSpan={3} className="text-center py-10 text-gray-400">無統計資料</td></tr>}
                 </tbody>
               </table>
             ) : chartData.length > 0 ? (
               <ResponsiveContainer width="100%" height={400}>
                 {chartType === 'pie' ? (
                   <PieChart>
                     <Pie data={chartData} dataKey={includeAmount ? 'amount' : 'quantity'} nameKey="name" cx="50%" cy="50%" outerRadius={150} fill="#8884d8" label>
                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                     </Pie>
                     <Tooltip />
                     <Legend />
                   </PieChart>
                 ) : chartType === 'bar' ? (
                   <BarChart data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" />
                     <XAxis dataKey="name" />
                     <YAxis />
                     <Tooltip />
                     <Legend />
                     <Bar dataKey={includeAmount ? 'amount' : 'quantity'} fill="#0ea5e9" name={includeAmount ? '總金額' : '總數量'} />
                   </BarChart>
                 ) : (
                   <LineChart data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" />
                     <XAxis dataKey="name" />
                     <YAxis />
                     <Tooltip />
                     <Legend />
                     <Line type="monotone" dataKey={includeAmount ? 'amount' : 'quantity'} stroke="#f43f5e" name={includeAmount ? '總金額' : '總數量'} />
                   </LineChart>
                 )}
               </ResponsiveContainer>
             ) : (
               <div className="text-center py-20 text-gray-400">無統計資料</div>
             )}
          </div>
        </div>
      )}

      {/* Hidden Print Area */}
      <div className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
        <div ref={printRef} className="p-10 font-handwriting text-gray-800 w-[800px] bg-white">
          {printingRecord?.type === 'request' ? (
            <>
              <h1 className="text-3xl font-bold text-center mb-8 border-b-2 border-gray-800 pb-4">辦公室用品申請單</h1>
              <div className="flex justify-between mb-8 text-lg">
                <div>
                  <p className="mb-2"><span className="font-bold">申請單號：</span> {printingRecord.data.id}</p>
                  <p className="mb-2"><span className="font-bold">申請單位：</span> {printingRecord.data.departmentName}</p>
                  <p><span className="font-bold">申請人員：</span> {printingRecord.data.applicantName}</p>
                </div>
                <div>
                  <p><span className="font-bold">申請日期：</span> {printingRecord.data.createdAt?.toDate ? printingRecord.data.createdAt.toDate().toLocaleDateString('zh-TW') : ''}</p>
                </div>
              </div>
              <table className="w-full text-left border-collapse mb-10 text-lg">
                <thead><tr><th className="border-b-2 border-gray-800 py-2 w-16">項次</th><th className="border-b-2 border-gray-800 py-2">物品名稱</th><th className="border-b-2 border-gray-800 py-2 text-right">數量</th></tr></thead>
                <tbody>
                  {printingRecord.data.items.map((item: any, index: number) => (
                    <tr key={index}><td className="border-b border-gray-300 py-3">{index + 1}</td><td className="border-b border-gray-300 py-3">{item.name}</td><td className="border-b border-gray-300 py-3 text-right">{item.quantity}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : printingRecord?.type === 'procurement' ? (
            <>
              <h1 className="text-3xl font-bold text-center mb-8 border-b-2 border-gray-800 pb-4">辦公室物品採購單</h1>
              <div className="flex justify-between mb-8 text-lg">
                <div>
                  <p className="mb-2"><span className="font-bold">採購單號：</span> {printingRecord.data.id}</p>
                  <p className="mb-2"><span className="font-bold">採買地點：</span> {printingRecord.data.location}</p>
                </div>
                <div>
                  <p><span className="font-bold">採買日期：</span> {printingRecord.data.date}</p>
                </div>
              </div>
              <table className="w-full text-left border-collapse mb-10 text-lg">
                <thead><tr><th className="border-b-2 border-gray-800 py-2 w-16">項次</th><th className="border-b-2 border-gray-800 py-2">物品名稱</th><th className="border-b-2 border-gray-800 py-2">單價</th><th className="border-b-2 border-gray-800 py-2 text-right">數量</th><th className="border-b-2 border-gray-800 py-2 text-right">小計</th></tr></thead>
                <tbody>
                  {printingRecord.data.items.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="border-b border-gray-300 py-3">{index + 1}</td>
                      <td className="border-b border-gray-300 py-3">{item.name}</td>
                      <td className="border-b border-gray-300 py-3">${item.unitPrice}</td>
                      <td className="border-b border-gray-300 py-3 text-right">{item.quantity}</td>
                      <td className="border-b border-gray-300 py-3 text-right font-bold">${item.unitPrice * item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right text-2xl font-bold mt-4">總金額：${printingRecord.data.totalAmount}</div>
            </>
          ) : null}
        </div>
      </div>

    </main>
  );
}