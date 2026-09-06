import { useEffect, useState } from "react";
import { Building2, Check, CircleCheck, XCircle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { PageContainer } from "../../../components/ui/PageContainer";
import { Card } from "../../../components/ui/Card";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { organizationApi, type Organization } from "./organization.api";

export function OrganizationPage() {
  const [items, setItems] = useState<Organization[]>([]);
  const [selected, setSelected] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");

  const showMessage = (next: string, kind: "success" | "error") => {
    setMessageKind(kind);
    setMessage(next);
  };

  const load = async () => {
    try {
      const organizations = (await organizationApi.list()).data;
      setItems(organizations);
      setSelected(current => current ?? organizations.find(item => item.id === organizationApi.selectedId()) ?? organizations[0] ?? null);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to load organisations.", "error");
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const select = (organization: Organization) => {
    organizationApi.select(organization);
    setSelected(organization);
    showMessage(organization.name + " selected.", "success");
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await organizationApi.create({ name, code });
      setName("");
      setCode("");
      select(result.data);
      void load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to create organisation.", "error");
    }
  };

  return (
    <PageContainer title="Organisations" description="Create an organisation once, then select it as the workspace for all inventory records.">
      {message && <div role="status" className={"fixed bottom-6 right-6 z-100 flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl " + (messageKind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
        {messageKind === "success" ? <CircleCheck size={18} /> : <XCircle size={18} />}<span>{message}</span>
      </div>}
      <Card padding="none">
        <div className="grid min-h-110 grid-cols-[minmax(320px,_1fr)_minmax(360px,_1.2fr)] max-[860px]:grid-cols-[1fr]">
          <div className="bg-white p-7 [border-right:1px_solid_#e0e5dd] max-[860px]:[border-bottom:1px_solid_#e0e5dd] max-[860px]:[border-right:none]">
            <div className="mb-6 flex min-h-10.5 items-center gap-3">
              <div className="grid size-9.5 shrink-0 place-items-center rounded-[8px] bg-[rgba(168,213,72,0.18)] text-[#0d3b2e]"><Building2 size={18} /></div>
              <div><h2 className="text-[16px] font-bold">Create organisation</h2><p className="mt-0.5 text-[12.5px] text-[#7a9185]">Register a new company workspace</p></div>
            </div>
            <form onSubmit={create}>
              <FormField label="Organisation name"><Input required value={name} onChange={event => setName(event.target.value)} placeholder="Nourish Feeds Ltd." /></FormField>
              <FormField label="Unique code"><Input required value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="NOURISH" /></FormField>
              <Button type="submit" variant="primary">Create and select</Button>
            </form>
          </div>
          <div className="flex flex-col bg-white p-7">
            <div className="mb-6 flex min-h-10.5 items-center justify-between gap-3">
              <div className="flex items-center gap-3"><div className="grid size-9.5 shrink-0 place-items-center rounded-[8px] bg-[rgba(27,143,90,0.1)] text-[#1b8f5a]"><Building2 size={18} /></div><div><h2 className="text-[16px] font-bold">Available organisations</h2><p className="mt-0.5 text-[12.5px] text-[#7a9185]">Select a workspace to view its details</p></div></div>
              <span className="whitespace-nowrap rounded-[20px] bg-[#e8f2ff] px-[10px] py-[3px] text-[11.5px] font-semibold text-[#1864ab]">{items.length} total</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.length === 0 ? <div className="p-8 text-center text-[#7a9185]">No organisations found. Create one using the form on the left.</div> : items.map(item => {
                const isSelected = selected?.id === item.id;
                return <button type="button" key={item.id} onClick={() => select(item)} className={"flex w-full items-center justify-between gap-3 rounded-lg border p-[12px_16px] text-left transition hover:bg-[#f8faf7] " + (isSelected ? "border-[#0d3b2e] bg-[rgba(13,59,46,0.04)] text-[#0d3b2e]" : "border-[#e0e5dd] bg-white text-[#0f1c16]")}>
                  <span><b className="block text-[13.5px]">{item.name}</b><small className="mt-0.5 block text-[11.5px] tracking-[0.04em] text-[#7a9185]">{item.code}</small></span>
                  {isSelected && <span className="grid size-5.5 place-items-center rounded-full bg-[#eaf8f0] text-[#1b8f5a]"><Check size={16} /></span>}
                </button>;
              })}
            </div>
            {selected && <div className="mt-6 rounded-xl border border-[#dbe4da] bg-[#f8faf7] p-4">
              <div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-[#0f1c16]">Selected organisation</h3><span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (selected.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>{selected.isActive ? "Active" : "Inactive"}</span></div>
              <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-[#7a9185]">Organisation name</dt><dd className="mt-1 font-semibold">{selected.name}</dd></div><div><dt className="text-xs text-[#7a9185]">Unique code</dt><dd className="mt-1 font-semibold">{selected.code}</dd></div><div><dt className="text-xs text-[#7a9185]">Created</dt><dd className="mt-1 font-medium">{new Date(selected.createdAt).toLocaleDateString()}</dd></div><div><dt className="text-xs text-[#7a9185]">Last updated</dt><dd className="mt-1 font-medium">{new Date(selected.updatedAt).toLocaleDateString()}</dd></div></dl>
            </div>}
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
