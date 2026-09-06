import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { PageContainer } from "../../components/ui/PageContainer";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../auth/AuthContext";

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return <PageContainer cap="ACCOUNT" title="My Profile" description="Your account, organization memberships, and effective access.">
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <div className="mb-6 flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-[#edf6df] text-2xl font-bold text-[#1a5c45]">{user.fullName.slice(0, 1).toUpperCase()}</div>
          <div><h2 className="text-xl font-bold">{user.fullName}</h2><p className="text-sm text-[#7a9185]">{user.email}</p></div>
        </div>
        <div className="grid gap-3 text-sm"><div className="flex items-center gap-3 rounded-xl bg-[#f8faf7] p-3"><UserRound size={17} className="text-[#1a5c45]"/><span>Active account</span></div><div className="flex items-center gap-3 rounded-xl bg-[#f8faf7] p-3"><ShieldCheck size={17} className="text-[#1a5c45]"/><span>{user.isSuperAdmin ? "Super Admin access" : "Organization access"}</span></div></div>
      </Card>
      <div className="grid gap-6">
        <Card><h2 className="mb-4 flex items-center gap-2 font-bold"><ShieldCheck size={18} className="text-[#1a5c45]"/>Organization memberships</h2><div className="grid gap-3">{user.organizations.map(org=><div key={org.id} className="flex items-center justify-between rounded-xl border border-[#e0e5dd] p-4"><div><b>{org.name}</b><p className="mt-0.5 text-xs text-[#7a9185]">{org.code}</p></div><Badge variant="brand">{org.role.name}</Badge></div>)}</div></Card>
        <Card><h2 className="mb-4 flex items-center gap-2 font-bold"><KeyRound size={18} className="text-[#1a5c45]"/>Effective permissions</h2><div className="flex flex-wrap gap-2">{user.permissions.map(p=><span key={p} className="rounded-full bg-[#edf6df] px-3 py-1.5 text-xs font-semibold text-[#1a5c45]">{p}</span>)}</div></Card>
      </div>
    </div>
  </PageContainer>;
}