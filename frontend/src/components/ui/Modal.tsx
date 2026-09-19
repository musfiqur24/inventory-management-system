import { useEffect,useId,type ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { X } from "lucide-react";
interface Props{title:string;description?:string;children:ReactNode;footer?:ReactNode;wide?:boolean;extraWide?:boolean;fixedHeight?:boolean;onClose:()=>void;}
export function Modal({title,description,children,footer,wide,extraWide,fixedHeight,onClose}:Props){
 const titleId=useId();
 useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};const previous=document.body.style.overflow;document.body.style.overflow="hidden";window.addEventListener("keydown",close);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close);};},[onClose]);
 return <div className="fixed inset-0 z-100 flex items-end justify-center bg-[#07130e]/72 p-0 backdrop-blur-[6px] sm:items-center sm:p-6" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={twMerge("relative flex max-h-[95dvh] w-full max-w-150 flex-col overflow-hidden rounded-t-md border border-white/70 bg-[#fffdf8] shadow-[0_32px_90px_rgba(5,20,14,0.34),0_8px_24px_rgba(5,20,14,0.16)] ring-1 ring-[#193b2d]/10 sm:max-h-[90dvh] sm:rounded-md",wide&&"max-w-210",extraWide&&"max-w-250",fixedHeight&&"h-[min(42rem,90dvh)]")}>
   <header className="flex shrink-0 items-start justify-between gap-5 border-b border-[#e4e1d8] bg-[#fffdf8] px-5 py-5 sm:px-8 sm:py-6">
    <div className="flex min-w-0 items-start gap-3.5"><div aria-hidden="true" className="mt-0.5 h-11 w-1 shrink-0 rounded-full bg-[#7eaa3f]"/><div className="min-w-0"><h2 id={titleId} className="font-['Outfit',sans-serif] text-[21px] font-bold leading-tight tracking-[-0.025em] text-[#102019] sm:text-[23px]">{title}</h2>{description&&<p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-[#6f8378] sm:text-[13.5px]">{description}</p>}</div></div>
    <button type="button" onClick={onClose} aria-label="Close dialog" className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d9e1d8] bg-[#f8faf6] text-[#64796e] transition duration-150 hover:border-[#d7aaa5] hover:bg-[#fff2f0] hover:text-[#a9362f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1a5c45]/12"><X size={18} strokeWidth={2}/></button>
   </header>
   <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-linear-to-b from-white to-[#fdfcf8] px-5 py-6 [scrollbar-color:#9bad9f_transparent] [scrollbar-width:thin] sm:px-8 sm:py-7">{children}</div>
   {footer&&<footer className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-[#e1e5dd] bg-linear-to-r from-[#f6f8f3] to-[#fbf8ef] px-5 py-4 shadow-[0_-6px_18px_rgba(20,45,33,0.035)] sm:flex-row sm:justify-end sm:px-8 sm:py-5 [&>button]:max-sm:w-full">{footer}</footer>}
  </div>
 </div>;
}
