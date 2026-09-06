import { twMerge } from "tailwind-merge";
import { buttonVariants } from "../../shared/styles/variants";
import type { ButtonHTMLAttributes,ReactNode } from "react";
type Variant="primary"|"secondary"|"ghost"|"danger"|"accent";
interface Props extends ButtonHTMLAttributes<HTMLButtonElement>{variant?:Variant;size?:"sm"|"md";children:ReactNode;}
export function Button({variant="secondary",size="md",className,children,type,...props}:Props){
  return <button type={type} {...props} className={twMerge("inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-[13px] font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1a5c45]/15 disabled:pointer-events-none disabled:opacity-50 print:hidden",buttonVariants[variant],size==="sm"&&"min-h-9 px-3 text-xs",className)}>{children}</button>;
}
