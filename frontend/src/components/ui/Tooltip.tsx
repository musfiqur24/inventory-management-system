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
      <div className={`ui-tooltip-banner ui-tooltip-banner--${variant}`}>
        <div className="ui-tooltip-banner__icon">{icons[variant]}</div>
        <div className="ui-tooltip-banner__text">{bodyContent}</div>
        {onClose && (
          <button type="button" className="ui-tooltip-banner__close" onClick={onClose} aria-label="Close tooltip">
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  // Hoverable tooltip wrapper around children
  return (
    <div
      className="ui-tooltip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <div className={`ui-tooltip-bubble ui-tooltip-bubble--${position}`}>
          {content}
        </div>
      )}
    </div>
  );
}
