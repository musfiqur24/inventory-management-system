import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

type Variant = 'info' | 'warn' | 'error' | 'success';

interface Props {
  variant?: Variant;
  children: ReactNode;
}

const icons: Record<Variant, ReactNode> = {
  info: <Info size={16} />,
  warn: <AlertTriangle size={16} />,
  error: <XCircle size={16} />,
  success: <CheckCircle2 size={16} />,
};

export function Notice({ variant = 'info', children }: Props) {
  return (
    <div className={`notice notice--${variant}`}>
      {icons[variant]}
      <span>{children}</span>
    </div>
  );
}
