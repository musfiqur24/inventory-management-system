import { Check } from "lucide-react";
import { twMerge } from "tailwind-merge";
import type { InputHTMLAttributes } from "react";
export function Checkbox({label,className,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string}){
 return <label className={twMerge("group inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-[#dbe3dc] bg-white px-3.5 text-sm font-medium text-[#2d4438] transition hover:border-[#aebdb2] hover:bg-[#fafcf9] has-checked:border-[#8baa83] has-checked:bg-[#f2f8ef] has-focus-visible:ring-4 has-focus-visible:ring-[#1a5c45]/10",className)}>
  <input type="checkbox" className="peer sr-only" {...props}/><span className="grid size-5 shrink-0 place-items-center rounded border border-[#b9c6bc] bg-white text-transparent transition peer-checked:border-[#1a5c45] peer-checked:bg-[#1a5c45] peer-checked:text-white"><Check size={13} strokeWidth={3}/></span><span>{label}</span>
 </label>;
}
