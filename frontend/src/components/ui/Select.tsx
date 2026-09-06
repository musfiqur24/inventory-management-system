import { twMerge } from 'tailwind-merge';
import type { SelectHTMLAttributes } from 'react';

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={twMerge(`w-full p-[10px_13px] [border:1.5px_solid_#e0e5dd] rounded-[8px] bg-[#fff] text-[#0f1c16] text-[14px] [transition:border-color_0.15s,_box-shadow_0.15s] outline-none appearance-auto [&:focus]:[border-color:#1a5c45] [&:focus]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] pr-9 cursor-pointer ${props.className ?? ''}`)} />;
}
