import { twMerge } from 'tailwind-merge';
import { buttonVariants } from '../../shared/styles/variants';
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
      className={twMerge(`inline-flex items-center gap-1.75 [border:0] rounded-[8px] p-[9px_16px] font-semibold text-[13.5px] cursor-pointer [transition:all_0.15s] whitespace-nowrap [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [&:disabled]:opacity-50 [&:disabled]:cursor-not-allowed [&:disabled]:[transform:none]! print:hidden! ${buttonVariants[variant] ?? ""}  ${(size === 'sm' ? "p-[6px_10px] text-[12px]" : "")}  ${className}`)}
   >
      {children}
    </button>
  );
}
