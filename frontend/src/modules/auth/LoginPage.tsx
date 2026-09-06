import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "./AuthContext";
import { appToast } from "../../components/ui/Toast";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (reason) {
      appToast.error(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center overflow-hidden bg-[#f3f5f2] p-4">
      <section className="grid h-[min(820px,calc(100dvh-2rem))] w-full max-w-300 overflow-hidden rounded-[28px] border border-[#dbe4da] bg-white shadow-[0_24px_70px_rgba(13,59,46,0.14)] lg:grid-cols-[1.1fr_0.9fr]">
        <aside className="relative hidden overflow-hidden bg-[#0d3b2e] p-12 text-white lg:flex lg:flex-col">
          <div className="absolute -right-22 -top-24 size-96 rounded-full border-[48px] border-[#a8d548]/15" />
          <div className="absolute -bottom-36 -left-28 size-96 rounded-full bg-[#1a5c45]" />
          <div className="relative flex items-center gap-3">
            <div className="grid size-16 place-items-center overflow-hidden rounded-2xl bg-white p-1.5"><img src="/Inventory_Logo.png" alt="Feed Track" className="size-full object-contain" /></div>
            <div><strong className="block text-2xl leading-tight">Feed Track</strong><span className="text-base text-white/55">Production Inventory</span></div>
          </div>
          <div className="relative my-auto max-w-115">
            <h1 className="text-5xl font-bold leading-[1.08] tracking-tight">Inventory decisions, under control.</h1>
          </div>
          <div className="relative grid gap-4">
            {["Organization-aware access", "Role-based permissions", "End-to-end traceability"].map(item => <div key={item} className="flex items-center gap-3 text-sm text-white/75"><CheckCircle2 size={18} className="text-[#a8d548]" />{item}</div>)}
          </div>
        </aside>

        <div className="flex items-center justify-center p-6 sm:p-12">
          <form onSubmit={submit} className="w-full max-w-105">
            <div className="mb-10 lg:hidden"><div className="mb-5 grid size-16 place-items-center overflow-hidden rounded-2xl bg-white p-1.5"><img src="/Inventory_Logo.png" alt="Feed Track" className="size-full object-contain" /></div><p className="text-sm font-bold tracking-[0.15em] text-[#1a5c45]">FEEDTRACK</p></div>
            <div className="mb-8"><h2 className="text-3xl font-bold tracking-tight text-[#0f1c16]">Welcome back</h2><p className="mt-2 text-sm leading-6 text-[#7a9185]">Enter your credentials to continue to your workspace.</p></div>
            <label className="mb-5 block text-sm font-semibold text-[#31483d]">Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="mt-2 w-full rounded-xl border border-[#dbe4da] bg-[#fbfcfa] px-4 py-3.5 text-[#0f1c16] outline-none transition focus:border-[#1a5c45] focus:ring-4 focus:ring-[#1a5c45]/10" /></label>
            <label className="mb-7 block text-sm font-semibold text-[#31483d]">Password<div className="relative mt-2"><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" className="w-full rounded-xl border border-[#dbe4da] bg-[#fbfcfa] px-4 py-3.5 pr-12 text-[#0f1c16] outline-none transition focus:border-[#1a5c45] focus:ring-4 focus:ring-[#1a5c45]/10" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#7a9185] hover:bg-[#eef3ec]">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
            <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d3b2e] px-4 py-3.5 font-semibold text-white transition hover:bg-[#1a5c45] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Signing in��y��y�" : <>Sign in <ArrowRight size={18}/></>}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
