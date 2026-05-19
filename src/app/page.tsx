import Link from 'next/link';
import { ClipboardList, Package, BarChart3, Users, Sparkles, LayoutList } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen p-6 md:p-12 flex flex-col items-center justify-center">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold text-sky-500 flex items-center justify-center gap-3 mb-4">
          <Sparkles className="text-yellow-400 w-10 h-10 animate-pulse" />
          辦公室用具管理小幫手
        </h1>
        <p className="text-lg text-gray-500">請選擇您需要的功能 💙</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 w-full max-w-7xl">
        <Link href="/request" className="group block p-6 bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-sky-100 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all hover:-translate-y-2 text-center">
          <div className="w-16 h-16 mx-auto bg-sky-100 text-sky-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
            <ClipboardList className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">用品申請</h2>
          <p className="text-sm text-gray-500">選取單位、人員及物品，產生申請單</p>
        </Link>

        <Link href="/workflow" className="group block p-6 bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-sky-100 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all hover:-translate-y-2 text-center">
          <div className="w-16 h-16 mx-auto bg-sky-100 text-sky-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
            <LayoutList className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">單據流程</h2>
          <p className="text-sm text-gray-500">核可申請單並轉交採購與領用</p>
        </Link>

        <Link href="/management" className="group block p-6 bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-sky-100 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all hover:-translate-y-2 text-center">
          <div className="w-16 h-16 mx-auto bg-sky-100 text-sky-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
            <Package className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">用品管理</h2>
          <p className="text-sm text-gray-500">管理辦公室用品、類別及可愛插圖</p>
        </Link>

        <Link href="/organization" className="group block p-6 bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-sky-100 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all hover:-translate-y-2 text-center">
          <div className="w-16 h-16 mx-auto bg-sky-100 text-sky-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">單位及人員資料</h2>
          <p className="text-sm text-gray-500">管理公司各部門單位與員工資料</p>
        </Link>

        <Link href="/report" className="group block p-6 bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-sky-100 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all hover:-translate-y-2 text-center">
          <div className="w-16 h-16 mx-auto bg-sky-100 text-sky-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
            <BarChart3 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">統計報表</h2>
          <p className="text-sm text-gray-500">依據日期區間與類別，查詢申請統計</p>
        </Link>
      </div>
    </main>
  );
}
