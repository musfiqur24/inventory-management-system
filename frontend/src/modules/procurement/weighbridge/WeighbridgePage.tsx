import { useEffect, useState } from 'react';
import { Plus, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Notice } from '../../../components/ui/Notice';

interface Weighment {
  id: string; vehicleNo?: string; grossWeight: number; tareWeight: number; netWeight: number;
  measuredAt: string; variance?: number; variancePercent?: number; isWarning?: boolean;
  delivery?: { number: string; supplierId: string; } | null;
}
interface Delivery { id: string; number: string; vehicleNo?: string; netWeight?: number; }

export function WeighbridgePage() {
  const [rows, setRows] = useState<Weighment[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ deliveryId: '', vehicleNo: '', grossWeight: '', tareWeight: '' });
  const [preview, setPreview] = useState<{ net: number; variance: number | null; variancePct: number | null; isWarn: boolean } | null>(null);

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [w, d] = await Promise.all([api<{ data: Weighment[] }>('/weighments'), api<{ data: Delivery[] }>('/deliveries')]);
      setRows(w.data); setDeliveries(d.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  // Live preview of net weight and variance as operator types
  useEffect(() => {
    const gross = Number(form.grossWeight);
    const tare = Number(form.tareWeight);
    if (!form.grossWeight || !form.tareWeight || gross <= tare) { setPreview(null); return; }
    const net = gross - tare;
    const delivery = deliveries.find((d) => d.id === form.deliveryId);
    let variance: number | null = null, variancePct: number | null = null, isWarn = false;
    if (delivery && delivery.netWeight) {
      const declared = Number(delivery.netWeight);
      variance = net - declared;
      variancePct = declared > 0 ? (variance / declared) * 100 : 0;
      isWarn = Math.abs(variancePct) > 0.5;
    }
    setPreview({ net, variance, variancePct, isWarn });
  }, [form.grossWeight, form.tareWeight, form.deliveryId, deliveries]);

  const submit = async () => {
    try {
      await api('/weighments', {
        method: 'POST',
        body: JSON.stringify({
          deliveryId: form.deliveryId || undefined,
          vehicleNo: form.vehicleNo,
          grossWeight: Number(form.grossWeight),
          tareWeight: Number(form.tareWeight),
        }),
      });
      setOpen(false); setForm({ deliveryId: '', vehicleNo: '', grossWeight: '', tareWeight: '' }); setPreview(null);
      void load();
    } catch (e: any) { setMessage(e.message); }
  };

  return (
    <PageContainer
      cap="WEIGHBRIDGE STATION"
      title="Weighbridge Scale Records"
      description="Capture gross and tare weights for incoming vehicles. Net weight is calculated automatically and compared against declared challan weights."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> Record Weighment</Button>}
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
    >

      {/* Live scale display */}
      <div className="weighbridge-display" style={{ marginBottom: 24 }}>
        <div className="weighbridge-display__label">Weighbridge Scale — Last Reading</div>
        <div className="weighbridge-display__value">
          {rows.length > 0 ? Number(rows[0].netWeight).toLocaleString() : '0'}
        </div>
        <div className="weighbridge-display__unit">kg net weight</div>
        {rows.length > 0 && rows[0].isWarning && (
          <div className="weighbridge-variance weighbridge-variance--warn">
            <AlertTriangle size={14} /> Weight variance {rows[0].variancePercent?.toFixed(2)}% — Exceeds 0.5% tolerance
          </div>
        )}
        {rows.length > 0 && !rows[0].isWarning && rows[0].variancePercent !== null && (
          <div className="weighbridge-variance weighbridge-variance--ok">
            <CheckCircle2 size={14} /> Within tolerance ({rows[0].variancePercent?.toFixed(2)}% variance)
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-header"><h2>Weighment Log</h2><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rows.length} records</span></div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Vehicle No</th><th>Challan</th><th>Gross (kg)</th><th>Tare (kg)</th><th>Net (kg)</th><th>Variance</th><th>Status</th><th>Measured At</th></tr></thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{w.vehicleNo ?? '—'}</span></td>
                  <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w.delivery?.number ?? '—'}</span></td>
                  <td>{Number(w.grossWeight).toLocaleString()}</td>
                  <td>{Number(w.tareWeight).toLocaleString()}</td>
                  <td><strong>{Number(w.netWeight).toLocaleString()}</strong></td>
                  <td>
                    {w.variancePercent != null ? (
                      <span style={{ color: w.isWarning ? 'var(--error)' : 'var(--success)', fontWeight: 600 }}>
                        {w.variancePercent >= 0 ? '+' : ''}{w.variancePercent.toFixed(2)}%
                        {w.isWarning && <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>{w.isWarning ? <span className="badge badge--red"><span className="badge__dot" />Warning</span> : <span className="badge badge--green"><span className="badge__dot" />OK</span>}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(w.measuredAt).toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty-state"><div className="empty-state__icon"><Scale size={28} /></div><b>No weighments yet</b><p>Record the first vehicle weighment at the gate.</p></div>}
        </div>
      </div>

      {open && (
        <Modal title="Record Vehicle Weighment" description="Enter gross and tare scale readings. Net weight and variance are calculated live." onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!form.vehicleNo || !form.grossWeight || !form.tareWeight}>Record Weighment</Button></>}
        >
          <FormField label="Linked Supplier Challan">
            <Select value={form.deliveryId} onChange={(e) => setForm({ ...form, deliveryId: e.target.value })}>
              <option value="">— Select delivery (optional) —</option>
              {deliveries.map((d) => <option key={d.id} value={d.id}>{d.number} {d.vehicleNo ? `· ${d.vehicleNo}` : ''}</option>)}
            </Select>
          </FormField>
          <FormField label="Vehicle Number" required>
            <Input placeholder="e.g. DHK-TRK-12-3456" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} />
          </FormField>
          <div className="ui-form-grid">
            <FormField label="Gross Weight (kg) — with vehicle" required>
              <Input type="number" placeholder="e.g. 42500" value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} />
            </FormField>
            <FormField label="Tare Weight (kg) — empty vehicle" required>
              <Input type="number" placeholder="e.g. 12500" value={form.tareWeight} onChange={(e) => setForm({ ...form, tareWeight: e.target.value })} />
            </FormField>
          </div>

          {/* Live preview */}
          {preview && (
            <div style={{ background: 'var(--brand-primary)', borderRadius: 14, padding: 20, color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Calculated Net Weight</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 48, fontWeight: 800, letterSpacing: -1 }}>{preview.net.toLocaleString()}</div>
              <div style={{ opacity: 0.7 }}>kg</div>
              {preview.variancePct !== null && (
                <div style={{ marginTop: 12, padding: '8px 16px', borderRadius: 20, background: preview.isWarn ? 'rgba(200,48,48,0.25)' : 'rgba(168,213,72,0.2)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {preview.isWarn ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {preview.variance !== null && preview.variance >= 0 ? '+' : ''}{preview.variance?.toLocaleString()} kg ({preview.variancePct.toFixed(2)}% variance)
                  </span>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </PageContainer>
  );
}


