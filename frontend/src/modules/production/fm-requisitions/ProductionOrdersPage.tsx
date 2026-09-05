import { useEffect, useState } from 'react';
import { Plus, Factory, Search } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';
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
  const [message, setMessage] = useState('');
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
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
    >

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[{ label: 'Total Orders', v: rows.length, c: 'brand' }, { label: 'Draft', v: rows.filter((r) => r.status === 'DRAFT').length, c: 'gray' }, { label: 'Submitted', v: rows.filter((r) => r.status === 'SUBMITTED').length, c: 'blue' }, { label: 'Closed', v: rows.filter((r) => r.status === 'CLOSED').length, c: 'green' }].map((s) => (
          <div className="stat-card" key={s.label} style={{ padding: '14px 16px' }}>
            <div className="stat-card__body"><div className="stat-card__value" style={{ fontSize: 22 }}>{s.v}</div><div className="stat-card__label">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-header">
          <h2>Production Order Register</h2>
          <div className="search-bar"><Search size={14} /><input placeholder="Search orders…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Order #</th><th>Recipe</th><th>FG Product</th><th>Target Qty</th><th>RM Lines</th><th>Status</th><th>Planned Start</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((po) => (
                <tr key={po.id}>
                  <td><strong style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>{po.number}</strong></td>
                  <td>{po.recipe?.name ?? '—'}<br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{po.recipe?.code}</span></td>
                  <td>{po.fgProduct?.name ?? '—'}<br /><span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{po.fgProduct?.sku}</span></td>
                  <td><strong>{Number(po.targetQty).toLocaleString()}</strong> {po.uom?.code ?? 'kg'}</td>
                  <td>{po.lines.length} materials</td>
                  <td>{statusBadge(po.status)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{po.plannedStartDate ? new Date(po.plannedStartDate).toLocaleDateString('en-GB') : '—'}</td>
                  <td><Button size="sm" variant="secondary" onClick={() => setSelected(po)}>View Lines</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state"><div className="empty-state__icon"><Factory size={28} /></div><b>No production orders yet</b><p>Create an order to auto-scale a recipe to your target quantity.</p></div>}
        </div>
      </div>

      {open && (
        <Modal title="New FM Production Order" description="Select a recipe and target quantity. RM requirements are calculated automatically." onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!form.targetQty}>Create Order</Button></>}
        >
          <div className="ui-form-grid">
            <FormField label="Recipe" required>
              <Select value={form.recipeId} onChange={(e) => setForm({ ...form, recipeId: e.target.value })}>
                <option value="">— Select recipe —</option>
                {recipes.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
              </Select>
            </FormField>
            <FormField label="Target FG Product">
              <Select value={form.fgProductId} onChange={(e) => setForm({ ...form, fgProductId: e.target.value })}>
                <option value="">— Optional FG product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Target Quantity (Tons)" required>
              <Input type="number" placeholder="e.g. 5 for 5-ton batch" value={form.targetQty} onChange={(e) => setForm({ ...form, targetQty: e.target.value })} />
            </FormField>
            <FormField label="UOM">
              <Select value={form.uomId} onChange={(e) => setForm({ ...form, uomId: e.target.value })}>
                <option value="">— Select UOM —</option>
                {uoms.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
              </Select>
            </FormField>
            <FormField label="Planned Start Date" required>
              <Input type="date" value={form.plannedStartDate} onChange={(e) => setForm({ ...form, plannedStartDate: e.target.value })} />
            </FormField>
          </div>

          {scaleFactor && selectedRecipe && (
            <div style={{ background: 'var(--brand-glow)', border: '1px solid rgba(168,213,72,0.3)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--brand-primary)', marginBottom: 8 }}>
                Scaled from {selectedRecipe.targetTonnage ?? 1}T base recipe → {form.targetQty}T target (×{scaleFactor.toFixed(2)})
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                RM requirement lines will be auto-generated with waste percentages applied. You can edit them after creation.
              </p>
            </div>
          )}
        </Modal>
      )}

      {selected && (
        <Modal title={`Order ${selected.number} — RM Requirements`} description={`Recipe: ${selected.recipe?.name ?? '—'} · Target: ${Number(selected.targetQty).toLocaleString()} ${selected.uom?.code ?? 'kg'}`} onClose={() => setSelected(null)} wide footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Raw Material</th><th>SKU</th><th>Required Qty</th><th>Issued Qty</th><th>Remaining</th><th>Progress</th></tr></thead>
              <tbody>
                {selected.lines.map((l, i) => {
                  const pct = l.requiredQty > 0 ? Math.min((l.issuedQty / l.requiredQty) * 100, 100) : 0;
                  return (
                    <tr key={i}>
                      <td>{l.rawMaterial?.name ?? '—'}</td>
                      <td><span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{l.rawMaterial?.sku}</span></td>
                      <td><strong>{Number(l.requiredQty).toLocaleString()}</strong></td>
                      <td>{Number(l.issuedQty).toLocaleString()}</td>
                      <td style={{ color: l.issuedQty >= l.requiredQty ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{Math.max(0, l.requiredQty - l.issuedQty).toLocaleString()}</td>
                      <td style={{ minWidth: 120 }}>
                        <div className="progress-bar"><div className="progress-bar__fill" style={{ width: `${pct}%` }} /></div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{pct.toFixed(0)}%</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}


