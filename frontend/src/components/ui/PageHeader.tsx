import type { ReactNode } from "react";
interface Props{title:string;description?:string;actions?:ReactNode;cap?:string;}
export function PageHeader({title,description,actions,cap}:Props){
  return <header className="mb-4 flex flex-col gap-4 rounded-xl border border-[#dfe5df] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,28,22,0.04)] sm:mb-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <div className="min-w-0">
      {cap&&<p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1a5c45]">{cap}</p>}
      <h1 className="font-['Outfit',sans-serif] text-[22px] font-bold leading-tight tracking-[-0.025em] text-[#0f1c16] sm:text-2xl">{title}</h1>
      {description&&<p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-[#6f8579] sm:text-sm">{description}</p>}
    </div>
    {actions&&<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 [&>button]:max-sm:flex-1">{actions}</div>}
  </header>;
}
