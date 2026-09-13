import { SessionSkeleton, useMinimumLoading } from "../../components/ui/Skeleton";
import { useState } from "react";
import { Navigate,useNavigate } from "react-router-dom";
import { ArrowRight,CheckCircle2,Eye,EyeOff,LockKeyhole } from "lucide-react";
import { useAuth } from "./AuthContext";
import { appToast } from "../../components/ui/Toast";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export function LoginPage(){
 const {user,loading,login}=useAuth();const navigate=useNavigate();
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [showPassword,setShowPassword]=useState(false);const [submitting,setSubmitting]=useState(false);
 const sessionLoading = useMinimumLoading(loading);
 if (sessionLoading) return <SessionSkeleton/>;
 if(user)return <Navigate to="/" replace/>;
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setSubmitting(true);try{await login(email,password);navigate("/");}catch(reason){appToast.error(reason instanceof Error?reason.message:"Unable to sign in.");}finally{setSubmitting(false);}};
 return <main className="grid min-h-dvh place-items-center overflow-hidden bg-[radial-gradient(circle_at_top_left,#e7efe5_0,transparent_38%),#f3f5f2] p-3 sm:p-5">
  <section className="grid w-full max-w-285 overflow-hidden rounded-3xl border border-[#d7e0d8] bg-white shadow-[0_28px_80px_rgba(13,59,46,0.14)] lg:min-h-170 lg:grid-cols-[1.05fr_.95fr]">
   <aside className="relative hidden overflow-hidden bg-[#0d3b2e] p-10 text-white lg:flex lg:flex-col xl:p-12">
    <div className="absolute -right-28 -top-28 size-96 rounded-full border-[46px] border-[#a8d548]/15"/><div className="absolute -bottom-44 -left-32 size-96 rounded-full bg-[#1a5c45]"/>
    <div className="relative flex items-center gap-4"><div className="size-17 overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg"><img src="/Inventory_Logo.png" alt="Feed Track logo" className="size-full object-contain"/></div><div><strong className="block font-['Outfit',sans-serif] text-2xl">Feed Track</strong><span className="text-sm text-white/55">Production Inventory</span></div></div>
    <div className="relative my-auto max-w-110"><p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-[#c8e87a]">Operations workspace</p><h1 className="font-['Outfit',sans-serif] text-5xl font-bold leading-[1.06] tracking-[-.035em] xl:text-[56px]">Inventory decisions, under control.</h1><p className="mt-6 max-w-95 text-[15px] leading-7 text-white/60">One secure workspace for procurement, production, inventory, and traceability.</p></div>
    <div className="relative grid gap-3">{["Organization-aware access","Role-based permissions","End-to-end traceability"].map(item=><div key={item} className="flex items-center gap-3 text-sm text-white/75"><CheckCircle2 size={18} className="text-[#a8d548]"/>{item}</div>)}</div>
   </aside>
   <div className="flex items-center justify-center px-5 py-8 sm:px-10 sm:py-12">
    <form onSubmit={submit} className="w-full max-w-105">
     <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="size-14 overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-[#dce3dd]"><img src="/Inventory_Logo.png" alt="Feed Track logo" className="size-full object-contain"/></div><div><strong className="block font-['Outfit',sans-serif] text-xl">Feed Track</strong><span className="text-xs text-[#73877c]">Production Inventory</span></div></div>
     <div className="mb-8"><span className="mb-4 grid size-11 place-items-center rounded-xl bg-[#edf6df] text-[#1a5c45]"><LockKeyhole size={20}/></span><h2 className="font-['Outfit',sans-serif] text-3xl font-bold tracking-[-.025em] text-[#0f1c16]">Welcome back</h2><p className="mt-2 text-sm leading-6 text-[#74887d]">Sign in to continue to your assigned workspace.</p></div>
     <label className="mb-5 block text-[13px] font-semibold text-[#31483d]">Email address<Input className="mt-2 min-h-12 bg-[#fbfcfa]" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@company.com"/></label>
     <label className="mb-7 block text-[13px] font-semibold text-[#31483d]">Password<div className="relative mt-2"><Input className="min-h-12 bg-[#fbfcfa] pr-12" type={showPassword?"text":"password"} autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} placeholder="Enter your password"/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?"Hide password":"Show password"} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#74887d] hover:bg-[#edf2ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1a5c45]/10">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
     <Button type="submit" variant="primary" disabled={submitting} className="min-h-12 w-full text-sm">{submitting?"Signing in...":<>Sign in <ArrowRight size={18}/></>}</Button>
    </form>
   </div>
  </section>
 </main>;
}
