// ============================================
// MetricCard Component
// ============================================

import React from 'react';
import type { StatusType } from '@/types/api';
import { StatusTag } from './StatusTag';

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  unit?: string;
  status?: StatusType;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeLabel = '',
  unit = '',
  status,
  icon,
  trend,
  className = '',
  onClick
}) => {
  const trendColor = trend === 'up' ? 'text-[var(--accent-green)]' : trend === 'down' ? 'text-[var(--accent-red)]' : 'text-[var(--text-secondary)]';

  return (
    <div
      className={`p-3 bg-[var(--bg-secondary)] rounded-lg ${onClick ? 'cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--text-secondary)]">{title}</span>
        {status && <StatusTag status={status} size="sm" showIcon={false} />}
      </div>
      <div className="flex items-baseline gap-1">
        {icon && <span className="text-sm">{icon}</span>}
        <span className="text-sm font-bold text-[var(--text-primary)]">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-xs text-[var(--text-secondary)]">{unit}</span>}
      </div>
      {(change !== undefined || changeLabel) && (
        <div className={`text-xs mt-1 ${change !== undefined ? (change >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]') : 'text-[var(--text-secondary)]'}`}>
          {changeLabel || (change !== undefined ? `${change >= 0 ? '+' : ''}${change}%` : '')}
        </div>
      )}
    </div>
  );
};

export default MetricCard;
