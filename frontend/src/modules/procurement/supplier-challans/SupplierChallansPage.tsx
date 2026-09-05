import { useEffect, useState } from 'react';
import { Plus, Truck, Scale, FileText } from 'lucide-react';
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

interface Delivery {
  id: string; number: string; status: string; vehicleNo?: string;
  invoiceNo?: string; deliveredAt?: string;
  grossWeight?: number; tareWeight?: number; netWeight?: number;
  supplier?: { name: string } | null;
  requisition?: { number: string } | null;
  weightVariance?: number; weightVariancePercent?: number;
  lines: Array<{ id: string; product?: { name: string; sku: string }; uom?: { code: string }; declaredQty: number; acceptedQty?: number; unitPrice?: number; }>;
  latestWeighment?: { netWeight: number; grossWeight: number; tareWeight: number; } | null;
}

interface Requisition { id: string; number: string; }
interface Partner { id: string; name: string; type?: string; partnerType?: string; }
interface Product { id: string; name: string; sku: string; type: string; }
interface UOM { id: string; name: string; code: string; }

export function SupplierChallansPage() {
  const [rows, setRows] = useState<Delivery[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ requisitionId: '', supplierId: '', invoiceNo: '', vehicleNo: '', grossWeight: '', tareWeight: '' });
  const [lines, setLines] = useState([{ productId: '', uomId: '', declaredQty: '', unitPrice: '' }]);

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [d, r, p, pr, u] = await Promise.all([
        api<{ data: Delivery[] }>('/deliveries'),
        api<{ data: Requisition[] }>('/purchase-requisitions'),
        api<{ data: Partner[] }>('/partners'),
        api<{ data: Product[] }>('/products'),
        api<{ data: UOM[] }>('/uoms'),
      ]);
      setRows(d.data); setRequisitions(r.data);
      setSuppliers(p.data.filter((x) => x.type === 'SUPPLIER' || x.partnerType === 'SUPPLIER' || x.type === 'BOTH'));
      setProducts(pr.data.filter((x) => x.type === 'RAW_MATERIAL'));
      setUoms(u.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const netWeight = form.grossWeight && form.tareWeight
    ? Number(form.grossWeight) - Number(form.tareWeight) : null;

  const submit = async () => {
    try {
      const validLines = lines.filter((l) => l.productId && l.uomId && l.declaredQty);
      await api('/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          requisitionId: form.requisitionId || undefined,
          grossWeight: form.grossWeight ? Number(form.grossWeight) : undefined,
          tareWeight: form.tareWeight ? Number(form.tareWeight) : undefined,
          lines: validLines.map((l) => ({ productId: l.productId, uomId: l.uomId, declaredQty: Number(l.declaredQty), unitPrice: l.unitPrice ? Number(l.unitPrice) : undefined })),
        }),
      });
      setOpen(false); setForm({ requisitionId: '', supplierId: '', invoiceNo: '', vehicleNo: '', grossWeight: '', tareWeight: '' });
      setLines([{ productId: '', uomId: '', declaredQty: '', unitPrice: '' }]); void load();
    } catch (e: any) { setMessage(e.message); }
  };

  return (
    <section className="page-container">
      <PageHeader cap="RM PROCUREMENT" title="Supplier Delivery Challans"
        description="Record supplier delivery challans with vehicle details, declared weights, and product lines."
        actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> New Challan</Button>}
      />
      {message && <Notice variant="error">{message}</Notice>}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-header">
          <h2>Challan Register</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rows.length} challans total</span>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Challan #</th><th>Supplier</th><th>Requisition</th><th>Vehicle No</th><th>Declared Net (kg)</th><th>Actual Net (kg)</th><th>Variance</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((d) => {
                const varPct = d.weightVariancePercent;
                const isWarn = varPct !== null && varPct !== undefined && Math.abs(varPct) > 0.5;
                return (
                  <tr key={d.id}>
                    <td><strong style={{ color: 'var(--brand-primary)' }}>{d.number}</strong></td>
                    <td>{d.supplier?.name ?? '—'}</td>
                    <td><span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{d.requisition?.number ?? '—'}</span></td>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.vehicleNo ?? '—'}</span></td>
                    <td>{d.netWeight ? Number(d.netWeight).toLocaleString() : '—'}</td>
                    <td>{d.latestWeighment ? Number(d.latestWeighment.netWeight).toLocaleString() : <span style={{ color: 'var(--text-muted)' }}>Not weighed</span>}</td>
                    <td>
                      {varPct !== null && varPct !== undefined ? (
                        <span style={{ color: isWarn ? 'var(--error)' : 'var(--success)', fontWeight: 600, fontSize: 13 }}>
                          {varPct >= 0 ? '+' : ''}{varPct.toFixed(2)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td>{statusBadge(d.status)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.deliveredAt ? new Date(d.deliveredAt).toLocaleDateString('en-GB') : '—'}</td>
                    <td><Button size="sm" variant="secondary" onClick={() => setSelected(d)}><FileText size={14} /> View</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty-state"><div className="empty-state__icon"><Truck size={28} /></div><b>No challans yet</b><p>Record your first supplier delivery challan.</p></div>}
        </div>
      </div>

      {open && (
        <Modal title="New Supplier Delivery Challan" description="Register delivery with vehicle, weights and product lines." onClose={() => setOpen(false)} wide
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Save Challan</Button></>}
        >
          <div className="ui-form-grid">
            <FormField label="Linked Requisition"><Select value={form.requisitionId} onChange={(e) => setForm({ ...form, requisitionId: e.target.value })}><option value="">— Select (optional) —</option>{requisitions.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}</Select></FormField>
            <FormField label="Supplier" required><Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">— Select supplier —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></FormField>
            <FormField label="Invoice Number"><Input placeholder="INV-2026-001" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></FormField>
            <FormField label="Vehicle Number" required><Input placeholder="DHK-TRK-0001" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} /></FormField>
            <FormField label="Gross Weight (kg)"><Input type="number" placeholder="Total with vehicle" value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} /></FormField>
            <FormField label="Tare Weight (kg)"><Input type="number" placeholder="Empty vehicle weight" value={form.tareWeight} onChange={(e) => setForm({ ...form, tareWeight: e.target.value })} /></FormField>
          </div>
          {netWeight !== null && (
            <div style={{ background: 'var(--success-bg)', border: '1px solid #b0e8cc', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Scale size={16} style={{ color: 'var(--success)' }} />
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>Calculated Net: {netWeight.toLocaleString()} kg</span>
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong style={{ fontSize: 14 }}>Product Lines</strong>
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { productId: '', uomId: '', declaredQty: '', unitPrice: '' }])}><Plus size={14} /> Add</Button>
            </div>
            {lines.map((line, i) => (
              <div key={i} className="ui-form-grid" style={{ background: 'var(--bg-card-alt)', padding: 12, borderRadius: 10, marginBottom: 10 }}>
                <FormField label="Product"><Select value={line.productId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, productId: e.target.value } : l))}><option value="">— Select product —</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></FormField>
                <FormField label="UOM"><Select value={line.uomId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, uomId: e.target.value } : l))}><option value="">— UOM —</option>{uoms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></FormField>
                <FormField label="Declared Qty"><Input type="number" value={line.declaredQty} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, declaredQty: e.target.value } : l))} /></FormField>
                <FormField label="Unit Price"><Input type="number" value={line.unitPrice} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, unitPrice: e.target.value } : l))} /></FormField>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {selected && (
        <Modal title={`Challan: ${selected.number}`} description={`Supplier: ${selected.supplier?.name ?? '—'} · Vehicle: ${selected.vehicleNo ?? '—'}`} onClose={() => setSelected(null)} wide footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '0 0 16px' }}>
            {[['Declared Net', `${Number(selected.netWeight || 0).toLocaleString()} kg`], ['Actual Weighment', selected.latestWeighment ? `${Number(selected.latestWeighment.netWeight).toLocaleString()} kg` : 'Not weighed'], ['Variance', selected.weightVariancePercent != null ? `${selected.weightVariancePercent >= 0 ? '+' : ''}${selected.weightVariancePercent.toFixed(2)}%` : '—']].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--bg-card-alt)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{k}</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Product</th><th>Declared Qty</th><th>Accepted Qty</th><th>UOM</th><th>Unit Price</th></tr></thead>
              <tbody>{selected.lines.map((l, i) => <tr key={i}><td>{l.product?.name ?? '—'}<br /><span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{l.product?.sku}</span></td><td>{Number(l.declaredQty).toLocaleString()}</td><td>{l.acceptedQty != null ? Number(l.acceptedQty).toLocaleString() : '—'}</td><td>{l.uom?.code ?? '—'}</td><td>{l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </Modal>
      )}
    </section>
  );
}


