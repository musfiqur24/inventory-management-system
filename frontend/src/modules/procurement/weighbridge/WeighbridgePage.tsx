import { twMerge } from 'tailwind-merge';
import { Card } from '../../../components/ui/Card';
import { useEffect, useState } from 'react';
import { Plus, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
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
      <div className="[background:linear-gradient(135deg,_#0d3b2e,_#1a5c45)] rounded-[24px] p-8 text-[#fff] text-center mb-6">
        <div className="text-[11px] font-bold tracking-[0.12em] uppercase opacity-60">Weighbridge Scale — Last Reading</div>
        <div className="[font-family:'Outfit',_sans-serif] text-[64px] font-extrabold tracking-[-2px] leading-[1] m-[8px_0_4px] max-[480px]:text-[48px]">
          {rows.length > 0 ? Number(rows[0].netWeight).toLocaleString() : '0'}
        </div>
        <div className="text-[22px] opacity-70 font-medium">kg net weight</div>
        {rows.length > 0 && rows[0].isWarning && (
          <div className="flex items-center justify-center gap-2 p-[10px_18px] rounded-[30px] text-[13px] font-bold m-[12px_auto_0] w-fit bg-[rgba(200,125,18,0.25)] text-[#f5d080]">
            <AlertTriangle size={14} /> Weight variance {rows[0].variancePercent?.toFixed(2)}% — Exceeds 0.5% tolerance
          </div>
        )}
        {rows.length > 0 && !rows[0].isWarning && rows[0].variancePercent !== null && (
          <div className="flex items-center justify-center gap-2 p-[10px_18px] rounded-[30px] text-[13px] font-bold m-[12px_auto_0] w-fit bg-[rgba(168,213,72,0.2)] text-[#c8e87a]">
            <CheckCircle2 size={14} /> Within tolerance ({rows[0].variancePercent?.toFixed(2)}% variance)
          </div>
        )}
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0"><h2>Weighment Log</h2><span className="text-[12px] text-[#7a9185]">{rows.length} records</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-140 border-collapse [:where(&_th)]:p-[10px_16px] [:where(&_th)]:text-left [:where(&_th)]:text-[11px] [:where(&_th)]:font-bold [:where(&_th)]:tracking-[0.07em] [:where(&_th)]:uppercase [:where(&_th)]:text-[#7a9185] [:where(&_th)]:bg-[#f8faf7] [:where(&_th)]:[border-bottom:1px_solid_#e0e5dd] [:where(&_td)]:p-[13px_16px] [:where(&_td)]:[border-bottom:1px_solid_#e0e5dd] [:where(&_td)]:text-[13.5px] [:where(&_td)]:text-[#0f1c16] [&_tbody_tr]:[transition:background_0.1s] [&_tbody_tr:hover]:bg-[#f8faf7] [&_tbody_tr:last-child_td]:[border-bottom:0]">
            <thead><tr><th>Vehicle No</th><th>Challan</th><th>Gross (kg)</th><th>Tare (kg)</th><th>Net (kg)</th><th>Variance</th><th>Status</th><th>Measured At</th></tr></thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td><span className="font-mono font-semibold">{w.vehicleNo ?? '—'}</span></td>
                  <td><span className="text-[11px] text-[#7a9185]">{w.delivery?.number ?? '—'}</span></td>
                  <td>{Number(w.grossWeight).toLocaleString()}</td>
                  <td>{Number(w.tareWeight).toLocaleString()}</td>
                  <td><strong>{Number(w.netWeight).toLocaleString()}</strong></td>
                  <td>
                    {w.variancePercent != null ? (
                      <span className={twMerge("font-semibold", (w.isWarning ? "text-[#c03030]" : "text-[#1b8f5a]"))}>
                        {w.variancePercent >= 0 ? '+' : ''}{w.variancePercent.toFixed(2)}%
                        {w.isWarning && <AlertTriangle size={12} className="ml-1 [vertical-align:middle]" />}
                      </span>
                    ) : <span className="text-[#7a9185]">—</span>}
                  </td>
                  <td>{w.isWarning ? <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#fdf0f0] text-[#c03030]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />Warning</span> : <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#eaf8f0] text-[#1b8f5a]"><span className="w-1.5 h-1.5 rounded-full [background:currentColor] shrink-0" />OK</span>}</td>
                  <td className="text-[12px] text-[#7a9185]">{new Date(w.measuredAt).toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Scale size={28} /></div><b>No weighments yet</b><p>Record the first vehicle weighment at the gate.</p></div>}
        </div>
      </Card>

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
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr]">
            <FormField label="Gross Weight (kg) — with vehicle" required>
              <Input type="number" placeholder="e.g. 42500" value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} />
            </FormField>
            <FormField label="Tare Weight (kg) — empty vehicle" required>
              <Input type="number" placeholder="e.g. 12500" value={form.tareWeight} onChange={(e) => setForm({ ...form, tareWeight: e.target.value })} />
            </FormField>
          </div>

          {/* Live preview */}
          {preview && (
            <div className="bg-[#0d3b2e] rounded-[14px] p-5 text-[#fff] text-center">
              <div className="text-[11px] opacity-60 font-bold tracking-[0.1em] uppercase mb-1.5">Calculated Net Weight</div>
              <div className="[font-family:'Outfit',_sans-serif] text-[48px] font-extrabold tracking-[-1px]">{preview.net.toLocaleString()}</div>
              <div className="opacity-70">kg</div>
              {preview.variancePct !== null && (
                <div className={twMerge("mt-3 p-[8px_16px] rounded-[20px] inline-flex items-center gap-2", (preview.isWarn ? "bg-[rgba(200,48,48,0.25)]" : "bg-[rgba(168,213,72,0.2)]"))}>
                  {preview.isWarn ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                  <span className="text-[13px] font-bold">
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


