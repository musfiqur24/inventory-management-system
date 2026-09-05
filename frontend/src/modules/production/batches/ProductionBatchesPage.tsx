import { useEffect, useState } from 'react';
import { Plus, Factory, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

interface Batch {
  id: string; batchNumber: string; status: string;
  plannedQty: number; actualQty?: number;
  plannedWastePct?: number; actualWastePct?: number; variancePct?: number;
  productionOrder?: { number: string } | null;
  fgProduct?: { name: string; sku: string } | null;
  startedAt?: string; completedAt?: string;
}
interface ProductionOrder { id: string; number: string; fgProduct?: { name: string } | null; }

export function ProductionBatchesPage() {
  const [rows, setRows] = useState<Batch[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ productionOrderId: '', plannedQty: '', plannedWastePct: '' });

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [b, po] = await Promise.all([api<{ data: Batch[] }>('/batches'), api<{ data: ProductionOrder[] }>('/production-orders')]);
      setRows(b.data); setOrders(po.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      await api('/batches', {
        method: 'POST',
        body: JSON.stringify({
          productionOrderId: form.productionOrderId || undefined,
          plannedQty: Number(form.plannedQty),
          plannedWastePct: form.plannedWastePct ? Number(form.plannedWastePct) : undefined,
        }),
      });
      setOpen(false); setForm({ productionOrderId: '', plannedQty: '', plannedWastePct: '' }); void load();
    } catch (e: any) { setMessage(e.message); }
  };

  return (
    <PageContainer
      cap="PRODUCTION"
      title="Factory Batches"
      description="Track production batch execution, actual waste vs planned, and link to finished good inventory."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> Start Batch</Button>}
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
    >

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total', v: rows.length, c: 'brand' },
          { label: 'Active', v: rows.filter((r) => r.status === 'SUBMITTED' || r.status === 'DRAFT').length, c: 'blue' },
          { label: 'Completed', v: rows.filter((r) => r.status === 'CLOSED').length, c: 'green' },
          { label: 'Waste Issues', v: rows.filter((r) => r.variancePct != null && Math.abs(r.variancePct) > 1).length, c: 'red' },
        ].map((s) => (
          <div className="stat-card" key={s.label} style={{ padding: '14px 16px' }}>
            <div className="stat-card__body"><div className="stat-card__value" style={{ fontSize: 22 }}>{s.v}</div><div className="stat-card__label">{s.label} Batches</div></div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-header"><h2>Batch Register</h2></div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Batch #</th><th>Production Order</th><th>FG Product</th><th>Planned Qty</th><th>Actual Qty</th><th>Planned Waste%</th><th>Actual Waste%</th><th>Variance</th><th>Status</th><th>Completed</th></tr></thead>
            <tbody>
              {rows.map((b) => {
                const isWarn = b.variancePct != null && Math.abs(b.variancePct) > 1;
                return (
                  <tr key={b.id}>
                    <td><strong style={{ fontFamily: 'monospace', color: 'var(--brand-primary)' }}>{b.batchNumber}</strong></td>
                    <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.productionOrder?.number ?? '—'}</span></td>
                    <td>{b.fgProduct?.name ?? '—'}<br /><span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{b.fgProduct?.sku}</span></td>
                    <td>{Number(b.plannedQty).toLocaleString()}</td>
                    <td>{b.actualQty != null ? <strong>{Number(b.actualQty).toLocaleString()}</strong> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{b.plannedWastePct != null ? `${Number(b.plannedWastePct).toFixed(2)}%` : '—'}</td>
                    <td>{b.actualWastePct != null ? `${Number(b.actualWastePct).toFixed(2)}%` : '—'}</td>
                    <td>
                      {b.variancePct != null ? (
                        <span style={{ color: isWarn ? 'var(--error)' : 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isWarn ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                          {b.variancePct >= 0 ? '+' : ''}{Number(b.variancePct).toFixed(2)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td>{statusBadge(b.status)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.completedAt ? new Date(b.completedAt).toLocaleDateString('en-GB') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty-state"><div className="empty-state__icon"><Factory size={28} /></div><b>No batches yet</b><p>Start a factory batch linked to a production order.</p></div>}
        </div>
      </div>

      {open && (
        <Modal title="Start Factory Batch" description="Link to a production order and set planned quantities." onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!form.plannedQty}>Start Batch</Button></>}
        >
          <FormField label="Linked Production Order">
            <Select value={form.productionOrderId} onChange={(e) => setForm({ ...form, productionOrderId: e.target.value })}>
              <option value="">— Select order —</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.number} {o.fgProduct?.name ? `· ${o.fgProduct.name}` : ''}</option>)}
            </Select>
          </FormField>
          <div className="ui-form-grid">
            <FormField label="Planned Output Qty (kg)" required>
              <Input type="number" placeholder="e.g. 5000" value={form.plannedQty} onChange={(e) => setForm({ ...form, plannedQty: e.target.value })} />
            </FormField>
            <FormField label="Planned Waste %" hint="From recipe formulation. Actual vs planned will be compared on completion.">
              <Input type="number" placeholder="e.g. 2.5" step="0.01" value={form.plannedWastePct} onChange={(e) => setForm({ ...form, plannedWastePct: e.target.value })} />
            </FormField>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}


