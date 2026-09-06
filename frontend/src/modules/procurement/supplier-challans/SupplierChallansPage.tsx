import { DataTable } from "../../../components/ui/DataTable";
import { twMerge } from 'tailwind-merge';
import { useEffect, useState } from 'react';
import { Plus, Truck, Scale, FileText } from 'lucide-react';
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
    <PageContainer
      cap="RM PROCUREMENT"
      title="Supplier Delivery Challans"
      description="Record supplier delivery challans with vehicle details, declared weights, and product lines."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> New Challan</Button>}
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
   >

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <h2>Challan Register</h2>
          <span className="text-[12px] text-[#7a9185]">{rows.length} challans total</span>
        </div>
        <div className="overflow-x-auto">
          <DataTable columns={["Challan #","Supplier","Requisition","Vehicle No","Declared Net (kg)","Actual Net (kg)","Variance","Status","Date","Actions"]}>
              {rows.map((d) => {
                const varPct = d.weightVariancePercent;
                const isWarn = varPct !== null && varPct !== undefined && Math.abs(varPct) > 0.5;
                return (
                  <tr key={d.id}>
                    <td><strong className="text-[#0d3b2e]">{d.number}</strong></td>
                    <td>{d.supplier?.name ?? '—'}</td>
                    <td><span className="text-[11px] font-mono text-[#7a9185]">{d.requisition?.number ?? '—'}</span></td>
                    <td><span className="font-mono text-[12px]">{d.vehicleNo ?? '—'}</span></td>
                    <td>{d.netWeight ? Number(d.netWeight).toLocaleString() : '—'}</td>
                    <td>{d.latestWeighment ? Number(d.latestWeighment.netWeight).toLocaleString() : <span className="text-[#7a9185]">Not weighed</span>}</td>
                    <td>
                      {varPct !== null && varPct !== undefined ? (
                        <span className={twMerge("font-semibold text-[13px]", (isWarn ? "text-[#c03030]" : "text-[#1b8f5a]"))}>
                          {varPct >= 0 ? '+' : ''}{varPct.toFixed(2)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td>{statusBadge(d.status)}</td>
                    <td className="text-[12px] text-[#7a9185]">{d.deliveredAt ? new Date(d.deliveredAt).toLocaleDateString('en-GB') : '—'}</td>
                    <td><Button size="sm" variant="secondary" onClick={() => setSelected(d)}><FileText size={14} /> View</Button></td>
                  </tr>
                );
              })}
            </DataTable>
          {rows.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Truck size={28} /></div><b>No challans yet</b><p>Record your first supplier delivery challan.</p></div>}
        </div>
      </Card>

      {open && (
        <Modal title="New Supplier Delivery Challan" description="Register delivery with vehicle, weights and product lines." onClose={() => setOpen(false)} wide
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Save Challan</Button></>}
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr]">
            <FormField label="Linked Requisition"><Select value={form.requisitionId} onChange={(e) => setForm({ ...form, requisitionId: e.target.value })}><option value="">— Select (optional) —</option>{requisitions.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}</Select></FormField>
            <FormField label="Supplier" required><Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">— Select supplier —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></FormField>
            <FormField label="Invoice Number"><Input placeholder="INV-2026-001" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></FormField>
            <FormField label="Vehicle Number" required><Input placeholder="DHK-TRK-0001" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} /></FormField>
            <FormField label="Gross Weight (kg)"><Input type="number" placeholder="Total with vehicle" value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} /></FormField>
            <FormField label="Tare Weight (kg)"><Input type="number" placeholder="Empty vehicle weight" value={form.tareWeight} onChange={(e) => setForm({ ...form, tareWeight: e.target.value })} /></FormField>
          </div>
          {netWeight !== null && (
            <div className="bg-[#eaf8f0] [border:1px_solid_#b0e8cc] rounded-[10px] p-[10px_14px] flex items-center gap-2.5">
              <Scale size={16} className="text-[#1b8f5a]" />
              <span className="text-[#1b8f5a] font-bold">Calculated Net: {netWeight.toLocaleString()} kg</span>
            </div>
          )}
          <div className="[border-top:1px_solid_#e0e5dd] pt-3.5">
            <div className="flex justify-between mb-2.5">
              <strong className="text-[14px]">Product Lines</strong>
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { productId: '', uomId: '', declaredQty: '', unitPrice: '' }])}><Plus size={14} /> Add</Button>
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr] bg-[#f8faf7] p-3 rounded-[10px] mb-2.5">
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
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 p-[0_0_16px]">
            {[['Declared Net', `${Number(selected.netWeight || 0).toLocaleString()} kg`], ['Actual Weighment', selected.latestWeighment ? `${Number(selected.latestWeighment.netWeight).toLocaleString()} kg` : 'Not weighed'], ['Variance', selected.weightVariancePercent != null ? `${selected.weightVariancePercent >= 0 ? '+' : ''}${selected.weightVariancePercent.toFixed(2)}%` : '—']].map(([k, v]) => (
              <div key={k} className="bg-[#f8faf7] rounded-[10px] p-3">
                <div className="text-[11px] text-[#7a9185] mb-1">{k}</div>
                <div className="font-bold text-[16px]">{v}</div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <DataTable columns={["Product","Declared Qty","Accepted Qty","UOM","Unit Price"]}>{selected.lines.map((l, i) => <tr key={i}><td>{l.product?.name ?? '—'}<br /><span className="text-[11px] text-[#7a9185] font-mono">{l.product?.sku}</span></td><td>{Number(l.declaredQty).toLocaleString()}</td><td>{l.acceptedQty != null ? Number(l.acceptedQty).toLocaleString() : '—'}</td><td>{l.uom?.code ?? '—'}</td><td>{l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td></tr>)}</DataTable>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}


