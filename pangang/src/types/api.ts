// ============================================
// API Type Definitions
// ============================================

// ============================================
// Common Types
// ============================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface FetchOptions {
  timeout?: number;
  retries?: number;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown> | string | number | boolean | null;
  headers?: Record<string, string>;
}

// ============================================
// BTC Types
// ============================================

export interface BtcSummary {
  price: number;
  change24h: number;
  change7d?: number;
  change30d?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  fearGreed: number;
  fearGreedLabel: string;
  strategy?: BtcStrategy;
}

export interface BtcTechnical {
  technical: {
    support: number;
    resistance: number;
    ma7: number;
    ma30: number;
    ma200?: number;
    rsi: number;
    macd?: {
      value: number;
      signal: number;
      histogram: number;
    };
  };
}

export interface BtcDerivatives {
  fundingRatePct?: number;
  openInterestUsd?: number;
  longShortRatio?: number;
}

export interface BtcNetwork {
  status: 'bullish' | 'neutral' | 'bearish' | 'caution';
  score: number;
  indicators: Array<{
    name: string;
    value: string;
    meaning?: string;
    isBullish: boolean;
  }>;
  summary: string;
}

export interface BtcMarket {
  status: 'bullish' | 'neutral' | 'bearish';
  score: number;
  indicators: Array<{
    name: string;
    value: string;
    meaning?: string;
    isBullish: boolean;
  }>;
  summary: string;
}

export interface BtcStrategy {
  overall: 'bullish' | 'bearish' | 'neutral';
  confidence?: number;
  summary: string;
  action?: string;
  reasoning?: string[];
  buyRange?: {
    low: number;
    high: number;
  };
  stopLoss?: number;
  takeProfit?: number;
  totalScore?: number;
  factors?: Record<string, {
    score: number;
    label: string;
  }>;
  patterns?: string[];
  possibleReasons?: string[];
  risks?: string[];
  marketState?: 'crash' | 'dump' | 'surge' | 'pump' | 'normal';
}

export interface BtcKline {
  candles: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  markers?: Array<{
    timestamp: number;
    type: 'top' | 'bottom' | 'fake_breakout';
    label: string;
  }>;
}

export interface BtcDetail extends BtcSummary, BtcTechnical, BtcDerivatives {
  network?: BtcNetwork;
  market?: BtcMarket;
  sentiment?: {
    status: 'bullish' | 'neutral' | 'bearish' | 'caution';
    score: number;
    fearGreed: number;
    fearGreedLabel: string;
    indicators: Array<{
      name: string;
      value: string;
      change?: number;
      meaning?: string;
      threshold?: string;
      isBullish: boolean;
    }>;
    summary: string;
  };
  technical: {
    status: 'bullish' | 'neutral' | 'bearish' | 'caution';
    score: number;
    support: number;
    resistance: number;
    ma7: number;
    ma30: number;
    ma200?: number;
    rsi: number;
    indicators: Array<{
      name: string;
      value: string;
      change?: number;
      meaning?: string;
      threshold?: string;
      isBullish: boolean;
    }>;
    summary: string;
  };
  recommendation: {
    overall: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    summary: string;
    reasoning: string[];
    strategies: BtcStrategyCard[];
  };
  kline?: BtcKline;
  dynamicStrategy?: BtcStrategy;
}

export interface BtcStrategyCard {
  type: 'conservative' | 'balanced' | 'aggressive' | 'dynamic';
  label: string;
  action: string;
  range: {
    low: number;
    high: number;
    type: 'buy' | 'sell' | 'hold';
  };
  reasoning: string;
  stopLoss: number;
  takeProfit: number;
}

// ============================================
// Stock Types
// ============================================

export interface StockMarket {
  status: 'bull' | 'neutral' | 'bear' | 'bullish' | 'bearish';
  canOperate: boolean;
  index: {
    name: string;
    value: number;
    change: number;
  };
  breadth: number;
  volume: number;
  northFlow: number;
  limitUp: number;
}

