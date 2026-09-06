import { twMerge } from 'tailwind-merge';
import { badgeVariants } from '../../shared/styles/variants';
interface BadgeProps {
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' | 'brand';
  children: string | number;
  dot?: boolean;
}

export function Badge({ variant = 'gray', children, dot = true }: BadgeProps) {
  return (
    <span className={twMerge(`inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap ${badgeVariants[variant] ?? ""}`)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />}
      {children}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    DRAFT: { variant: 'gray', label: 'Draft' },
    SUBMITTED: { variant: 'blue', label: 'Submitted' },
    APPROVED: { variant: 'green', label: 'Approved' },
    REJECTED: { variant: 'red', label: 'Rejected' },
    PARTIALLY_RECEIVED: { variant: 'yellow', label: 'Partial' },
    RECEIVED: { variant: 'green', label: 'Received' },
    CLOSED: { variant: 'purple', label: 'Closed' },
    CANCELLED: { variant: 'red', label: 'Cancelled' },
    PENDING: { variant: 'yellow', label: 'Pending' },
    RELEASED: { variant: 'green', label: 'Released' },
    HOLD: { variant: 'yellow', label: 'On Hold' },
  };
  const cfg = map[status] ?? { variant: 'gray', label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
