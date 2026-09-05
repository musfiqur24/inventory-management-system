import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', className = '', children, ...props }: Props) {
  return (
    <button
      {...props}
      className={`ui-button ui-button--${variant} ${size === 'sm' ? 'ui-button--sm' : ''} ${className}`}
    >
      {children}
    </button>
  );
}
