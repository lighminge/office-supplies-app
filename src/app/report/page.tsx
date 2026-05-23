"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Search, Filter, Printer, PieChart as PieChartIcon, BarChart as BarChartIcon, LineChart as LineChartIcon, Table as TableIcon, Download } from 'lucide-react';
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
  
  // Filters
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [docType, setDocType] = useState<'All' | 'requests' | 'procurements'>('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [keyword, setKeyword] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('All');
  const [selectedPersonId, setSelectedPersonId] = useState('All');
  
  // Data
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [procurements, setProcurements] = useState<ProcurementRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  // Chart/Export State
  const [chartType, setChartType] = useState<ChartType>('table');
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [selectedSupplyIds, setSelectedSupplyIds] = useState<string[]>([]);
  const [includeAmount, setIncludeAmount] = useState(false);
  const [includeQuantity, setIncludeQuantity] = useState(true);
  const [procLocationFilter, setProcLocationFilter] = useState('');
  const chartRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [printingData, setPrintingData] = useState<{type: 'request' | 'procurement', data: any} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
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
    fetchData();
  }, []);

  const handlePrint = useReactToPrint({ content: () => printRef.current, documentTitle: '報表列印', onAfterPrint: () => setPrintingData(null) });
  const triggerPrint = (type: 'request' | 'procurement', data: any) => {
    setPrintingData({ type, data });
    setTimeout(handlePrint, 100);
  };

  const generateReport = async () => {
    setLoading(true); setPage(1);
    try {
      const [reqSnap, procSnap] = await Promise.all([getDocs(collection(db, 'requests')), getDocs(collection(db, 'procurements'))]);
      let rData = reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestRecord));
      rData = rData.filter(r => {
        const d = r.createdAt?.toDate ? r.createdAt.toDate().toISOString().split('T')[0] : '';
        return d >= startDate && d <= endDate;
      });
      setRequests(rData);

      let pData = procSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcurementRecord));
      pData = pData.filter(p => p.date >= startDate && p.date <= endDate);
      setProcurements(pData);
    } catch(e: any) { alert('載入失敗：' + e.message); }
    finally { setLoading(false); }
  };

  // Logic: Unified filtering and pagination
  const unifiedData = [
    ...requests.map(r => ({ type: 'request' as const, date: r.createdAt?.toDate ? r.createdAt.toDate().toISOString().split('T')[0] : '', data: r })),
    ...procurements.map(p => ({ type: 'procurement' as const, date: p.date, data: p }))
  ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredUnified = unifiedData.filter(item => {
    if (docType !== 'All' && item.type !== (docType === 'requests' ? 'request' : 'procurement')) return false;
    
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
      if (statusFilter === 'restocked' && !p.isRestocked) return false;
      if (statusFilter === 'pending' && p.isRestocked) return false;
      if (procLocationFilter && !p.location.toLowerCase().includes(procLocationFilter.toLowerCase())) return false;
      if (keyword) {
        const match = p.items.some(i => i.name.toLowerCase().includes(keyword.toLowerCase())) || p.id.toLowerCase().includes(keyword.toLowerCase());
        if (!match) return false;
      }
    }
    return true;
  });

  const totalPages = Math.ceil(filteredUnified.length / itemsPerPage) || 1;
  const paginatedData = filteredUnified.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const filteredPersonnel = selectedDeptId === 'All' ? personnel : personnel.filter(p => p.departmentId === selectedDeptId);

  // Chart Logic
  const countItems = (items: any[], type: 'req' | 'proc') => {
      const res: Record<string, { name: string, quantity: number, amount: number }> = {};
      items.forEach(item => {
        const supply = supplies.find(s => s.id === item.supplyId);
        if (!supply) return;
        if (selectedCatIds.length > 0 && !selectedCatIds.includes(supply.categoryId)) return;
        if (selectedSupplyIds.length > 0 && !selectedSupplyIds.includes(supply.id)) return;
        if (!res[supply.name]) res[supply.name] = { name: supply.name, quantity: 0, amount: 0 };
        res[supply.name].quantity += item.quantity;
        res[supply.name].amount += item.quantity * (item.unitPrice || supply.price || 0);
      });
      return res;
  };

  const chartStats: Record<string, { name: string, quantity: number, amount: number }> = {};
  requests.forEach(r => {
    const stats = countItems(r.items, 'req');
    Object.entries(stats).forEach(([name, data]) => {
      if (!chartStats[name]) chartStats[name] = { name, quantity: 0, amount: 0 };
      chartStats[name].quantity += data.quantity; chartStats[name].amount += data.amount;
    });
  });
  procurements.forEach(p => {
    const stats = countItems(p.items, 'proc');
    Object.entries(stats).forEach(([name, data]) => {
      if (!chartStats[name]) chartStats[name] = { name, quantity: 0, amount: 0 };
      chartStats[name].quantity += data.quantity; chartStats[name].amount += data.amount;
    });
  });
  const chartData = Object.values(chartStats).sort((a,b) => b.quantity - a.quantity);

  const exportAsImage = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const link = document.createElement('a');
    link.download = `統計圖表-${getTodayStr()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportAsPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(imgData, 'PNG', 10, 10, 180, 150);
    pdf.save(`統計圖表-${getTodayStr()}.pdf`);
  };

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-6xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sky-500 hover:text-sky-600 mb-6 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-sky-100 transition-transform hover:-translate-x-1">
        <ArrowLeft className="w-4 h-4" /> 回首頁
      </Link>
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-sky-500 flex items-center gap-3">
          <BarChart3 className="text-sky-400 w-8 h-8" /> 統計報表
        </h1>
      </header>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('list')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'list' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}>
          <TableIcon className="w-5 h-5" /> 資料清單
        </button>
        <button onClick={() => setActiveTab('chart')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'chart' ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-500 hover:bg-sky-50 border border-sky-100'}`}>
          <PieChartIcon className="w-5 h-5" /> 統計圖表
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-sm border-2 border-sky-100 mb-8">
        <h2 className="text-lg font-bold text-sky-700 mb-4 flex items-center gap-2 border-b-2 border-sky-50 pb-2"><Filter className="w-5 h-5"/> 查詢條件</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end mb-6 border-t-2 border-dashed border-sky-100 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">單據狀態</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                <option value="All">全部狀態</option>
                {docType === 'requests' || docType === 'All' ? (
                  <>
                    <option value="pending">未核可</option>
                    <option value="approved">已核可</option>
                    <option value="purchasing">採購中</option>
                    <option value="pending-restock">待入庫(申請)</option>
                    <option value="restocked">已入庫</option>
                    <option value="completed">已領用(結案)</option>
                  </>
                ) : null}
              </select>
            </div>
            {docType !== 'procurements' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">申請單位</label>
                  <select value={selectedDeptId} onChange={e => {setSelectedDeptId(e.target.value); setSelectedPersonId('All');}} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                    <option value="All">全部單位</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">申請人員</label>
                  <select value={selectedPersonId} onChange={e => setSelectedPersonId(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                    <option value="All">全部人員</option>
                    {filteredPersonnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </>
            )}
            {docType === 'procurements' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">採買地點</label>
                <input type="text" value={procLocationFilter} onChange={e => setProcLocationFilter(e.target.value)} placeholder="地點關鍵字..." className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
              </div>
            )}
            <div className="lg:col-span-2">
               <label className="block text-sm font-medium text-gray-700 mb-1">關鍵字搜尋</label>
               <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="單號、物品名稱..." className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
          </div>
          <button onClick={generateReport} className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 h-[44px]">
            <Search className="w-4 h-4" /> 載入資料
          </button>
        </div>

        {activeTab === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end mb-6 border-t-2 border-dashed border-sky-100 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">單據狀態</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                <option value="All">全部狀態</option>
                {docType === 'requests' || docType === 'All' ? (
                  <>
                    <option value="pending">未核可</option>
                    <option value="approved">已核可</option>
                    <option value="purchasing">採購中</option>
                    <option value="pending-restock">待入庫(申請)</option>
                    <option value="restocked">已入庫</option>
                    <option value="completed">已領用(結案)</option>
                  </>
                ) : null}
              </select>
            </div>
            {docType !== 'procurements' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">申請單位</label>
                  <select value={selectedDeptId} onChange={e => {setSelectedDeptId(e.target.value); setSelectedPersonId('All');}} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                    <option value="All">全部單位</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">申請人員</label>
                  <select value={selectedPersonId} onChange={e => setSelectedPersonId(e.target.value)} className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300">
                    <option value="All">全部人員</option>
                    {filteredPersonnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </>
            )}
            {docType === 'procurements' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">採買地點</label>
                <input type="text" value={procLocationFilter} onChange={e => setProcLocationFilter(e.target.value)} placeholder="地點關鍵字..." className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
              </div>
            )}
            <div className="lg:col-span-2">
               <label className="block text-sm font-medium text-gray-700 mb-1">關鍵字搜尋 (單號、物品名稱)</label>
               <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="輸入關鍵字..." className="w-full rounded-xl border-2 border-sky-100 px-4 py-2 focus:outline-none focus:border-sky-300" />
            </div>
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="border-t-2 border-dashed border-sky-100 pt-6">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">圖表呈現方式</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setChartType('table')} className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold ${chartType === 'table' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'}`}><TableIcon className="w-4 h-4"/> 表格</button>
                    <button onClick={() => setChartType('pie')} className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold ${chartType === 'pie' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'}`}><PieChartIcon className="w-4 h-4"/> 圓餅圖</button>
                    <button onClick={() => setChartType('bar')} className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold ${chartType === 'bar' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'}`}><BarChartIcon className="w-4 h-4"/> 長條圖</button>
                    <button onClick={() => setChartType('line')} className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold ${chartType === 'line' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600'}`}><LineChartIcon className="w-4 h-4"/> 折線圖</button>
                  </div>
                  <label className="flex items-center gap-2 mt-4 font-bold text-gray-700"><input type="checkbox" checked={includeAmount} onChange={e => setIncludeAmount(e.target.checked)} className="w-4 h-4" /> 統計金額</label>
                </div>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">類別 (可複選)</label>
                    <div className="max-h-24 overflow-y-auto border border-sky-100 rounded-xl p-2 bg-gray-50 flex flex-wrap gap-2">
                       {categories.map(c => (
                         <label key={c.id} className="flex items-center gap-1 text-xs bg-white border px-2 py-1 rounded cursor-pointer">
                           <input type="checkbox" checked={selectedCatIds.includes(c.id)} onChange={e => { if(e.target.checked) setSelectedCatIds([...selectedCatIds, c.id]); else setSelectedCatIds(selectedCatIds.filter(id => id !== c.id)); }} /> {c.name}
                         </label>
                       ))}
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-sky-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">{activeTab === 'list' ? '查詢結果清單' : '統計圖表結果'}</h2>
          <div className="flex gap-2">
             {activeTab === 'chart' && (
                <>
                  <button onClick={exportAsImage} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center gap-1"><Download className="w-4 h-4"/> 圖片</button>
                  <button onClick={exportAsPDF} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center gap-1"><Download className="w-4 h-4"/> PDF</button>
                </>
             )}
          </div>
        </div>

        {activeTab === 'list' ? (
          loading ? <div className="text-center py-10 text-sky-400 font-bold">載入中...</div> :
          filteredUnified.length === 0 ? <div className="text-center py-10 text-gray-400">沒有紀錄</div> :
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead><tr className="border-b-2 border-sky-100 text-sky-700"><th className="pb-3 pl-2">序號</th><th className="pb-3">類型</th><th className="pb-3">單據編號</th><th className="pb-3">日期</th><th className="pb-3">申請人/地點</th><th className="pb-3">物品</th><th className="pb-3 text-right">操作</th></tr></thead>
              <tbody>
                {paginatedData.map((item, i) => {
                  const idx = (page - 1) * itemsPerPage + i + 1;
                  return (
                    <tr key={`${item.type}-${(item.data as any).id}`} className="border-b border-gray-100 hover:bg-sky-50/50">
                      <td className="py-4 pl-2 text-gray-500 font-medium">{idx}</td>
                      <td className="py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${item.type === 'request' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{item.type === 'request' ? '申請單' : '採購單'}</span></td>
                      <td className="py-4 font-bold">{(item.data as any).id}</td>
                      <td className="py-4 text-gray-600">{item.date}</td>
                      <td className="py-4 font-medium">{item.type === 'request' ? <><span className="text-lg text-sky-600">{(item.data as RequestRecord).applicantName}</span><br/><span className="text-xs text-gray-500">{(item.data as RequestRecord).departmentName}</span></> : (item.data as ProcurementRecord).location}</td>
                      <td className="py-4 text-sm">{(item.data as any).items.map((it:any, idx:number) => <div key={idx}>{it.name} <span className="text-sky-600 font-bold">x{it.quantity}</span></div>)}</td>
                      <td className="py-4 text-right pr-2"><button onClick={() => triggerPrint(item.type, item.data)} className="p-2 bg-sky-50 text-sky-500 rounded-lg hover:bg-sky-100"><Printer className="w-4 h-4" /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={chartRef} className="p-4">
             {chartData.length > 0 && chartType !== 'table' ? (
               <ResponsiveContainer width="100%" height={400}>
                 {chartType === 'pie' ? <PieChart><Pie data={chartData} dataKey={includeAmount ? 'amount' : 'quantity'} nameKey="name" cx="50%" cy="50%" outerRadius={100} label>{chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart> : 
                  chartType === 'bar' ? <BarChart data={chartData}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey={includeAmount ? 'amount' : 'quantity'} fill="#0ea5e9" /></BarChart> :
                  <LineChart data={chartData}><XAxis dataKey="name" /><YAxis /><Tooltip /><Line type="monotone" dataKey={includeAmount ? 'amount' : 'quantity'} stroke="#f43f5e" /></LineChart>}
               </ResponsiveContainer>
             ) : (
               <table className="w-full text-left">
                 <thead><tr><th>物品</th><th>{includeAmount ? '金額' : '數量'}</th></tr></thead>
                 <tbody>{chartData.map((d, i) => <tr key={i}><td>{d.name}</td><td>{includeAmount ? `$${d.amount}` : d.quantity}</td></tr>)}</tbody>
               </table>
             )}
          </div>
        )}
      </div>

      {/* Hidden printable area */}
      <div className="absolute -left-[9999px] top-0">
         <div ref={printRef} className="p-10 font-handwriting w-[800px] bg-white">
           <h1 className="text-3xl font-bold text-center mb-8">列印單據</h1>
           {/* (Content to print based on printingData) */}
         </div>
      </div>
    </main>
  );
}
