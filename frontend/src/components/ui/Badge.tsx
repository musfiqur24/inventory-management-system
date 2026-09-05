interface BadgeProps {
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' | 'brand';
  children: string | number;
  dot?: boolean;
}

export function Badge({ variant = 'gray', children, dot = true }: BadgeProps) {
  return (
    <span className={`badge badge--${variant}`}>
      {dot && <span className="badge__dot" />}
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
