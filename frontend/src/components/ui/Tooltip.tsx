import { twMerge } from 'tailwind-merge';
import { noticeVariants, tooltipPositions } from '../../shared/styles/variants';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Info, AlertTriangle, CheckCircle2, XCircle, X } from 'lucide-react';

export type TooltipVariant = 'info' | 'warn' | 'error' | 'success';
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  children?: ReactNode;
  content?: ReactNode;
  variant?: TooltipVariant;
  position?: TooltipPosition;
  message?: string;
  onClose?: () => void;
}

const icons: Record<TooltipVariant, ReactNode> = {
  info: <Info size={16} />,
  warn: <AlertTriangle size={16} />,
  error: <XCircle size={16} />,
  success: <CheckCircle2 size={16} />,
};

export function Tooltip({ children, content, variant = 'info', position = 'top', message, onClose }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pinned, setPinned] = useState(false);

  if (!children && (message || content)) {
    const bodyContent = message || content;
    return (
      <div className={twMerge(`flex items-center gap-3 p-[12px_16px] rounded-[12px] text-[13px] font-medium mb-4.5 leading-[1.45] shadow-[0_2px_6px_rgba(0,_0,_0,_0.03)] [transition:all_0.2s_ease] ${noticeVariants[variant] ?? ''}`)}>
        <div className="flex shrink-0 items-center">{icons[variant]}</div>
        <div className="flex-1">{bodyContent}</div>
        {onClose && <button type="button" className="flex cursor-pointer items-center rounded-[4px] border-none bg-transparent p-1 text-inherit opacity-65 hover:bg-black/5 hover:opacity-100" onClick={onClose} aria-label="Close tooltip"><X size={14} /></button>}
      </div>
    );
  }

  return (
    <div
      className="relative block min-w-0 outline-none"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onClick={() => setPinned((value) => !value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setPinned((value) => !value);
        }
      }}
      tabIndex={0}
      role="button"
      aria-expanded={visible || pinned}
    >
      {children}
      {(visible || pinned) && content && (
        <div role="tooltip" className={twMerge(`pointer-events-none absolute z-1000 w-max max-w-[min(22rem,calc(100vw-2rem))] rounded-lg bg-[#173b30] p-4 text-left text-xs font-medium leading-relaxed text-white shadow-[0_8px_24px_rgba(0,0,0,0.24)] ${tooltipPositions[position] ?? ''}`)}>
          {content}
        </div>
      )}
    </div>
  );
}
