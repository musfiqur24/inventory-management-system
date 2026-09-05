import type { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  /** 'default' | 'elevated' | 'flat' | 'accent' */
  variant?: 'default' | 'elevated' | 'flat' | 'accent';
  /** Padding: 'sm' | 'md' (default) | 'lg' | 'none' */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Rounded: 'none' | 'sm' (default) | 'md' | 'lg' */
  rounded?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  rounded = 'sm',
  className = '',
  style,
  onClick,
}: CardProps) {
  const cls = [
    'ui-card',
    `ui-card--${variant}`,
    `ui-card--pad-${padding}`,
    `ui-card--rounded-${rounded}`,
    onClick ? 'ui-card--clickable' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} style={style} onClick={onClick}>
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
    <div className="ui-card__header">
      {icon && <div className="ui-card__header-icon">{icon}</div>}
      <div className="ui-card__header-text">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ui-card__header-actions">{actions}</div>}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={`ui-card__body ${className}`.trim()}>{children}</div>;
}
