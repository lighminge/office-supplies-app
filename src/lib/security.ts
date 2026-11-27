import * as Icons from 'lucide-react';
import { LUCIDE_ICONS_MAP } from '@/types';
import type { LucideIcon } from 'lucide-react';

/**
 * 安全的 Lucide 圖示解析器（白名單驗證）
 * 防止資料庫寫入任意屬性名稱或原型鏈屬性（如 constructor, toString）導致前端渲染崩潰
 */
export function getSafeLucideIcon(iconName?: string | null): LucideIcon {
  if (
    typeof iconName === 'string' &&
    Object.prototype.hasOwnProperty.call(LUCIDE_ICONS_MAP, iconName)
  ) {
    const candidate = (Icons as unknown as Record<string, LucideIcon>)[iconName];
    if (candidate) {
      return candidate;
    }
  }
  return Icons.HelpCircle;
}

/**
 * 字串清理與長度驗證：移除控制字元與前後空白，若不符合長度限制則回傳 null
 */
export function sanitizeText(input: unknown, maxLength = 50, minLength = 1): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (cleaned.length < minLength || cleaned.length > maxLength) {
    return null;
  }
  return cleaned;
}

/**
 * 正整數驗證（>= 1 且 <= max）
 * 防止負數、0、NaN、Infinity 或浮點數繞過庫存扣減與申請數量邏輯
 */
export function parsePositiveInt(input: unknown, max = 100000): number | null {
  const num = typeof input === 'number' ? input : Number(input);
  if (!Number.isInteger(num) || num < 1 || num > max) {
    return null;
  }
  return num;
}

/**
 * 非負整數驗證（>= 0 且 <= max）
 */
export function parseNonNegativeInt(input: unknown, max = 1000000): number | null {
  const num = typeof input === 'number' ? input : Number(input);
  if (!Number.isInteger(num) || num < 0 || num > max) {
    return null;
  }
  return num;
}

/**
 * 正數金額驗證（> 0 且 <= max）
 */
export function parsePositiveAmount(input: unknown, max = 10000000): number | null {
  const num = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(num) || num <= 0 || num > max) {
    return null;
  }
  return Math.round(num * 100) / 100;
}

/**
 * 日期字串格式驗證 (YYYY-MM-DD)
 */
export function isValidDateString(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}
