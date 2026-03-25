// ============================================
// Unified API Client
// ============================================

import type {
  BtcSummary,
  BtcTechnical,
  BtcDerivatives,
  BtcNetwork,
  BtcMarket,
  BtcKline,
  StockMarket,
  StockSelection,
  StockDetail,
  MacroDashboard,
  MacroTrending,
  NotificationRequest,
  NotificationResponse,
  HealthCheck,
  FetchOptions,
  BtcDetail,
  CommanderOrder
} from '../types/api';

// ============================================
// Configuration
// ============================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_RETRIES = 2;

// ============================================
// Error Classes
// ============================================

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class TimeoutError extends ApiError {
  constructor(endpoint: string, timeout: number) {
    super(`Request to ${endpoint} timed out after ${timeout}ms`, undefined, endpoint);
    this.name = 'TimeoutError';
  }
}

// ============================================
// Core Fetch Function
// ============================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(url, timeout);
    }
    throw error;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    method = 'GET',
    body,
    headers = {}
  } = options;

  const url = `${API_BASE_URL}${endpoint}`;
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        timeout
      });

      if (!response.ok) {
        throw new ApiError(
          `API Error: ${response.statusText}`,
          response.status,
          endpoint
        );
      }

      const data = await response.json();
      return data as T;

    } catch (error) {
      lastError = error as Error;

      // Don't retry on 4xx errors (client errors)
      if (error instanceof ApiError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }

      // Don't retry on timeout if this is the last attempt
      if (error instanceof TimeoutError && attempt === retries) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || new ApiError('Unknown error occurred');
}

// ============================================
// BTC API Functions
// ============================================

export const btcApi = {
  /**
   * Get BTC summary data
   */
  getSummary: (): Promise<BtcSummary> =>
    fetchApi<BtcSummary>('/api/btc/summary'),

  /**
   * Get BTC technical analysis
   */
  getTechnical: (): Promise<BtcTechnical> =>
    fetchApi<BtcTechnical>('/api/btc/technical'),

  /**
   * Get BTC derivatives data
   */
  getDerivatives: (): Promise<BtcDerivatives> =>
    fetchApi<BtcDerivatives>('/api/btc/derivatives'),

  /**
   * Get BTC network health data
   */
  getNetwork: (): Promise<BtcNetwork> =>
    fetchApi<BtcNetwork>('/api/btc/network'),

  /**
   * Get BTC market data
   */
  getMarket: (): Promise<BtcMarket> =>
    fetchApi<BtcMarket>('/api/btc/market'),

  /**
   * Get BTC K-line data
   */
  getKline: (interval: string = '1H'): Promise<BtcKline> =>
    fetchApi<BtcKline>(`/api/btc/kline?interval=${interval}`),

  /**
   * Get all BTC detail data (combined)
   */
  getDetail: async (): Promise<any> => {
    const [summary, technical, derivatives, network, market] = await Promise.all([
      fetchApi<BtcSummary>('/api/btc/summary'),
      fetchApi<BtcTechnical>('/api/btc/technical'),
      fetchApi<BtcDerivatives>('/api/btc/derivatives').catch(() => null),
      fetchApi<BtcNetwork>('/api/btc/network').catch(() => null),
      fetchApi<BtcMarket>('/api/btc/market').catch(() => null)
    ]);

    return {
      ...summary,
      ...technical,
      derivatives,
      network,
      market
    };
  }
};

// ============================================
// Stock API Functions
// ============================================

export const stockApi = {
  /**
   * Get stock market data
   */
  getMarket: (): Promise<StockMarket> =>
    fetchApi<StockMarket>('/api/stock/market'),

  /**
   * Get stock selection data
   */
  getSelection: (): Promise<StockSelection> =>
    fetchApi<StockSelection>('/api/stock/selection'),

  /**
   * Get stock quote by code
   */
  getQuote: (code: string): Promise<StockDetail> =>
    fetchApi<StockDetail>(`/api/stock/quote/${code}`),

  /**
   * Get stock detail by code
   */
  getDetail: (code: string): Promise<StockDetail> =>
    fetchApi<StockDetail>(`/api/stock/${code}`)
};

// ============================================
// Macro API Functions
// ============================================

export const macroApi = {
  /**
   * Get macro dashboard data
   */
  getDashboard: (): Promise<MacroDashboard> =>
    fetchApi<MacroDashboard>('/api/macro/dashboard', { timeout: 60000 }),

  /**
   * Get trending news
   */
  getTrending: (): Promise<MacroTrending> =>
    fetchApi<MacroTrending>('/api/macro/trending')
};

// ============================================
// Notification API Functions
// ============================================

export const notifyApi = {
  /**
   * Send notification
   */
  send: (data: NotificationRequest): Promise<NotificationResponse> =>
    fetchApi<NotificationResponse>('/api/notify/send', {
      method: 'POST',
      body: data
    })
};

// ============================================
// Health Check
// ============================================

export const healthApi = {
  /**
   * Check API health
   */
  check: (): Promise<HealthCheck> =>
      fetchApi<HealthCheck>('/health')
};

// ============================================
// Commander API Functions
// ============================================

export const commanderApi = {
  getOrder: async (): Promise<CommanderOrder> => {
    const response = await fetchApi<{ status: string; data: CommanderOrder }>('/api/commander/order', {
      timeout: 60000
    });
    return response.data;
  }
};

// ============================================
// Export default API client
// ============================================

export default {
  btc: btcApi,
  stock: stockApi,
  macro: macroApi,
  notify: notifyApi,
  commander: commanderApi,
  health: healthApi,
  fetch: fetchApi
};
