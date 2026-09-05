import type { ReactNode } from 'react';
import { Tooltip, type TooltipVariant } from './Tooltip';

interface Props {
  variant?: TooltipVariant;
  children: ReactNode;
  onClose?: () => void;
}

export function Notice({ variant = 'info', children, onClose }: Props) {
  return <Tooltip variant={variant} content={children} onClose={onClose} />;
}
