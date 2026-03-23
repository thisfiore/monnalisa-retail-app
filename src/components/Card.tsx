import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-6 ${className}`}>
      {title && <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>}
      {children}
    </div>
  );
}
