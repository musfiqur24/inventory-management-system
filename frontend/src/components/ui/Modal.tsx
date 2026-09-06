import { useEffect,useId,type ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { X } from "lucide-react";
interface Props{title:string;description?:string;children:ReactNode;footer?:ReactNode;wide?:boolean;onClose:()=>void;}
export function Modal({title,description,children,footer,wide,onClose}:Props){
 const titleId=useId();
 useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[onClose]);
 return <div className="fixed inset-0 z-100 flex items-end justify-center bg-[#0c1812]/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={twMerge("flex max-h-[94dvh] w-full max-w-150 flex-col overflow-hidden rounded-t-2xl border border-[#dce3dd] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.25)] sm:max-h-[90dvh] sm:rounded-2xl",wide&&"max-w-210")}>
   <header className="flex items-start justify-between gap-4 border-b border-[#e3e8e3] px-5 py-4 sm:px-7 sm:py-5"><div className="min-w-0"><h2 id={titleId} className="font-['Outfit',sans-serif] text-xl font-bold text-[#0f1c16]">{title}</h2>{description&&<p className="mt-1 text-[13px] leading-5 text-[#74887d]">{description}</p>}</div><button type="button" onClick={onClose} aria-label="Close dialog" className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#dfe5df] text-[#71847a] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100"><X size={18}/></button></header>
   <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">{children}</div>
   {footer&&<footer className="flex flex-col-reverse gap-2 border-t border-[#e3e8e3] bg-[#f8faf8] px-5 py-4 sm:flex-row sm:justify-end sm:px-7 [&>button]:max-sm:w-full">{footer}</footer>}
  </div>
 </div>;
}
