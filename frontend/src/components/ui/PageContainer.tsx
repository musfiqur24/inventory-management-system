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
    <section className="max-w-360 m-[0_auto] p-[36px_clamp(24px,_4vw,_52px)_72px] flex flex-col gap-0">
      <PageHeader title={title} cap={cap} description={description} actions={actions} />
      {notice && <div className="mb-5">{notice}</div>}
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}
