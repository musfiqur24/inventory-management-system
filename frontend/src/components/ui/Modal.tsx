import { twMerge } from 'tailwind-merge';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  onClose: () => void;
}

export function Modal({ title, description, children, footer, wide, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-100 bg-[rgba(12,_24,_18,_0.65)] [backdrop-filter:blur(6px)] flex items-center justify-center p-5 animate-[fade-in_0.2s_ease-out] print:hidden!" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={twMerge(`bg-[#ffffff] [border:1px_solid_#e0e5dd] rounded-[16px] shadow-[0_24px_48px_-12px_rgba(0,_0,_0,_0.25),_0_0_0_1px_rgba(255,_255,_255,_0.05)] w-full max-w-150 max-h-[90vh] flex flex-col overflow-hidden animate-[slide-up_0.24s_ease-out] ${(wide ? "max-w-210" : "")}`)} role="dialog" aria-modal>
        <div className="flex items-start justify-between p-[24px_28px_18px] [border-bottom:1px_solid_#e0e5dd] bg-[#ffffff] [:where(&_h2)]:text-[19px] [:where(&_h2)]:font-bold [:where(&_h2)]:text-[#0f1c16] [:where(&_h2)]:m-0 [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[4px_0_0] [:where(&_p)]:leading-[1.45]">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="grid place-items-center w-8 h-8 [border:1px_solid_#e0e5dd] bg-[#f8faf7] rounded-[8px] text-[#7a9185] [transition:all_0.15s_ease] shrink-0 cursor-pointer [&:hover]:bg-[#fdf0f0] [&:hover]:text-[#c03030] [&:hover]:[border-color:#c03030]" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-[24px_28px] overflow-y-auto flex flex-col gap-4 flex-1">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 p-[16px_28px] [border-top:1px_solid_#e0e5dd] bg-[#f8faf7]">{footer}</div>}
      </div>
    </div>
  );
}
