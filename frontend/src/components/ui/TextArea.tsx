import { twMerge } from "tailwind-merge";
import type { TextareaHTMLAttributes } from "react";
export function TextArea({className,...props}:TextareaHTMLAttributes<HTMLTextAreaElement>){
 return <textarea {...props} className={twMerge("min-h-24 w-full resize-y rounded-lg border border-[#d7dfd8] bg-white px-3.5 py-3 text-sm text-[#0f1c16] shadow-[0_1px_2px_rgba(15,28,22,0.03)] outline-none transition placeholder:text-[#8a9a91] hover:border-[#b8c5bb] focus:border-[#1a5c45] focus:ring-4 focus:ring-[#1a5c45]/10 disabled:cursor-not-allowed disabled:bg-[#f2f4f1]",className)}/>;
}
