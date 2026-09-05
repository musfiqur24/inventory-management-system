import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';

interface PageContainerProps {
  title: string;
  cap?: string;
  description?: string;
  actions?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
}

export function PageContainer({ title, cap, description, actions, notice, children }: PageContainerProps) {
  return (
    <section className="page-container">
      <PageHeader title={title} cap={cap} description={description} actions={actions} />
      {notice && <div className="page-container__notice">{notice}</div>}
      <div className="page-container__body">{children}</div>
    </section>
  );
}
