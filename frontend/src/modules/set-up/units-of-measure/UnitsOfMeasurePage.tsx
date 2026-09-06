import { useEffect, useState } from 'react';
import { Plus, Scale, Search, Trash2 } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';

interface UOM { id: string; name: string; code: string; decimalPlaces?: number; isBase?: boolean; category?: string; conversionFactor?: number; }

export function UnitsOfMeasurePage() {
  const [rows, setRows] = useState<UOM[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', code: '', category: '', decimalPlaces: '2', conversionFactor: '1' });

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try { const r = await api<{ data: UOM[] }>('/uoms'); setRows(r.data); setMessage(''); }
    catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      await api('/uoms', {
        method: 'POST',
        body: JSON.stringify({ ...form, decimalPlaces: Number(form.decimalPlaces), conversionFactor: Number(form.conversionFactor) }),
      });
      setOpen(false); setForm({ name: '', code: '', category: '', decimalPlaces: '2', conversionFactor: '1' }); void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const deleteUom = async (id: string) => {
    if (!window.confirm('Delete this UOM?')) return;
    try { await api(`/uoms/${id}`, { method: 'DELETE' }); void load(); }
    catch (e: any) { setMessage(e.message); }
  };

  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))];

  return (
    <PageContainer
      cap="MASTER SETUP"
      title="Units of Measure"
      description="Dynamic UOM management. Create mass, volume, or custom units for products, recipes, and transactions."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> New UOM</Button>}
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
   >

      {/* Category quick filters */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          <span className="text-[12px] text-[#7a9185] [align-self:center]">Filter:</span>
          {['All', ...categories].map((cat) => (
            <button key={cat} className="p-[4px_12px] rounded-[20px] [border:1px_solid_#e0e5dd] bg-[#ffffff] text-[12px] cursor-pointer text-[#445e50] font-semibold">
              {cat}
            </button>
          ))}
        </div>
      )}

      <Card padding="none">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <h2>UOM Registry</h2>
          <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] flex-1 max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]"><Search size={14} /><input placeholder="Search units…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-140 border-collapse [:where(&_th)]:p-[10px_16px] [:where(&_th)]:text-left [:where(&_th)]:text-[11px] [:where(&_th)]:font-bold [:where(&_th)]:tracking-[0.07em] [:where(&_th)]:uppercase [:where(&_th)]:text-[#7a9185] [:where(&_th)]:bg-[#f8faf7] [:where(&_th)]:[border-bottom:1px_solid_#e0e5dd] [:where(&_td)]:p-[13px_16px] [:where(&_td)]:[border-bottom:1px_solid_#e0e5dd] [:where(&_td)]:text-[13.5px] [:where(&_td)]:text-[#0f1c16] [&_tbody_tr]:[transition:background_0.1s] [&_tbody_tr:hover]:bg-[#f8faf7] [&_tbody_tr:last-child_td]:[border-bottom:0]">
            <thead><tr><th>Unit Name</th><th>Code / Symbol</th><th>Category</th><th>Decimal Places</th><th>Conversion Factor</th><th>Base Unit</th><th></th></tr></thead>
            <tbody>
              {filtered.map((uom) => (
                <tr key={uom.id}>
                  <td><strong>{uom.name}</strong></td>
                  <td><span className="font-mono bg-[#f8faf7] p-[2px_8px] rounded-[6px] text-[13px] font-bold">{uom.code}</span></td>
                  <td>{uom.category ?? <span className="text-[#7a9185]">—</span>}</td>
                  <td>{uom.decimalPlaces ?? 2}</td>
                  <td>{uom.conversionFactor ?? 1}</td>
                  <td>{uom.isBase ? <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#eaf8f0] text-[#1b8f5a]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />Base unit</span> : <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#f0f2ee] text-[#7a9185]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />Derived</span>}</td>
                  <td>
                    <button onClick={() => deleteUom(uom.id)} className="[border:1px_solid_#e0e5dd] bg-[#f8faf7] rounded-[7px] p-[5px_8px] cursor-pointer text-[#c03030]">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Scale size={28} /></div><b>No UOMs found</b><p>Create your first unit of measure — e.g. kg, MT, Bag.</p></div>}
        </div>
      </Card>

      {open && (
        <Modal title="Create Unit of Measure" description="Add a new dynamic UOM. Set the category and conversion factor to support unit-agnostic quantity tracking." wide onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!form.name || !form.code}>Create UOM</Button></>}
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-4 max-[640px]:grid-cols-[1fr]">
            <FormField label="Unit Name" required hint="e.g. Metric Ton, Kilogram, Bag">
              <Input placeholder="Kilogram" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="Symbol / Code" required hint="Short code used in reports">
              <Input placeholder="kg" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </FormField>
            <FormField label="Category" hint="Group related UOMs — e.g. Mass, Volume, Count">
              <Input placeholder="Mass" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </FormField>
            <FormField label="Decimal Places">
              <Input type="number" min={0} max={6} value={form.decimalPlaces} onChange={(e) => setForm({ ...form, decimalPlaces: e.target.value })} />
            </FormField>
            <FormField label="Conversion Factor" hint="Relative to base unit in category">
              <Input type="number" step="0.001" value={form.conversionFactor} onChange={(e) => setForm({ ...form, conversionFactor: e.target.value })} />
            </FormField>
          </div>
          <Notice variant="info">The conversion factor is used to normalise quantities across different units within the same category for reporting.</Notice>
        </Modal>
      )}
    </PageContainer>
  );
}
