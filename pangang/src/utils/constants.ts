// ============================================
// Application Constants
// ============================================

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  DEFAULT_TIMEOUT: 10000,
  DEFAULT_RETRIES: 2,
  LONG_POLLING_TIMEOUT: 60000
} as const;

// Refresh Intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  STOCK_MARKET: 5000,      // 5 seconds (was 3s - reduced for performance)
  STOCK_SELECTION: 5000,   // 5 seconds (was 3s)
  BTC_SUMMARY: 15000,      // 15 seconds (was 10s)
  BTC_TECHNICAL: 30000,    // 30 seconds
  BTC_KLINE: 60000,        // 1 minute
  MACRO_DASHBOARD: 600000, // 10 minutes (was 5m - macro views shouldn't change frequently)
  MACRO_TRENDING: 180000,  // 3 minutes (was 2m)
  HEALTH_CHECK: 60000      // 60 seconds (was 30s)
} as const;

// Stale Times (in milliseconds)
export const STALE_TIMES = {
  STOCK_DATA: 5000,        // 5 seconds
  BTC_DATA: 15000,         // 15 seconds
  MACRO_DATA: 60000        // 1 minute
} as const;

// Status Thresholds
export const STATUS_THRESHOLDS = {
  RSI: {
    OVERBOUGHT: 70,
    OVERSOLD: 30
  },
  FEAR_GREED: {
    EXTREME_FEAR: 25,
    FEAR: 45,
    GREED: 55,
    EXTREME_GREED: 75
  },
  SCORE: {
    BULLISH: 7,
    NEUTRAL: 4,
    BEARISH: 0
  }
} as const;

// BTC Configuration
export const BTC_CONFIG = {
  SUPPORT_LEVELS: [0.9, 0.85, 0.8],      // Support levels as % of price
  RESISTANCE_LEVELS: [1.1, 1.15, 1.2],   // Resistance levels as % of price
  STOP_LOSS_PCT: 0.08,                   // 8% stop loss
  TAKE_PROFIT_PCT: 0.15                  // 15% take profit
} as const;

// Strategy Labels
export const STRATEGY_LABELS = {
  CONSERVATIVE: '🐢 保守策略',
  BALANCED: '⚖️ 平衡策略',
  AGGRESSIVE: '🔥 激进策略',
  DYNAMIC: '🎯 当前建议'
} as const;

// Status Labels
export const STATUS_LABELS = {
  bullish: '看多',
  bearish: '看空',
  neutral: '中性',
  caution: '警惕',
  opportunity: '机会'
} as const;

// Color Classes
export const COLOR_CLASSES = {
  bullish: 'text-[var(--accent-green)]',
  bearish: 'text-[var(--accent-red)]',
  neutral: 'text-yellow-400',
  caution: 'text-orange-400',
  opportunity: 'text-[var(--accent-green)]'
} as const;

// Chart Colors
export const CHART_COLORS = {
  bullish: '#26a69a',
  bearish: '#ef5350',
  neutral: '#ff9800',
  grid: 'rgba(255, 255, 255, 0.1)',
  crosshair: 'rgba(255, 255, 255, 0.3)'
} as const;

// Time Frames
export const TIME_FRAMES = {
  '1H': '1小时',
  '4H': '4小时',
  '1D': '1天',
  '1W': '1周'
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  BTC: {
    SUMMARY: '/api/btc/summary',
    TECHNICAL: '/api/btc/technical',
    DERIVATIVES: '/api/btc/derivatives',
    NETWORK: '/api/btc/network',
    MARKET: '/api/btc/market',
    KLINE: '/api/btc/kline'
  },
  STOCK: {
    MARKET: '/api/stock/market',
    SELECTION: '/api/stock/selection',
    QUOTE: '/api/stock/quote',
    DETAIL: '/api/stock'
  },
  MACRO: {
    DASHBOARD: '/api/macro/dashboard',
    TRENDING: '/api/macro/trending'
  },
  NOTIFY: {
    SEND: '/api/notify/send'
  },
  HEALTH: '/health'
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  TIMEOUT_ERROR: '请求超时，请稍后重试',
  API_ERROR: '服务器错误，请稍后重试',
  NOT_FOUND_ERROR: '未找到相关数据',
  UNAUTHORIZED_ERROR: '未授权，请登录后重试',
  UNKNOWN_ERROR: '发生未知错误，请稍后重试'
} as const;

// Loading Messages
export const LOADING_MESSAGES = {
  DEFAULT: '加载中...',
  STOCK_DATA: '加载股票数据...',
  BTC_DATA: '加载BTC数据...',
  KLINE_DATA: '加载K线数据...',
  MACRO_DATA: 'AI分析中...',
  MARKET_DATA: '加载市场数据...'
} as const;

// Empty State Messages
export const EMPTY_MESSAGES = {
  NO_DATA: '暂无数据',
  NO_SIGNALS: '暂无信号',
  NO_TRENDING: '暂无热议',
  NO_SELECTION: '暂无选股结果',
  NO_WARNING: '无风险提示'
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
} as const;

// Animation Durations (in ms)
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
} as const;

// Breakpoints (in px)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280
} as const;

// Z-Index Layers
export const Z_INDEX = {
  DROPDOWN: 1000,
  STICKY: 1020,
  FIXED: 1030,
  MODAL_BACKDROP: 1040,
  MODAL: 1050,
  POPOVER: 1060,
  TOOLTIP: 1070
} as const;

export default {
  API_CONFIG,
  REFRESH_INTERVALS,
  STALE_TIMES,
  STATUS_THRESHOLDS,
  BTC_CONFIG,
  STRATEGY_LABELS,
  STATUS_LABELS,
  COLOR_CLASSES,
  CHART_COLORS,
  TIME_FRAMES,
  API_ENDPOINTS,
  ERROR_MESSAGES,
  LOADING_MESSAGES,
  EMPTY_MESSAGES,
  PAGINATION,
  ANIMATION_DURATION,
  BREAKPOINTS,
  Z_INDEX
};
