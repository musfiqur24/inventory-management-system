import { useEffect, useState } from 'react';
import { Plus, ArrowLeftRight } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';
import { statusBadge } from '../../../components/ui/Badge';

interface MaterialIssue {
  id: string; issueNumber: string; status: string; issuedAt: string;
  productionOrder?: { number: string } | null;
  issuedBy?: string;
  lines: Array<{ id: string; rawMaterial?: { name: string; sku: string }; lot?: { lotNumber: string }; uom?: { code: string }; issuedQty: number; }>;
}
interface ProductionOrder { id: string; number: string; }
interface Product { id: string; name: string; sku: string; type: string; }
interface Lot { id: string; lotNumber: string; productId: string; currentQty: number; }
interface UOM { id: string; name: string; code: string; }

export function MaterialIssuesPage() {
  const [rows, setRows] = useState<MaterialIssue[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ productionOrderId: '' });
  const [lines, setLines] = useState([{ rawMaterialId: '', lotId: '', uomId: '', issuedQty: '' }]);

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [mi, po, p, lt, u] = await Promise.all([
        api<{ data: MaterialIssue[] }>('/material-issues'),
        api<{ data: ProductionOrder[] }>('/production-orders'),
        api<{ data: Product[] }>('/products'),
        api<{ data: Lot[] }>('/rm-store/lots'),
        api<{ data: UOM[] }>('/uoms'),
      ]);
      setRows(mi.data); setOrders(po.data);
      setProducts(p.data.filter((x) => x.type === 'RAW_MATERIAL'));
      setLots(lt.data); setUoms(u.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      const validLines = lines.filter((l) => l.rawMaterialId && l.uomId && l.issuedQty);
      await api('/material-issues', {
        method: 'POST',
        body: JSON.stringify({
          productionOrderId: form.productionOrderId || undefined,
          lines: validLines.map((l) => ({
            rawMaterialId: l.rawMaterialId,
            lotId: l.lotId || undefined,
            uomId: l.uomId,
            issuedQty: Number(l.issuedQty),
          })),
        }),
      });
      setOpen(false); setForm({ productionOrderId: '' });
      setLines([{ rawMaterialId: '', lotId: '', uomId: '', issuedQty: '' }]); void load();
    } catch (e: any) { setMessage(e.message); }
  };

  return (
    <section className="page-container-compat">
      <PageHeader cap="PRODUCTION" title="Issue RM to Factory"
        description="Issue raw materials from RM store to the production floor. Deducts from lot balances and links to production orders."
        actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> Issue Materials</Button>}
      />
      {message && <Notice variant="error">{message}</Notice>}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-header"><h2>Material Issue Register</h2><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rows.length} issues</span></div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Issue #</th><th>Production Order</th><th>Lines</th><th>Status</th><th>Issued At</th></tr></thead>
            <tbody>
              {rows.map((mi) => (
                <tr key={mi.id}>
                  <td><strong style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>{mi.issueNumber}</strong></td>
                  <td>{mi.productionOrder?.number ?? <span style={{ color: 'var(--text-muted)' }}>Direct issue</span>}</td>
                  <td>{mi.lines.length} materials</td>
                  <td>{statusBadge(mi.status)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(mi.issuedAt).toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty-state"><div className="empty-state__icon"><ArrowLeftRight size={28} /></div><b>No issues yet</b><p>Issue raw materials to the factory floor to start production.</p></div>}
        </div>
      </div>

      {open && (
        <Modal title="Issue RM Materials to Factory" description="Select materials from RM lots. Stock will be deducted immediately on save." onClose={() => setOpen(false)} wide
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Confirm Issue</Button></>}
        >
          <FormField label="Linked Production Order">
            <Select value={form.productionOrderId} onChange={(e) => setForm({ productionOrderId: e.target.value })}>
              <option value="">— Select order (optional) —</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
            </Select>
          </FormField>

          <Notice variant="warn">Stock will be deducted from the selected lot immediately. Ensure lot availability before issuing.</Notice>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong style={{ fontSize: 14 }}>Material Lines</strong>
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { rawMaterialId: '', lotId: '', uomId: '', issuedQty: '' }])}>
                <Plus size={14} /> Add Line
              </Button>
            </div>
            {lines.map((line, i) => {
              const availableLots = lots.filter((l) => l.productId === line.rawMaterialId && l.currentQty > 0);
              return (
                <div key={i} style={{ background: 'var(--bg-card-alt)', borderRadius: 10, padding: 12, marginBottom: 10, display: 'grid', gap: 10 }}>
                  <div className="ui-form-grid">
                    <FormField label="Raw Material">
                      <Select value={line.rawMaterialId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, rawMaterialId: e.target.value, lotId: '' } : l))}>
                        <option value="">— Select RM —</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Lot (for traceability)">
                      <Select value={line.lotId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, lotId: e.target.value } : l))}>
                        <option value="">— Select lot —</option>
                        {availableLots.map((lt) => <option key={lt.id} value={lt.id}>{lt.lotNumber} ({Number(lt.currentQty).toLocaleString()} avail.)</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Qty to Issue">
                      <Input type="number" placeholder="Quantity" value={line.issuedQty} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, issuedQty: e.target.value } : l))} />
                    </FormField>
                    <FormField label="UOM">
                      <Select value={line.uomId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, uomId: e.target.value } : l))}>
                        <option value="">— UOM —</option>
                        {uoms.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                      </Select>
                    </FormField>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </section>
  );
}

