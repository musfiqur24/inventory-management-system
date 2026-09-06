import type { HTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'flat' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'none' | 'sm' | 'md' | 'lg';
}

const variants = {
  default: '',
  elevated: 'shadow-[0_4px_16px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)] border-transparent',
  flat: 'shadow-none bg-[#f8faf7]',
  accent: 'border-[#1a5c45] bg-linear-to-br from-[#f0f9f5] to-white',
};
const paddings = { none: 'p-0', sm: 'p-4', md: 'p-4 sm:p-6', lg: 'p-5 sm:p-8' };
const radii = { none: 'rounded-none', sm: 'rounded-lg', md: 'rounded-xl', lg: 'rounded-[18px]' };

export function Card({ children, variant = 'default', padding = 'md', rounded = 'sm', className, onClick, ...props }: CardProps) {
  return (
    <div
      {...props}
      onClick={onClick}
      className={twMerge(
        'overflow-hidden border border-[#e0e5dd] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,transform] duration-180 print:break-inside-avoid print:border-[#ccc] print:shadow-none',
        variants[variant], paddings[padding], radii[rounded],
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
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
