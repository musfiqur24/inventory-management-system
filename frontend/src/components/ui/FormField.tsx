import type { ReactNode } from "react";
interface Props{label:string;children:ReactNode;hint?:string;required?:boolean;}
export function FormField({label,children,hint,required}:Props){
 return <div className="mb-4 flex min-w-0 flex-col gap-1.5"><label className="text-[12.5px] font-semibold text-[#31483d]">{label}{required&&<span className="ml-1 text-red-600" aria-hidden="true">*</span>}</label>{children}{hint&&<p className="text-xs leading-5 text-[#73877c]">{hint}</p>}</div>;
}
