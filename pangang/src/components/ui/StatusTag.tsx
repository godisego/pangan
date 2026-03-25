// ============================================
// StatusTag Component
// ============================================

import React from 'react';
import type { StatusType } from '@/types/api';

export interface StatusTagProps {
  status: StatusType | string;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  bullish: { label: '看多', color: 'text-[var(--accent-green)]', bg: 'bg-[var(--accent-green)]/20', icon: '🟢' },
  cautious_bullish: { label: '谨慎看多', color: 'text-green-400', bg: 'bg-green-400/20', icon: '🟡' },
  neutral: { label: '中性', color: 'text-yellow-400', bg: 'bg-yellow-400/20', icon: '🟡' },
  cautious_bearish: { label: '谨慎看空', color: 'text-orange-400', bg: 'bg-orange-400/20', icon: '🟠' },
  bearish: { label: '看空', color: 'text-[var(--accent-red)]', bg: 'bg-[var(--accent-red)]/20', icon: '🔴' },
  caution: { label: '警惕', color: 'text-orange-400', bg: 'bg-orange-400/20', icon: '⚠️' },
  opportunity: { label: '机会', color: 'text-[var(--accent-green)]', bg: 'bg-[var(--accent-green)]/20', icon: '✨' },
  // Additional stock statuses
  bull: { label: '可操作', color: 'text-[var(--accent-green)]', bg: 'bg-[var(--accent-green)]/20', icon: '🟢' },
  bear: { label: '主跌风险', color: 'text-[var(--accent-red)]', bg: 'bg-[var(--accent-red)]/20', icon: '🔴' }
};

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm'
};

export const StatusTag: React.FC<StatusTagProps> = ({
  status,
  className = '',
  showIcon = true,
  size = 'sm'
}) => {
  const config = statusConfig[status] || statusConfig.neutral;
  const sizeClass = sizeClasses[size];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${config.bg} ${config.color} ${sizeClass} ${className}`}>
      {showIcon && <span>{config.icon}</span>}
      <span className="font-medium">{config.label}</span>
    </span>
  );
};

export default StatusTag;
