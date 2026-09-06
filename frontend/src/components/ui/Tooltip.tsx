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

export function Tooltip({
  children,
  content,
  variant = 'info',
  position = 'top',
  message,
  onClose,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  // If used as a message tooltip / notification banner
  if (message || content) {
    const bodyContent = message || content;
    return (
      <div className={twMerge(`flex items-center gap-3 p-[12px_16px] rounded-[12px] text-[13px] font-medium mb-4.5 leading-[1.45] shadow-[0_2px_6px_rgba(0,_0,_0,_0.03)] [transition:all_0.2s_ease] ${noticeVariants[variant] ?? ""}`)}>
        <div className="flex items-center shrink-0">{icons[variant]}</div>
        <div className="flex-1">{bodyContent}</div>
        {onClose && (
          <button type="button" className="bg-[transparent] [border:none] cursor-pointer p-1 text-inherit opacity-65 flex items-center rounded-[4px] [&:hover]:opacity-100 [&:hover]:bg-[rgba(0,_0,_0,_0.05)]" onClick={onClose} aria-label="Close tooltip">
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  // Hoverable tooltip wrapper around children
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
   >
      {children}
      {visible && content && (
        <div className={twMerge(`absolute z-1000 p-[6px_12px] bg-[#0f172a] text-[#f8fafc] text-[12px] font-medium rounded-[6px] whitespace-nowrap shadow-[0_4px_14px_rgba(0,_0,_0,_0.18)] pointer-events-none ${tooltipPositions[position] ?? ""}`)}>
          {content}
        </div>
      )}
    </div>
  );
}
