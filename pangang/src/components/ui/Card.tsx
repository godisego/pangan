// ============================================
// Card Component
// ============================================

import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'bordered' | 'elevated';
  gradient?: string;
  border?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  gradient,
  border,
  onClick
}) => {
  const baseClasses = 'card rounded-lg p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)]';

  const variantClasses = {
    default: '',
    gradient: gradient ? `bg-gradient-to-r ${gradient}` : '',
    bordered: border ? `border ${border}` : '',
    elevated: 'shadow-lg'
  };

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${className} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`;

  return (
    <section className={combinedClasses} onClick={onClick}>
      {children}
    </section>
  );
};

export default Card;
