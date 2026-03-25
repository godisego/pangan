// ============================================
// LoadingSkeleton Component
// ============================================

import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-[var(--bg-secondary)]/50';

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: '',
    none: ''
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
};

// Pre-built skeleton components

export const CardSkeleton: React.FC<{ title?: boolean; lines?: number }> = ({
  title = true,
  lines = 3
}) => (
  <div className="card rounded-lg p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3">
    {title && <Skeleton width="40%" height={24} />}
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  </div>
);

export const MetricCardSkeleton: React.FC = () => (
  <div className="p-3 bg-[var(--bg-secondary)] rounded-lg space-y-2">
    <Skeleton width={80} height={16} />
    <Skeleton width={120} height={24} />
    <Skeleton width={100} height={14} />
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4
}) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="flex-1" height={40} />
        ))}
      </div>
    ))}
  </div>
);

export const ChartSkeleton: React.FC<{ height?: string }> = ({
  height = '200px'
}) => (
  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 animate-pulse flex items-center justify-center">
    <div className="text-[var(--text-secondary)] text-sm" style={{ height }}>
      加载中...
    </div>
  </div>
);

export const KLineSkeleton: React.FC<{ height?: number }> = ({
  height = 350
}) => (
  <div
    className="w-full bg-[var(--bg-tertiary)]/30 animate-pulse rounded-lg flex items-center justify-center"
    style={{ height: `${height}px` }}
  >
    <span className="text-[var(--text-secondary)] text-sm">加载K线数据中...</span>
  </div>
);

export default Skeleton;
