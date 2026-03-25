// ============================================
// Formatter Utilities
// ============================================

/**
 * Format price with currency symbol
 */
export function formatPrice(price: number | string, currency: string = '$'): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return 'N/A';
  return `${currency}${numPrice.toLocaleString()}`;
}

/**
 * Format percentage with sign
 */
export function formatPercent(value: number, decimals: number = 2): string {
  if (isNaN(value)) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format number with locale
 */
export function formatNumber(value: number | string, decimals: number = 0): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';
  return numValue.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format large numbers with abbreviations (K, M, B, T)
 */
export function formatLargeNumber(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';

  const absValue = Math.abs(numValue);

  if (absValue >= 1e12) return `${(numValue / 1e12).toFixed(1)}T`;
  if (absValue >= 1e9) return `${(numValue / 1e9).toFixed(1)}B`;
  if (absValue >= 1e6) return `${(numValue / 1e6).toFixed(1)}M`;
  if (absValue >= 1e3) return `${(numValue / 1e3).toFixed(1)}K`;

  return numValue.toString();
}

/**
 * Format volume with units (亿, 万)
 */
export function formatVolume(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';

  const absValue = Math.abs(numValue);

  if (absValue >= 1e8) return `${(numValue / 1e8).toFixed(2)}亿`;
  if (absValue >= 1e4) return `${(numValue / 1e4).toFixed(2)}万`;

  return numValue.toString();
}

/**
 * Format time to relative string (e.g., "5分钟前")
 */
export function formatRelativeTime(timeStr: string): string {
  if (!timeStr) return '';

  try {
    const date = new Date(timeStr.replace(/(\d{4}-\d{2}-\d{2})\s/, '$1T'));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (isNaN(diffMs) || diffMs < 0) return '';

    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;

    return `${Math.floor(diffHour / 24)}天前`;
  } catch {
    return '';
  }
}

/**
 * Format date to locale string
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'N/A';

  return dateObj.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  });
}

/**
 * Format timestamp to time string
 */
export function formatTime(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(date.getTime())) return 'N/A';

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format RSI value with interpretation
 */
export function formatRSI(rsi: number): { value: string; interpretation: string; isBullish: boolean } {
  if (isNaN(rsi)) {
    return { value: 'N/A', interpretation: '无数据', isBullish: false };
  }

  let interpretation = '中性';
  let isBullish = true;

  if (rsi >= 70) {
    interpretation = '超买';
    isBullish = false;
  } else if (rsi >= 50) {
    interpretation = '偏强';
  } else if (rsi >= 30) {
    interpretation = '偏弱';
    isBullish = false;
  } else {
    interpretation = '超卖';
    isBullish = true;
  }

  return {
    value: rsi.toFixed(1),
    interpretation,
    isBullish
  };
}

/**
 * Format fear and greed index
 */
export function formatFearGreed(value: number): {
  value: string;
  label: string;
  color: string;
  isBullish: boolean;
} {
  if (isNaN(value)) {
    return { value: 'N/A', label: '未知', color: 'text-gray-400', isBullish: false };
  }

  let label = '中性';
  let color = 'text-yellow-400';
  let isBullish = true;

  if (value >= 75) {
    label = '极度贪婪';
    color = 'text-red-400';
    isBullish = false;
  } else if (value >= 55) {
    label = '贪婪';
  } else if (value >= 45) {
    label = '中性';
  } else if (value >= 25) {
    label = '恐惧';
    isBullish = true;
  } else {
    label = '极度恐惧';
    color = 'text-[var(--accent-green)]';
    isBullish = true;
  }

  return {
    value: value.toString(),
    label,
    color,
    isBullish
  };
}

/**
 * Format funding rate
 */
export function formatFundingRate(rate: number): {
  value: string;
  interpretation: string;
  isBullish: boolean;
} {
  if (isNaN(rate)) {
    return { value: 'N/A', interpretation: '无数据', isBullish: false };
  }

  let interpretation = '中性';
  let isBullish = true;

  if (rate > 0.01) {
    interpretation = '多头过热';
    isBullish = false;
  } else if (rate > -0.01) {
    interpretation = '中性';
  } else {
    interpretation = '空头过热';
    isBullish = true;
  }

  return {
    value: `${rate > 0 ? '+' : ''}${rate.toFixed(4)}%`,
    interpretation,
    isBullish
  };
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Format stock code
 */
export function formatStockCode(code: string): string {
  // Add leading zeros if needed (e.g., 600000 -> 600000)
  return code.padStart(6, '0');
}

/**
 * Get trend direction from change value
 */
export function getTrendDirection(change: number): 'up' | 'down' | 'neutral' {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'neutral';
}

/**
 * Get color class for trend
 */
export function getTrendColor(change: number): string {
  const trend = getTrendDirection(change);
  if (trend === 'up') return 'text-[var(--accent-green)]';
  if (trend === 'down') return 'text-[var(--accent-red)]';
  return 'text-[var(--text-secondary)]';
}

/**
 * Format score with color class
 */
export function formatScore(score: number, maxScore: number = 100): {
  value: string;
  percentage: number;
  color: string;
} {
  const percentage = (score / maxScore) * 100;
  let color = 'text-yellow-400';

  if (percentage >= 70) color = 'text-[var(--accent-green)]';
  else if (percentage >= 40) color = 'text-yellow-400';
  else color = 'text-[var(--accent-red)]';

  return {
    value: score.toString(),
    percentage,
    color
  };
}

export default {
  formatPrice,
  formatPercent,
  formatNumber,
  formatLargeNumber,
  formatVolume,
  formatRelativeTime,
  formatDate,
  formatTime,
  formatRSI,
  formatFearGreed,
  formatFundingRate,
  truncateText,
  formatStockCode,
  getTrendDirection,
  getTrendColor,
  formatScore
};
