import type { HTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'flat' | 'accent';
  tone?: 'cream' | 'sand' | 'sage' | 'mint' | 'peach' | 'rose' | 'lavender' | string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'none' | 'sm' | 'md' | 'lg';
}

const variants = {
  default: '',
  elevated: 'shadow-[0_4px_16px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)] border-transparent',
  flat: 'shadow-none bg-[#f8faf7]',
  accent: 'border-[#1a5c45] bg-linear-to-br from-[#f0f9f5] to-white',
};
const tones: Record<string, string> = {
  cream: 'border-[#e5dac5] bg-linear-to-br from-[#fffdf6] via-[#fcf7ec] to-[#f4ead8]',
  brand: 'border-[#cbded2] bg-linear-to-br from-[#f8fcf7] via-[#eff6ed] to-[#e1eee5]',
  green: 'border-[#c8dfcf] bg-linear-to-br from-[#f8fcf5] via-[#edf7ea] to-[#def0e2]',
  sage: 'border-[#d1dfc8] bg-linear-to-br from-[#fbfcf5] via-[#f0f5e8] to-[#e4edd9]',
  mint: 'border-[#c5dfd5] bg-linear-to-br from-[#f7fcf9] via-[#eaf6ef] to-[#dceee5]',
  blue: 'border-[#cddde1] bg-linear-to-br from-[#f7fbfc] via-[#edf5f6] to-[#dfedef]',
  yellow: 'border-[#e7d8b8] bg-linear-to-br from-[#fffaf0] via-[#fcf3df] to-[#f6e8ca]',
  sand: 'border-[#e3d3b7] bg-linear-to-br from-[#fffaf0] via-[#f9f0df] to-[#f1e2c9]',
  purple: 'border-[#d9d2e5] bg-linear-to-br from-[#fcf9ff] via-[#f3eef8] to-[#e9e1f1]',
  lavender: 'border-[#d9d2e5] bg-linear-to-br from-[#fcf9ff] via-[#f3eef8] to-[#e9e1f1]',
  red: 'border-[#e7cfc6] bg-linear-to-br from-[#fff8f4] via-[#fbeee8] to-[#f3dfd7]',
  peach: 'border-[#e8d0c0] bg-linear-to-br from-[#fff8f2] via-[#faece2] to-[#f2ddcf]',
  rose: 'border-[#e6cccc] bg-linear-to-br from-[#fff8f8] via-[#faecec] to-[#f2dddd]',
  gray: 'border-[#d7ddd3] bg-linear-to-br from-[#fbfcf7] via-[#f2f4ed] to-[#e8ece3]',
};
const paddings = { none: 'p-0', sm: 'p-4', md: 'p-4 sm:p-6', lg: 'p-5 sm:p-8' };
const radii = { none: 'rounded-none', sm: 'rounded-lg', md: 'rounded-xl', lg: 'rounded-[18px]' };

export function Card({ children, variant = 'default', tone = 'cream', padding = 'md', rounded = 'sm', className, onClick, ...props }: CardProps) {
  return (
    <div
      {...props}
      onClick={onClick}
      className={twMerge(
        'min-w-0 overflow-hidden border shadow-[0_3px_12px_rgba(65,55,38,0.055),0_1px_2px_rgba(65,55,38,0.035)] transition-[box-shadow,transform] duration-180 [&>div:has(table)]:m-2 sm:[&>div:has(table)]:m-5 print:break-inside-avoid print:border-[#ccc] print:bg-white print:shadow-none print:[&>div:has(table)]:m-0',
        tones[tone] ?? tones.cream, variants[variant], paddings[padding], radii[rounded],
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
   >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function CardHeader({ title, description, icon, actions }: CardHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-start gap-3.5">
      {icon && <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#e0e5dd] bg-[#f8faf7] text-[#1a5c45] [:where(&_svg)]:size-4.5">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h2 className="mb-0.75 text-[15px] font-bold text-[#0f1c16]">{title}</h2>
        {description && <p className="text-[12.5px] leading-[1.4] text-[#7a9185]">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 [&>button]:max-sm:flex-1">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
