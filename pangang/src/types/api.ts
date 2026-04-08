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
  body?: unknown;
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
  source?: string;
  updatedAt?: string;
  stale?: boolean;
  unavailable?: boolean;
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
  stale?: boolean;
  statsUnavailable?: boolean;
  summary?: string;
  statsSource?: string;
  statsAsOf?: string;
  providerHint?: string;
  index: {
    name: string;
    value: number;
    change: number;
  };
  breadth: number;
  volume: number;
  northFlow: number;
  capitalFlow?: {
    net: number;
    status: 'inflow' | 'outflow' | 'neutral' | string;
    focus?: string;
  };
  limitUp: number;
  limitDown?: number;
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
  news_brief?: Array<{
    title: string;
    source: string;
    impact: string;
  }>;
  cycle_framework?: {
    secular: string;
    cyclical: string;
    tactical: string;
    summary: string;
  };
  long_term_view?: {
    stance: string;
    themes: string[];
    rationale: string;
  };
  short_term_view?: {
    stance: string;
    focus: string[];
    rationale: string;
    risk_trigger?: string;
  };
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
  engine?: {
    provider: string;
    model: string;
    used_api: boolean;
    fallback_reason?: string;
  };
}

export interface ChatProviderModel {
  id: string;
  label: string;
}

export interface ChatProviderOption {
  id: string;
  label: string;
  description?: string;
  default_model: string;
  api_key_label: string;
  api_key_placeholder: string;
  requires_base_url?: boolean;
  base_url_placeholder?: string;
  models: ChatProviderModel[];
}

export interface ChatProviderCatalogResponse {
  providers: ChatProviderOption[];
  shared_ai?: {
    enabled: boolean;
    provider?: string | null;
    provider_label?: string | null;
    model?: string | null;
  };
  features?: {
    notify_config_write_enabled?: boolean;
    notify_test_enabled?: boolean;
  };
}

export interface ChatCompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  provider?: string;
  api_key?: string;
  model?: string;
  base_url?: string;
}

export interface ChatCompletionResponse {
  reply: string;
  provider: string;
  model: string;
  used_api: boolean;
}

export interface ChatProviderTestRequest {
  provider?: string;
  api_key?: string;
  model?: string;
  base_url?: string;
}

export interface ChatProviderTestResponse {
  status: 'success';
  reply: string;
  provider: string;
  model: string;
  used_api: boolean;
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
  stale?: boolean;
}

export interface CommanderReview {
  status: string;
  accuracy?: string;
  summary?: string;
  learning_summary?: string;
  diagnosis?: {
    label: string;
    reason: string;
    failed_link?: string;
    next_action?: string;
  };
  details?: Array<{
    code: string;
    name: string;
    change: number;
    result: string;
    lane?: string;
    theme?: string;
    priority?: string;
  }>;
}

export interface CommanderDirectionLeg {
  label: string;
  direction: 'bullish' | 'bearish' | 'neutral' | string;
  rationale: string;
  themes?: string[];
  beneficiary_type?: 'direct' | 'second_order' | 'hedge' | 'defensive' | string;
}

export interface CommanderLogic {
  name: string;
  reason: string;
  validity: string;
  verify_point: string;
  fake_signal: string;
  type?: string;
  us_mapping?: string;
  origin_event?: string;
  transmission?: string[];
  beneficiary_type?: 'direct' | 'second_order' | 'hedge' | 'defensive' | string;
  direction?: 'bullish' | 'bearish' | 'neutral' | string;
}

export interface CommanderNewsItem {
  title: string;
  source: string;
  time: string;
  heat_score: number;
  tags: string[];
  importance?: 'primary' | 'secondary' | 'risk' | string;
  event_type?: string;
  horizon?: string;
  why_it_matters?: string;
  source_tier?: string;
  confidence?: string;
  column?: string;
}

