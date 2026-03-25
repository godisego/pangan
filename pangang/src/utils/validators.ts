// ============================================
// Validation Utilities
// ============================================

import type { BtcDetail, StockMarket, MacroDashboard } from '@/types/api';
import { STATUS_THRESHOLDS } from './constants';

// ============================================
// Type Guards
// ============================================

/**
 * Check if value is a valid number
 */
export function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if value is a valid string
 */
export function isValidString(value: any): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a valid date
 */
export function isValidDate(value: any): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Check if value is a valid array
 */
export function isValidArray<T>(value: any): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if value is a valid object
 */
export function isValidObject(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================
// BTC Validators
// ============================================

/**
 * Validate BTC summary data
 */
export function validateBtcSummary(data: any): data is import('@/types/api').BtcSummary {
  return (
    isValidObject(data) &&
    isValidNumber(data.price) &&
    isValidNumber(data.change24h) &&
    isValidNumber(data.fearGreed) &&
    isValidString(data.fearGreedLabel)
  );
}

/**
 * Validate BTC technical data
 */
export function validateBtcTechnical(data: any): data is import('@/types/api').BtcTechnical {
  return (
    isValidObject(data) &&
    isValidObject(data.technical) &&
    isValidNumber(data.technical.support) &&
    isValidNumber(data.technical.resistance) &&
    isValidNumber(data.technical.rsi)
  );
}

/**
 * Validate BTC detail data
 */
export function validateBtcDetail(data: any): data is BtcDetail {
  return (
    isValidObject(data) &&
    validateBtcSummary(data) &&
    isValidObject(data.sentiment) &&
    isValidObject(data.technical) &&
    isValidObject(data.recommendation)
  );
}

/**
 * Get BTC trend from change
 */
export function getBtcTrend(change24h: number, fearGreed: number): {
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: 'strong' | 'moderate' | 'weak';
} {
  const absChange = Math.abs(change24h);

  if (change24h > 2) {
    return { trend: 'bullish', strength: absChange > 5 ? 'strong' : 'moderate' };
  } else if (change24h < -2) {
    return { trend: 'bearish', strength: absChange > 5 ? 'strong' : 'moderate' };
  } else if (fearGreed >= 75) {
    return { trend: 'bearish', strength: 'weak' };
  } else if (fearGreed <= 25) {
    return { trend: 'bullish', strength: 'weak' };
  }

  return { trend: 'neutral', strength: 'weak' };
}

/**
 * Check if BTC data indicates extreme market condition
 */
export function isExtremeMarketCondition(change24h: number, fearGreed: number): boolean {
  return Math.abs(change24h) >= 5 || fearGreed <= 25 || fearGreed >= 75;
}

// ============================================
// Stock Validators
// ============================================

/**
 * Validate stock market data
 */
export function validateStockMarket(data: any): data is StockMarket {
  return (
    isValidObject(data) &&
    isValidString(data.status) &&
    isValidObject(data.index) &&
    isValidNumber(data.index.value) &&
    isValidNumber(data.index.change) &&
    isValidNumber(data.breadth) &&
    isValidNumber(data.volume)
  );
}

/**
 * Validate stock quote data
 */
export function validateStockQuote(data: any): data is import('@/types/api').StockQuote {
  return (
    isValidObject(data) &&
    isValidString(data.code) &&
    isValidString(data.name) &&
    isValidNumber(data.price) &&
    isValidNumber(data.change)
  );
}

/**
 * Get stock market status from data
 */
export function getStockMarketStatus(data: StockMarket): {
  status: 'bull' | 'neutral' | 'bear';
  canOperate: boolean;
  reason: string;
} {
  const { status, breadth, northFlow } = data;

  if (status === 'bull' || status === 'bullish') {
    return {
      status: 'bull',
      canOperate: true,
      reason: '市场强势，适合操作'
    };
  }

  if (status === 'bear' || status === 'bearish') {
    return {
      status: 'bear',
      canOperate: false,
      reason: '市场弱势，建议观望'
    };
  }

  // Check breadth and north flow for neutral status
  if (breadth > 50 && northFlow > 0) {
    return {
      status: 'bull',
      canOperate: true,
      reason: '涨跌比良好，北向流入'
    };
  }

  if (breadth < 30 && northFlow < 0) {
    return {
      status: 'bear',
      canOperate: false,
      reason: '涨跌比差，北向流出'
    };
  }

  return {
    status: 'neutral',
    canOperate: false,
    reason: '市场中性，谨慎观望'
  };
}

// ============================================
// Macro Validators
// ============================================

/**
 * Validate macro dashboard data
 */
export function validateMacroDashboard(data: any): data is MacroDashboard {
  return (
    isValidObject(data) &&
    isValidObject(data.macro_mainline) &&
    isValidString(data.macro_mainline.cycle_stage) &&
    isValidString(data.macro_mainline.narrative) &&
    isValidNumber(data.macro_mainline.score) &&
    isValidArray(data.catalysts) &&
    isValidObject(data.defense)
  );
}

/**
 * Get macro stance from score
 */
export function getMacroStance(score: number): 'offensive' | 'defensive' | 'neutral' {
  if (score >= STATUS_THRESHOLDS.SCORE.BULLISH) return 'offensive';
  if (score <= STATUS_THRESHOLDS.SCORE.BEARISH) return 'defensive';
  return 'neutral';
}

/**
 * Get theme color from macro score
 */
export function getMacroTheme(score: number): 'red' | 'slate' | 'indigo' {
  if (score >= 7) return 'red';
  if (score <= 4) return 'slate';
  return 'indigo';
}

// ============================================
// General Validators
// ============================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Chinese format)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate stock code format
 */
export function isValidStockCode(code: string): boolean {
  // Chinese stock codes are 6 digits
  const codeRegex = /^\d{6}$/;
  return codeRegex.test(code);
}

/**
 * Validate percentage value
 */
export function isValidPercentage(value: number): boolean {
  return isValidNumber(value) && value >= -100 && value <= 100;
}

/**
 * Validate price value
 */
export function isValidPrice(value: number): boolean {
  return isValidNumber(value) && value > 0;
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if value is in range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return isValidNumber(value) && value >= min && value <= max;
}

/**
 * Clamp value to range
 */
export function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate and convert to number
 */
export function toNumber(value: any, defaultValue: number = 0): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isValidNumber(num) ? num : defaultValue;
}

export default {
  isValidNumber,
  isValidString,
  isValidDate,
  isValidArray,
  isValidObject,
  validateBtcSummary,
  validateBtcTechnical,
  validateBtcDetail,
  getBtcTrend,
  isExtremeMarketCondition,
  validateStockMarket,
  validateStockQuote,
  getStockMarketStatus,
  validateMacroDashboard,
  getMacroStance,
  getMacroTheme,
  isValidEmail,
  isValidPhone,
  isValidStockCode,
  isValidPercentage,
  isValidPrice,
  sanitizeInput,
  isValidUrl,
  isInRange,
  clampValue,
  toNumber
};
