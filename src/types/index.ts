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

export const LUCIDE_ICONS_LIST = [
  'PenTool', 'Paperclip', 'Monitor', 'Coffee', 'Trash2', 'Sticker', 'Scissors', 'Book', 'Package', 'Printer', 'Folder', 'Smile', 'Heart', 'Star', 'Sun', 'Moon', 'Cloud', 'Umbrella', 'Zap', 'Bell', 'Gift', 'ShoppingBag', 'Briefcase', 'Camera', 'Headphones', 'Music', 'Video', 'Mic', 'File', 'FileText', 'Image', 'Box', 'Award', 'Key', 'Lock'
];