export interface CommanderNewsAnalysis {
  summary: string;
  headline?: string;
  lead_event?: string;
  market_implication?: string;
  primary_news: CommanderNewsItem[];
  secondary_news: CommanderNewsItem[];
  risk_news: CommanderNewsItem[];
  impact_factors: string[];
  event_path?: string[];
  watch_points?: string[];
  event_driver?: string;
  transmission_chain?: string[];
  transmission_summary?: string;
  direction_map?: CommanderDirectionLeg[];
  falsifiers?: string[];
  contrarian_angle?: string;
  topic_clusters?: Array<{
    name: string;
    count: number;
    stance: string;
    takeaway: string;
  }>;
}

export interface CommanderFactorItem {
  name: string;
  score: number;
  detail: string;
}

export interface CommanderFactorEngine {
  stage: string;
  score: number;
  note: string;
  factors: CommanderFactorItem[];
  signals?: Array<{
    name: string;
    value: string;
    verdict: string;
  }>;
}

export interface CommanderTradeFilter {
  state: '真启动' | '仅观察' | '拉高出货' | string;
  reason: string;
  guidance: string;
  risk_level?: 'low' | 'medium' | 'high' | string;
  evidence?: string[];
  transmission_summary?: string;
  falsifiers?: string[];
}

export interface CommanderStrategicView {
  stance: string;
  themes?: string[];
  focus?: string[];
  rationale: string;
  risk_trigger?: string;
  direction?: 'bullish' | 'bearish' | 'neutral' | string;
  target_assets_or_themes?: string[];
  transmission_summary?: string;
  falsification?: string;
  contrarian_note?: string;
}

export interface CommanderStock {
  priority: string;
  stock: string;
  code: string;
  lane?: string;
  theme?: string;
  auction_price: string;
  auction_status: string;
  tactic: string;
  actionability?: '可执行' | '仅观察' | '放弃' | string;
  execution_note?: string;
  risk_note?: string;
  score?: number;
  beneficiary_type?: 'direct' | 'second_order' | 'hedge' | 'defensive' | string;
  related_event?: string;
  falsification?: string;
}

export interface CommanderLearningItem {
  theme?: string;
  code?: string;
  name?: string;
  lane: string;
  accuracy: number;
  wins: number;
  total: number;
  score: number;
}

export interface CommanderLearningFeedback {
  summary: string;
  window_days: number;
  theme_scores: {
    attack: Record<string, number>;
    defense: Record<string, number>;
  };
  stock_scores: Record<string, number>;
  top_themes: CommanderLearningItem[];
  risk_themes: CommanderLearningItem[];
  top_stocks: CommanderLearningItem[];
  risk_stocks: CommanderLearningItem[];
}

export interface CommanderSnapshotMeta {
  key: string;
  state: 'fresh' | 'stale' | 'boot' | 'expired' | string;
  updated_at?: string;
  age_seconds?: number;
  refreshing?: boolean;
  ttl_seconds?: number;
  max_stale_seconds?: number;
}

export interface CommanderVerificationMeta {
  status?: 'verified' | 'verifying' | 'pending_data' | 'waiting_market' | 'failed' | 'skipped' | 'queued' | string;
  message?: string;
  last_attempt_at?: string;
  last_success_at?: string;
  retry_after?: string | null;
  verify_date?: string;
  last_error?: string;
  accuracy?: number;
  total?: number;
  updated_at?: string;
}

export interface CommanderOrder {
  timestamp: string;
  snapshot_meta?: CommanderSnapshotMeta;
  context: {
    current_phase: string;
    label: string;
    action_now: string;
    market_clock: string;
  };
  battle_weather: CommanderWeather;
  yesterday_review: CommanderReview;
  news_analysis?: CommanderNewsAnalysis;
  factor_engine?: CommanderFactorEngine;
  trade_filter?: CommanderTradeFilter;
  strategic_views?: {
    long_term: CommanderStrategicView;
    short_term: CommanderStrategicView;
  };
  today_mainlines: {
    logic_a: CommanderLogic;
    logic_b: CommanderLogic;
    summary: string;
  };
  elite_stock_pool: {
    attack: CommanderStock[];
    defense: CommanderStock[];
  };
  learning_feedback?: CommanderLearningFeedback;
  commander_tips: {
    position: {
      attack: number;
      defense: number;
      cash: number;
    };
    position_text: string;
    current_phase?: string;
    phase_label?: string;
    action_now?: string;
    trade_state?: string;
    risk_flags?: string[];
    execution_windows?: Array<{
      phase: string;
      title: string;
      objective: string;
      command: string;
    }>;
    time_orders: Array<{
      time: string;
      condition: string;
      action: string;
    }>;
    focus: string;
  };
}

