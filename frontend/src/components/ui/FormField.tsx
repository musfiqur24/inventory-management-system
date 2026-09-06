import type { ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}

export function FormField({ label, children, hint, required }: Props) {
  return (
    <div className="flex flex-col gap-1.5 mb-4 [&_label]:text-[12.5px] [&_label]:font-semibold [&_label]:text-[#445e50]">
      <label>
        {label}
        {required && <span className="text-[#c03030] ml-0.75">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-[#7a9185] m-0">{hint}</p>}
    </div>
  );
}
