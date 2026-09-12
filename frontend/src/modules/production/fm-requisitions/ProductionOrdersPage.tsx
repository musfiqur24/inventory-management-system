import { DataTable } from "../../../components/ui/DataTable";
import { useToastMessage } from "../../../components/ui/Toast";
import type { CSSProperties } from 'react';
import { twMerge } from 'tailwind-merge';
import { useEffect, useState } from 'react';
import { Plus, Factory, Search } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { statusBadge } from '../../../components/ui/Badge';

interface ProductionOrder {
  id: string; number: string; status: string; targetQty: number; plannedStartDate?: string;
  recipe?: { name: string; code: string; targetTonnage: number } | null;
  fgProduct?: { name: string; sku: string } | null;
  uom?: { code: string } | null;
  lines: Array<{ id: string; rawMaterial?: { name: string; sku: string }; requiredQty: number; issuedQty: number; }>;
}
interface Recipe { id: string; name: string; code: string; targetTonnage?: number; }
interface Product { id: string; name: string; sku: string; type: string; }
interface UOM { id: string; name: string; code: string; }

export function ProductionOrdersPage() {
  const [rows, setRows] = useState<ProductionOrder[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProductionOrder | null>(null);
  const [, setMessage] = useToastMessage();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ recipeId: '', fgProductId: '', uomId: '', targetQty: '', plannedStartDate: '' });

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [po, r, p, u] = await Promise.all([
        api<{ data: ProductionOrder[] }>('/production-orders'),
        api<{ data: Recipe[] }>('/recipes'),
        api<{ data: Product[] }>('/products'),
        api<{ data: UOM[] }>('/uoms'),
      ]);
      setRows(po.data); setRecipes(r.data);
      setProducts(p.data.filter((x) => x.type === 'FINISHED_GOOD'));
      setUoms(u.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  // Find selected recipe to show scaled quantities preview
  const selectedRecipe = recipes.find((r) => r.id === form.recipeId);
  const scaleFactor = form.targetQty && selectedRecipe ? Number(form.targetQty) / (selectedRecipe.targetTonnage ?? 1) : null;

  const submit = async () => {
    try {
      await api('/production-orders', {
        method: 'POST',
        body: JSON.stringify({
          recipeId: form.recipeId || undefined,
          fgProductId: form.fgProductId || undefined,
          uomId: form.uomId || undefined,
          targetQty: Number(form.targetQty),
          plannedStartDate: form.plannedStartDate || undefined,
        }),
      });
      setOpen(false); setForm({ recipeId: '', fgProductId: '', uomId: '', targetQty: '', plannedStartDate: '' }); void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const filtered = rows.filter((r) =>
    r.number.toLowerCase().includes(search.toLowerCase()) ||
    (r.recipe?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer
      cap="PRODUCTION"
      title="FM Production Requisitions"
      description="Auto-scale recipe formulations for target production quantities. RM requirement lines are calculated from the recipe."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> New Production Order</Button>}
   >

      <div className="grid grid-cols-[repeat(4,_1fr)] gap-4 mb-5 max-[900px]:grid-cols-[repeat(2,_1fr)] max-[480px]:grid-cols-[1fr]">
        {[{ label: 'Total Orders', v: rows.length, c: 'brand' }, { label: 'Draft', v: rows.filter((r) => r.status === 'DRAFT').length, c: 'gray' }, { label: 'Submitted', v: rows.filter((r) => r.status === 'SUBMITTED').length, c: 'blue' }, { label: 'Closed', v: rows.filter((r) => r.status === 'CLOSED').length, c: 'green' }].map((s) => (
          <Card className="flex items-start gap-3.5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md p-[14px_16px]" key={s.label}>
            <div className="min-w-0"><div className="[font-family:'Outfit',_sans-serif] text-[22px] font-bold text-[#0f1c16] leading-[1] mb-1">{s.v}</div><div className="text-[12px] text-[#7a9185] font-medium">{s.label}</div></div>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <h2>Production Order Register</h2>
          <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] flex-1 max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]"><Search size={14} /><input placeholder="Search orders…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto">
          <DataTable columns={["Order #","Recipe","FG Product","Target Qty","RM Lines","Status","Planned Start","Actions"]} empty={filtered.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Factory size={28} /></div><b>No production orders yet</b><p>Create an order to auto-scale a recipe to your target quantity.</p></div>}>
              {filtered.map((po) => (
                <tr key={po.id}>
                  <td><strong className="text-[#0d3b2e] font-mono">{po.number}</strong></td>
                  <td>{po.recipe?.name ?? '—'}<br /><span className="text-[11px] text-[#7a9185]">{po.recipe?.code}</span></td>
                  <td>{po.fgProduct?.name ?? '—'}<br /><span className="text-[11px] text-[#7a9185] font-mono">{po.fgProduct?.sku}</span></td>
                  <td><strong>{Number(po.targetQty).toLocaleString()}</strong> {po.uom?.code ?? 'kg'}</td>
                  <td>{po.lines.length} materials</td>
                  <td>{statusBadge(po.status)}</td>
                  <td className="text-[12px] text-[#7a9185]">{po.plannedStartDate ? new Date(po.plannedStartDate).toLocaleDateString('en-GB') : '—'}</td>
                  <td><Button size="sm" variant="secondary" onClick={() => setSelected(po)}>View Lines</Button></td>
                </tr>
              ))}
            </DataTable>
          
        </div>
      </Card>

      {open && (
        <Modal title="New FM Production Order" description="Select a recipe and target quantity. RM requirements are calculated automatically." onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!form.targetQty}>Create Order</Button></>}
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr]">
            <FormField label="Recipe" required>
              <Dropdown value={form.recipeId} onChange={(e) => setForm({ ...form, recipeId: e.target.value })}>
                <option value="">— Select recipe —</option>
                {recipes.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
              </Dropdown>
            </FormField>
            <FormField label="Target FG Product">
              <Dropdown value={form.fgProductId} onChange={(e) => setForm({ ...form, fgProductId: e.target.value })}>
                <option value="">— Optional FG product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Dropdown>
            </FormField>
            <FormField label="Target Quantity (Tons)" required>
              <Input type="number" placeholder="e.g. 5 for 5-ton batch" value={form.targetQty} onChange={(e) => setForm({ ...form, targetQty: e.target.value })} />
            </FormField>
            <FormField label="UOM">
              <Dropdown value={form.uomId} onChange={(e) => setForm({ ...form, uomId: e.target.value })}>
                <option value="">— Select UOM —</option>
                {uoms.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
              </Dropdown>
            </FormField>
            <FormField label="Planned Start Date" required>
              <Input type="date" value={form.plannedStartDate} onChange={(e) => setForm({ ...form, plannedStartDate: e.target.value })} />
            </FormField>
          </div>

          {scaleFactor && selectedRecipe && (
            <div className="bg-[rgba(168,213,72,0.18)] [border:1px_solid_rgba(168,213,72,0.3)] rounded-[10px] p-3.5">
              <div className="font-bold text-[13px] text-[#0d3b2e] mb-2">
                Scaled from {selectedRecipe.targetTonnage ?? 1}T base recipe → {form.targetQty}T target (×{scaleFactor.toFixed(2)})
              </div>
              <p className="text-[12px] text-[#445e50] m-0">
                RM requirement lines will be auto-generated with waste percentages applied. You can edit them after creation.
              </p>
            </div>
          )}
        </Modal>
      )}

      {selected && (
        <Modal title={`Order ${selected.number} — RM Requirements`} description={`Recipe: ${selected.recipe?.name ?? '—'} · Target: ${Number(selected.targetQty).toLocaleString()} ${selected.uom?.code ?? 'kg'}`} onClose={() => setSelected(null)} wide footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
          <div className="overflow-x-auto">
            <DataTable columns={["Raw Material","SKU","Required Qty","Issued Qty","Remaining","Progress"]}>
                {selected.lines.map((l, i) => {
                  const pct = l.requiredQty > 0 ? Math.min((l.issuedQty / l.requiredQty) * 100, 100) : 0;
                  return (
                    <tr key={i}>
                      <td>{l.rawMaterial?.name ?? '—'}</td>
                      <td><span className="text-[11px] font-mono text-[#7a9185]">{l.rawMaterial?.sku}</span></td>
                      <td><strong>{Number(l.requiredQty).toLocaleString()}</strong></td>
                      <td>{Number(l.issuedQty).toLocaleString()}</td>
                      <td className={twMerge("font-semibold", (l.issuedQty >= l.requiredQty ? "text-[#1b8f5a]" : "text-[#c87d12]"))}>{Math.max(0, l.requiredQty - l.issuedQty).toLocaleString()}</td>
                      <td className="min-w-30">
                        <div className="h-1.5 rounded-[4px] bg-[#e0e5dd] overflow-hidden"><div className="h-full rounded-[4px] [background:linear-gradient(90deg,_#a8d548,_#1a5c45)] [transition:width_0.5s_ease] w-[var(--meter-width)]" style={{ "--meter-width": `${pct}%` } as CSSProperties} /></div>
                        <div className="text-[11px] text-[#7a9185] mt-0.75">{pct.toFixed(0)}%</div>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}


