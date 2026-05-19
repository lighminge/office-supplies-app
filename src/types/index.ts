export interface Category {
  id: string;
  name: string;
}

export interface AppIcon {
  id: string;
  name: string; // Lucide icon name, e.g. "PenTool"
  label: string; // Chinese label, e.g. "原子筆"
}

export interface Department {
  id: string;
  name: string;
}

export interface Personnel {
  id: string;
  name: string;
  departmentId: string;
}

export interface OfficeSupply {
  id: string;
  name: string;
  categoryId: string;
  quantity: number;
  minQuantity: number;
  iconId: string;
  updatedAt?: any;
}

export interface RequestItem {
  supplyId: string;
  name: string; // Cached for history
  quantity: number;
}

export interface RequestRecord {
  id: string;
  departmentId: string;
  departmentName: string; // Cached
  applicantId: string;
  applicantName: string; // Cached
  items: RequestItem[];
  createdAt: any;
}

export interface ProcurementItem {
  supplyId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ProcurementRecord {
  id: string;
  date: string; // YYYY-MM-DD
  location: string;
  items: ProcurementItem[];
  totalAmount: number;
  isRestocked: boolean;
  createdAt: any;
}

// Map of all available icons with default Chinese names
export const LUCIDE_ICONS_MAP: Record<string, string> = {
  PenTool: '鋼筆/筆',
  Paperclip: '迴紋針',
  Monitor: '螢幕/電腦',
  Coffee: '咖啡/茶水',
  Trash2: '垃圾桶',
  Sticker: '便利貼/貼紙',
  Scissors: '剪刀',
  Book: '書本/筆記本',
  Package: '包裹/紙箱',
  Printer: '印表機',
  Folder: '資料夾',
  Smile: '笑臉',
  Heart: '愛心',
  Star: '星星',
  Sun: '太陽',
  Moon: '月亮',
  Cloud: '雲朵',
  Umbrella: '雨傘',
  Zap: '閃電',
  Bell: '鈴鐺/通知',
  Gift: '禮物',
  ShoppingBag: '購物袋',
  Briefcase: '公事包',
  Camera: '相機',
  Headphones: '耳機',
  Music: '音樂',
  Video: '影片/錄影',
  Mic: '麥克風',
  File: '檔案',
  FileText: '文件',
  Image: '圖片',
  Box: '箱子',
  Award: '獎章',
  Key: '鑰匙',
  Lock: '鎖頭',
  Cpu: '處理器/晶片',
  Battery: '電池',
  Bluetooth: '藍牙',
  Cast: '投影',
  Clock: '時鐘',
  Compass: '指南針',
  Droplet: '水滴',
  Eye: '眼睛',
  Feather: '羽毛',
  Flag: '旗幟',
  Globe: '地球/網路',
  Hexagon: '六角形',
  Layers: '圖層',
  LifeBuoy: '救生圈',
  Link: '連結',
  Map: '地圖',
  MousePointer: '游標/滑鼠',
  Phone: '電話',
  Pocket: '口袋',
  Radio: '廣播',
  Save: '磁片/儲存',
  Send: '發送/紙飛機',
  Server: '伺服器',
  Shield: '盾牌',
  Smartphone: '手機',
  Speaker: '喇叭',
  Tablet: '平板',
  Target: '目標',
  Thermometer: '溫度計',
  Tool: '工具',
  Tv: '電視',
  UmbrellaIcon: '雨傘',
  Watch: '手錶',
  Wifi: 'Wi-Fi'
};

export const LUCIDE_ICONS_LIST = Object.keys(LUCIDE_ICONS_MAP);