export interface StockSignal {
  id: string;
  name: string;
  change: number;
  turnover: number;
  topStock?: string;
  isVolumePriceSynergy: boolean;
  catalystLevel?: 'strong' | 'medium' | 'weak' | 'none';
  volume?: string;
  recommendation?: string;
}

export interface StockSelection {
  volumePriceSynergy: StockSignal[];
  watchList: StockSignal[];
}

export interface StockQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  high: number;
  low: number;
  open: number;
  preClose: number;
}

export interface StockDetail extends StockQuote {
  marketCap?: number;
  pe?: number;
  pb?: number;
  industry?: string;
  concept?: string[];
  timestamp?: string;
}

// ============================================
// Macro Types
// ============================================

export interface MacroDashboard {
  timestamp: string;
  macro_mainline: {
    cycle_stage: string;
    narrative: string;
    score: number;
  };
  catalysts: Array<{
    sector: string;
    event: string;
    strength: 'Strong' | 'Medium' | 'Weak';
  }>;
  defense: {
    sectors: string[];
    reason: string;
  };
  operational_logic: string;
  confidence_score?: 'High' | 'Medium' | 'Low';
  trending?: TrendingItem[];
}

// ============================================
// Commander Types
// ============================================

export interface CommanderWeather {
  weather: string;
  icon: string;
  auction_sentiment?: string;
  description?: string;
  signal?: 'bull' | 'neutral' | 'bear' | 'unknown';
  overnight_us?: string;
  auction_data?: {
    limit_up: number;
    limit_down: number;
    red_ratio: number;
    high_open: number;
    low_open: number;
  };
}

export interface CommanderReview {
  status: string;
  accuracy?: string;
  summary?: string;
  details?: Array<{
    code: string;
    name: string;
    change: number;
    result: string;
  }>;
}

export interface CommanderLogic {
  name: string;
  reason: string;
  validity: string;
  verify_point: string;
  fake_signal: string;
  type?: string;
  us_mapping?: string;
}

export interface CommanderStock {
  priority: string;
  stock: string;
  code: string;
  auction_price: string;
  auction_status: string;
  tactic: string;
}

export interface CommanderOrder {
  timestamp: string;
  battle_weather: CommanderWeather;
  yesterday_review: CommanderReview;
  today_mainlines: {
    logic_a: CommanderLogic;
    logic_b: CommanderLogic;
    summary: string;
  };
  elite_stock_pool: {
    attack: CommanderStock[];
    defense: CommanderStock[];
  };
  commander_tips: {
    position: {
      attack: number;
      defense: number;
      cash: number;
    };
    position_text: string;
    time_orders: Array<{
      time: string;
      condition: string;
      action: string;
    }>;
    focus: string;
  };
}

export interface TrendingItem {
  title: string;
  source: string;
  time: string;
  heat_score: number;
  tags: string[];
  url?: string;
}

export interface MacroTrending {
  trending: TrendingItem[];
  timestamp?: string;
}

// ============================================
// Notification Types
// ============================================

export interface NotificationRequest {
  chat_id?: string;
  message?: string;
  webhook_url?: string;
}

export interface NotificationResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}

// ============================================
// Health Check Types
// ============================================

export interface HealthCheck {
  status: 'ok' | 'healthy' | 'error';
  message?: string;
  timestamp?: string;
}

// ============================================
// Utility Types
// ============================================

export type StatusType = 'bullish' | 'neutral' | 'bearish' | 'caution' | 'cautious_bullish' | 'cautious_bearish' | 'opportunity';

export type CatalystStrength = 'Strong' | 'Medium' | 'Weak';

export type TimeFrame = '1H' | '4H' | '1D' | '1W';

export type StrategyType = 'conservative' | 'balanced' | 'aggressive' | 'dynamic';
