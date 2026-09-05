import { useEffect, useState } from 'react';
import { Plus, Truck, Search, FileText } from 'lucide-react';
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

interface Dispatch {
  id: string; dispatchNumber: string; status: string; dispatchedAt?: string;
  vehicleNo?: string; salesOrder?: { number: string } | null;
  customer?: { name: string } | null;
  lines: Array<{ id: string; fgProduct?: { name: string; sku: string }; lot?: { lotNumber: string }; uom?: { code: string }; dispatchedQty: number; unitPrice?: number; }>;
  totalValue?: number;
}
interface SalesOrder { id: string; number: string; }
interface Partner { id: string; name: string; partnerType: string; }
interface Product { id: string; name: string; sku: string; type: string; }
interface Lot { id: string; lotNumber: string; productId: string; currentQty: number; }
interface UOM { id: string; name: string; code: string; }

export function DispatchesPage() {
  const [rows, setRows] = useState<Dispatch[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Dispatch | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ salesOrderId: '', customerId: '', vehicleNo: '' });
  const [lines, setLines] = useState([{ fgProductId: '', lotId: '', uomId: '', dispatchedQty: '', unitPrice: '' }]);

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [d, so, p, pr, lt, u] = await Promise.all([
        api<{ data: Dispatch[] }>('/dispatches'),
        api<{ data: SalesOrder[] }>('/sales-orders'),
        api<{ data: Partner[] }>('/partners'),
        api<{ data: Product[] }>('/products'),
        api<{ data: Lot[] }>('/fm-store/lots'),
        api<{ data: UOM[] }>('/uoms'),
      ]);
      setRows(d.data); setSalesOrders(so.data);
      setCustomers(p.data.filter((x) => x.partnerType === 'CUSTOMER'));
      setProducts(pr.data.filter((x) => x.type === 'FINISHED_GOOD'));
      setLots(lt.data); setUoms(u.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      const validLines = lines.filter((l) => l.fgProductId && l.uomId && l.dispatchedQty);
      await api('/dispatches', {
        method: 'POST',
        body: JSON.stringify({
          salesOrderId: form.salesOrderId || undefined,
          customerId: form.customerId || undefined,
          vehicleNo: form.vehicleNo || undefined,
          lines: validLines.map((l) => ({
            fgProductId: l.fgProductId,
            lotId: l.lotId || undefined,
            uomId: l.uomId,
            dispatchedQty: Number(l.dispatchedQty),
            unitPrice: l.unitPrice ? Number(l.unitPrice) : undefined,
          })),
        }),
      });
      setOpen(false); setForm({ salesOrderId: '', customerId: '', vehicleNo: '' });
      setLines([{ fgProductId: '', lotId: '', uomId: '', dispatchedQty: '', unitPrice: '' }]); void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const printDispatch = (d: Dispatch) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Dispatch ${d.dispatchNumber}</title>
      <style>body{font-family:sans-serif;padding:32px;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:10px;text-align:left}th{background:#f5f5f5}.header{display:flex;justify-content:space-between}.badge{background:#e8f0ff;color:#1864ab;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700}.footer{margin-top:40px;font-size:13px;color:#777}</style>
      </head><body>
      <div class="header"><div><h1>Dispatch Note — ${d.dispatchNumber}</h1><p>Customer: <strong>${d.customer?.name ?? 'N/A'}</strong><br>Vehicle: <strong>${d.vehicleNo ?? 'N/A'}</strong><br>Sales Order: ${d.salesOrder?.number ?? 'N/A'}</p></div><span class="badge">${d.status}</span></div>
      <table><thead><tr><th>#</th><th>FG Product</th><th>SKU</th><th>Batch Lot</th><th>Qty Dispatched</th><th>UOM</th><th>Unit Price</th></tr></thead>
      <tbody>${d.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${l.fgProduct?.name ?? ''}</td><td>${l.fgProduct?.sku ?? ''}</td><td>${l.lot?.lotNumber ?? '—'}</td><td>${Number(l.dispatchedQty).toLocaleString()}</td><td>${l.uom?.code ?? ''}</td><td>${l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td></tr>`).join('')}</tbody></table>
      <div class="footer"><p>Total Value: <strong>${d.totalValue ? d.totalValue.toLocaleString() : 'N/A'}</strong></p><p>Received by: _______________________ &nbsp;&nbsp; Date: _____________ &nbsp;&nbsp; Seal:</p></div>
      <script>setTimeout(()=>window.print(),300)</script></body></html>
    `);
    w.document.close();
  };

  const filtered = rows.filter((r) =>
    r.dispatchNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.customer?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="page-container">
      <PageHeader cap="SALES & DISPATCH" title="FM Dispatches"
        description="Record finished goods dispatches to customers with full lot traceability and printable delivery notes."
        actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> New Dispatch</Button>}
      />
      {message && <Notice variant="error">{message}</Notice>}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total', v: rows.length, c: 'brand' },
          { label: 'Pending', v: rows.filter((r) => r.status === 'SUBMITTED').length, c: 'blue' },
          { label: 'Completed', v: rows.filter((r) => r.status === 'CLOSED').length, c: 'green' },
          { label: 'Cancelled', v: rows.filter((r) => r.status === 'CANCELLED').length, c: 'red' },
        ].map((s) => (
          <div className="stat-card" key={s.label} style={{ padding: '14px 16px' }}>
            <div className="stat-card__body"><div className="stat-card__value" style={{ fontSize: 22 }}>{s.v}</div><div className="stat-card__label">{s.label} Dispatches</div></div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-header">
          <h2>Dispatch Register</h2>
          <div className="search-bar"><Search size={14} /><input placeholder="Search dispatch or customer…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Dispatch #</th><th>Customer</th><th>Sales Order</th><th>Vehicle</th><th>Lines</th><th>Total Value</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td><strong style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>{d.dispatchNumber}</strong></td>
                  <td><strong>{d.customer?.name ?? '—'}</strong></td>
                  <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.salesOrder?.number ?? '—'}</span></td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.vehicleNo ?? '—'}</span></td>
                  <td>{d.lines.length} items</td>
                  <td>{d.totalValue ? d.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
                  <td>{statusBadge(d.status)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.dispatchedAt ? new Date(d.dispatchedAt).toLocaleDateString('en-GB') : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" variant="secondary" onClick={() => setSelected(d)}><FileText size={14} /></Button>
                      <Button size="sm" variant="secondary" onClick={() => printDispatch(d)}><Truck size={14} /> Note</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state"><div className="empty-state__icon"><Truck size={28} /></div><b>No dispatches yet</b><p>Record your first FG dispatch to a customer.</p></div>}
        </div>
      </div>

      {open && (
        <Modal title="New FM Dispatch" description="Dispatch finished goods with lot traceability." onClose={() => setOpen(false)} wide
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Dispatch</Button></>}
        >
          <div className="ui-form-grid">
            <FormField label="Customer"><Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">— Select customer —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></FormField>
            <FormField label="Sales Order Ref"><Select value={form.salesOrderId} onChange={(e) => setForm({ ...form, salesOrderId: e.target.value })}><option value="">— Link SO (optional) —</option>{salesOrders.map((so) => <option key={so.id} value={so.id}>{so.number}</option>)}</Select></FormField>
            <FormField label="Vehicle Number"><Input placeholder="DHK-TRK-0001" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} /></FormField>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong style={{ fontSize: 14 }}>Dispatch Lines</strong>
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { fgProductId: '', lotId: '', uomId: '', dispatchedQty: '', unitPrice: '' }])}><Plus size={14} /> Add</Button>
            </div>
            {lines.map((line, i) => {
              const avlLots = lots.filter((l) => l.productId === line.fgProductId && l.currentQty > 0);
              return (
                <div key={i} className="ui-form-grid" style={{ background: 'var(--bg-card-alt)', padding: 12, borderRadius: 10, marginBottom: 10 }}>
                  <FormField label="FG Product"><Select value={line.fgProductId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, fgProductId: e.target.value, lotId: '' } : l))}><option value="">— Select FG —</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></FormField>
                  <FormField label="Batch Lot"><Select value={line.lotId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, lotId: e.target.value } : l))}><option value="">— Select lot —</option>{avlLots.map((lt) => <option key={lt.id} value={lt.id}>{lt.lotNumber} ({Number(lt.currentQty).toLocaleString()} avail.)</option>)}</Select></FormField>
                  <FormField label="Qty"><Input type="number" value={line.dispatchedQty} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, dispatchedQty: e.target.value } : l))} /></FormField>
                  <FormField label="Unit Price"><Input type="number" value={line.unitPrice} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, unitPrice: e.target.value } : l))} /></FormField>
                  <FormField label="UOM"><Select value={line.uomId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, uomId: e.target.value } : l))}><option value="">— UOM —</option>{uoms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></FormField>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {selected && (
        <Modal title={`Dispatch: ${selected.dispatchNumber}`} description={`Customer: ${selected.customer?.name ?? '—'} · Vehicle: ${selected.vehicleNo ?? '—'}`} onClose={() => setSelected(null)} wide footer={<><Button variant="secondary" onClick={() => printDispatch(selected)}><Truck size={14} /> Print Note</Button><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button></>}>
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>FG Product</th><th>SKU</th><th>Batch Lot</th><th>Qty</th><th>UOM</th><th>Unit Price</th></tr></thead>
              <tbody>{selected.lines.map((l, i) => <tr key={i}><td>{l.fgProduct?.name ?? '—'}</td><td><span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{l.fgProduct?.sku}</span></td><td><span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{l.lot?.lotNumber ?? '—'}</span></td><td><strong>{Number(l.dispatchedQty).toLocaleString()}</strong></td><td>{l.uom?.code ?? '—'}</td><td>{l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </Modal>
      )}
    </section>
  );
}


