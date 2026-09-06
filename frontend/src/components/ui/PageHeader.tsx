import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
  cap?: string;
}

export function PageHeader({ title, description, actions, cap }: Props) {
  return (
    <div className="flex items-center justify-between gap-5 mb-5 p-[16px_20px] bg-[#ffffff] [border:1px_solid_#e0e5dd] rounded-[8px] shadow-[0_1px_3px_rgba(0,_0,_0,_0.03)] [:where(&_h1)]:[font-family:'Outfit',_sans-serif] [:where(&_h1)]:text-[20px] [:where(&_h1)]:font-bold [:where(&_h1)]:text-[#0f1c16] [:where(&_h1)]:leading-[1.2] [:where(&_h1)]:tracking-[-0.2px] [:where(&_h1)]:m-0 max-[900px]:flex-col max-[480px]:[:where(&_h1)]:text-[18px]">
      <div className="[&_p.cap]:m-[0_0_2px] [&_p.cap]:text-[10px] [&_p.cap]:font-bold [&_p.cap]:tracking-[0.1em] [&_p.cap]:uppercase [&_p.cap]:text-[#1a5c45]">
        {cap && <p className="cap">{cap}</p>}
        <h1>{title}</h1>
        {description && <p className="text-[12.5px] text-[#7a9185] m-[2px_0_0] max-w-162.5 leading-[1.45]">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0 max-[900px]:w-full">{actions}</div>}
    </div>
  );
}
