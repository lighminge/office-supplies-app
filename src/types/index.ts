export interface OfficeSupply {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  iconName: string; // e.g. "Pen", "Paperclip", "Monitor"
  updatedAt?: any;
}

export const CATEGORIES = ['文具', '電子產品', '茶水間', '清潔用品', '其他'];

export const AVAILABLE_ICONS = [
  'PenTool', 'Paperclip', 'Monitor', 'Coffee', 'Trash2', 'Sticker', 'Scissors', 'Book', 'Package', 'Printer'
];
