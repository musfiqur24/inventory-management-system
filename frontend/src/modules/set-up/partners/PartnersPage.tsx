import { DataTable } from "../../../components/ui/DataTable";
import { useToastMessage } from "../../../components/ui/Toast";
import { twMerge } from 'tailwind-merge';
import { useEffect, useState } from 'react';
import { Plus, Building2, Search, Phone, Mail } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';

interface Partner {
  id: string; name: string; code: string; partnerType: string;
  email?: string; phone?: string; address?: string; contactPerson?: string;
}

export function PartnersPage() {
  const [rows, setRows] = useState<Partner[]>([]);
  const [open, setOpen] = useState(false);
  const [, setMessage] = useToastMessage();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SUPPLIER' | 'CUSTOMER'>('ALL');
  const [form, setForm] = useState({ name: '', code: '', partnerType: 'SUPPLIER', email: '', phone: '', address: '', contactPerson: '' });

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try { const r = await api<{ data: Partner[] }>('/partners'); setRows(r.data); setMessage(''); }
    catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      await api('/partners', { method: 'POST', body: JSON.stringify(form) });
      setOpen(false); setForm({ name: '', code: '', partnerType: 'SUPPLIER', email: '', phone: '', address: '', contactPerson: '' }); void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const filtered = rows.filter((r) =>
    (typeFilter === 'ALL' || r.partnerType === typeFilter) &&
    (r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      (r.email ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const suppliers = rows.filter((r) => r.partnerType === 'SUPPLIER');
  const customers = rows.filter((r) => r.partnerType === 'CUSTOMER');

  return (
    <PageContainer
      cap="MASTER SETUP"
      title="Suppliers & Customers"
      description="Manage your partner directory — suppliers who provide raw materials and customers who receive finished goods."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> Add Partner</Button>}
   >

      <div className="grid grid-cols-[repeat(3,_1fr)] gap-4 mb-5 max-[900px]:grid-cols-[repeat(2,_1fr)] max-[480px]:grid-cols-[1fr]">
        {[
          { label: 'Total Partners', v: rows.length, color: 'brand' },
          { label: 'Suppliers', v: suppliers.length, color: 'blue' },
          { label: 'Customers', v: customers.length, color: 'green' },
        ].map((s) => (
          <Card className="flex items-start gap-3.5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md p-[14px_16px]" key={s.label}>
            <div className="min-w-0"><div className="[font-family:'Outfit',_sans-serif] text-[22px] font-bold text-[#0f1c16] leading-[1] mb-1">{s.v}</div><div className="text-[12px] text-[#7a9185] font-medium">{s.label}</div></div>
          </Card>
        ))}
      </div>

      <Card padding="none">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <h2>Partner Directory</h2>
          <div className="flex gap-2 items-center">
            <div className="flex gap-1 [border-bottom:2px_solid_#e0e5dd] max-[480px]:overflow-x-auto max-[480px]:flex-nowrap [border:none] m-0">
              {(['ALL', 'SUPPLIER', 'CUSTOMER'] as const).map((t) => (
                <button key={t} className={twMerge(`p-[10px_18px] [border:0] [background:none] text-[#7a9185] [font:600_13.5px_'Inter',_sans-serif] cursor-pointer [border-bottom:2px_solid_transparent] -mb-0.5 rounded-[8px_8px_0_0] [transition:all_0.15s] flex items-center gap-1.75 [:where(&_svg)]:w-3.75 [:where(&_svg)]:h-3.75 [&:hover]:text-[#445e50] [&:hover]:bg-[#f3f5f2] [&.active]:text-[#0d3b2e] [&.active]:[border-bottom-color:#0d3b2e] ${(typeFilter === t ? "active" : "")}`)} onClick={() => setTypeFilter(t)}>{t === 'ALL' ? 'All' : t === 'SUPPLIER' ? 'Suppliers' : 'Customers'}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] flex-1 max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]"><Search size={14} /><input placeholder="Search partners…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <DataTable columns={["Partner Name","Code","Type","Contact Person","Email","Phone"]}>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className={twMerge("w-8 h-8 rounded-[8px] grid place-items-center shrink-0", (p.partnerType === 'SUPPLIER' ? "bg-[#e8f2ff]" : "bg-[#eaf8f0]"), (p.partnerType === 'SUPPLIER' ? "text-[#1864ab]" : "text-[#1b8f5a]"))}>
                        <Building2 size={14} />
                      </div>
                      <strong>{p.name}</strong>
                    </div>
                  </td>
                  <td><span className="font-mono text-[12px]">{p.code}</span></td>
                  <td>
                    {p.partnerType === 'SUPPLIER'
                      ? <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#e8f2ff] text-[#1864ab]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />Supplier</span>
                      : <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#eaf8f0] text-[#1b8f5a]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />Customer</span>}
                  </td>
                  <td>{p.contactPerson ?? <span className="text-[#7a9185]">—</span>}</td>
                  <td>{p.email ? <a href={`mailto:${p.email}`} className="text-[#1864ab] flex items-center gap-1"><Mail size={12} />{p.email}</a> : '—'}</td>
                  <td>{p.phone ? <span className="flex items-center gap-1 text-[13px]"><Phone size={12} />{p.phone}</span> : '—'}</td>
                </tr>
              ))}
            </DataTable>
          {filtered.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Building2 size={28} /></div><b>No partners found</b><p>Add suppliers who provide raw materials and customers who receive finished goods.</p></div>}
        </div>
      </Card>

      {open && (
        <Modal title="Add Partner" description="Register a new supplier or customer in the partner directory." wide onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!form.name || !form.code}>Save Partner</Button></>}
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-4 max-[640px]:grid-cols-[1fr]">
            <FormField label="Partner Type" required>
              <Dropdown value={form.partnerType} onChange={(e) => setForm({ ...form, partnerType: e.target.value })}>
                <option value="SUPPLIER">Supplier (RM vendor)</option>
                <option value="CUSTOMER">Customer (FG buyer)</option>
              </Dropdown>
            </FormField>
            <FormField label="Partner Code" required hint="Short unique identifier">
              <Input placeholder="e.g. AGRO-BD-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </FormField>
            <FormField label="Company Name" required>
              <Input placeholder="Full legal name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="Contact Person">
              <Input placeholder="Primary contact" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <Input type="email" placeholder="contact@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormField>
            <FormField label="Phone">
              <Input placeholder="+880…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Address">
            <Input placeholder="Factory address / Street" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FormField>
        </Modal>
      )}
    </PageContainer>
  );
}