export interface CommanderSummary {
  timestamp: string;
  snapshot_meta?: CommanderSnapshotMeta;
  weather: CommanderWeather;
  review: CommanderReview;
  news_analysis?: CommanderNewsAnalysis;
  factor_engine?: CommanderFactorEngine;
  trade_filter?: CommanderTradeFilter;
  strategic_views?: {
    long_term: CommanderStrategicView;
    short_term: CommanderStrategicView;
  };
  mainlines: {
    logic_a: CommanderLogic;
    logic_b: CommanderLogic;
    summary: string;
  };
  current_phase?: string;
  phase_label?: string;
  action_now?: string;
  position: {
    attack: number;
    defense: number;
    cash: number;
  };
  position_text: string;
  focus: string;
  recommended_stocks: {
    attack: CommanderStock[];
    defense: CommanderStock[];
  };
  recent_accuracy: {
    accuracy: number;
    total: number;
    correct: number;
    days: number;
  };
  learning_feedback?: CommanderLearningFeedback;
  recent_records: Array<{
    date: string;
    logic_a?: CommanderLogic;
    logic_b?: CommanderLogic;
    verified: boolean;
    verification_meta?: CommanderVerificationMeta;
    verify_result?: {
      accuracy: number;
      verify_date?: string;
    };
  }>;
}

export interface CommanderHistoryRecord {
  date: string;
  logic_a?: CommanderLogic;
  logic_b?: CommanderLogic;
  verified: boolean;
  verification_meta?: CommanderVerificationMeta;
  verify_result?: {
    total: number;
    correct: number;
    accuracy: number;
    verify_date?: string;
    attribution?: {
      label: string;
      reason: string;
      failed_link?: string;
      next_action?: string;
    };
    stocks?: Array<{
      code: string;
      name: string;
      change: number;
      result: string;
      lane?: string;
      theme?: string;
      priority?: string;
    }>;
  };
}

export interface CommanderReviewDetail {
  date: string;
  logic_a?: CommanderLogic;
  logic_b?: CommanderLogic;
  verified: boolean;
  verification_meta?: CommanderVerificationMeta;
  learning_feedback?: CommanderLearningFeedback;
  verify_result?: {
    total: number;
    correct: number;
    accuracy: number;
    verify_date?: string;
    attribution?: {
      label: string;
      reason: string;
      failed_link?: string;
      next_action?: string;
    };
    stocks?: Array<{
      code: string;
      name: string;
      change: number;
      result: string;
      lane?: string;
      theme?: string;
      priority?: string;
    }>;
  } | null;
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

export interface NotificationConfigPayload {
  channels: {
    feishu_webhook: string;
    wecom_webhook: string;
    telegram_bot_token: string;
    telegram_chat_id: string;
    telegram_api_base: string;
    telegram_proxy_url: string;
  };
  schedule: {
    enabled: boolean;
    daily_time: string;
    timezone: string;
  };
}

export interface NotificationChannelResult {
  message?: string;
  ok?: boolean;
  errcode?: number;
  StatusCode?: number;
  code?: number;
}

export interface NotificationBroadcastResponse {
  status?: string;
  sent?: number;
  total?: number;
  results?: Record<string, NotificationChannelResult>;
}

export interface NotificationTestPayload {
  title: string;
  content: string;
  channels?: string[];
  config?: NotificationConfigPayload['channels'];
}

export interface NotificationDailyReportPayload {
  channels?: string[];
  config?: NotificationConfigPayload['channels'];
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
