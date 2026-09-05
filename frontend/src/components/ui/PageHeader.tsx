import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
  cap?: string;
}

export function PageHeader({ title, description, actions, cap }: Props) {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header__meta">
        {cap && <p className="cap">{cap}</p>}
        <h1>{title}</h1>
        {description && <p className="ui-page-header__desc">{description}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </div>
  );
}
