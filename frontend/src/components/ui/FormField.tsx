import type { ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}

export function FormField({ label, children, hint, required }: Props) {
  return (
    <div className="ui-field">
      <label>
        {label}
        {required && <span style={{ color: 'var(--error)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>{hint}</p>}
    </div>
  );
}
