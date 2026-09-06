import { DataTable } from "../../../components/ui/DataTable";
import { useToastMessage } from "../../../components/ui/Toast";
import { printReport } from '../../../shared/printReport';
import { useEffect, useState } from 'react';
import { Plus, Truck, Search, FileText } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
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
  const [, setMessage] = useToastMessage();
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
    printReport(`Dispatch ${d.dispatchNumber}`, `
      <div class="flex items-start justify-between"><div><h1 class="text-[22px] font-bold">Dispatch Note — ${d.dispatchNumber}</h1><p>Customer: <strong>${d.customer?.name ?? 'N/A'}</strong><br>Vehicle: <strong>${d.vehicleNo ?? 'N/A'}</strong><br>Sales Order: ${d.salesOrder?.number ?? 'N/A'}</p></div><span class="rounded-full px-2.5 py-1 text-xs font-bold bg-[#e8f0ff] text-[#1864ab]">${d.status}</span></div>
      <table class="mt-5 w-full border-collapse [:where(&_th)]:border [:where(&_th)]:border-[#ccc] [:where(&_th)]:p-2.5 [:where(&_th)]:text-left [:where(&_th)]:bg-[#f5f5f5] [:where(&_td)]:border [:where(&_td)]:border-[#ccc] [:where(&_td)]:p-2.5 [:where(&_td)]:text-left"><thead><tr><th>#</th><th>FG Product</th><th>SKU</th><th>Batch Lot</th><th>Qty Dispatched</th><th>UOM</th><th>Unit Price</th></tr></thead>
      <tbody>${d.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${l.fgProduct?.name ?? ''}</td><td>${l.fgProduct?.sku ?? ''}</td><td>${l.lot?.lotNumber ?? '—'}</td><td>${Number(l.dispatchedQty).toLocaleString()}</td><td>${l.uom?.code ?? ''}</td><td>${l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td></tr>`).join('')}</tbody></table>
      <div class="mt-10 text-[13px] text-[#777] "><p>Total Value: <strong>${d.totalValue ? d.totalValue.toLocaleString() : 'N/A'}</strong></p><p>Received by: _______________________ &nbsp;&nbsp; Date: _____________ &nbsp;&nbsp; Seal:</p></div>
    `);
  };

  const filtered = rows.filter((r) =>
    r.dispatchNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.customer?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer
      cap="SALES & DISPATCH"
      title="FM Dispatches"
      description="Record finished goods dispatches to customers with full lot traceability and printable delivery notes."
      actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> New Dispatch</Button>}
   >

      <div className="grid grid-cols-[repeat(4,_1fr)] gap-4 mb-5 max-[900px]:grid-cols-[repeat(2,_1fr)] max-[480px]:grid-cols-[1fr]">
        {[
          { label: 'Total', v: rows.length, c: 'brand' },
          { label: 'Pending', v: rows.filter((r) => r.status === 'SUBMITTED').length, c: 'blue' },
          { label: 'Completed', v: rows.filter((r) => r.status === 'CLOSED').length, c: 'green' },
          { label: 'Cancelled', v: rows.filter((r) => r.status === 'CANCELLED').length, c: 'red' },
        ].map((s) => (
          <Card className="flex items-start gap-3.5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md p-[14px_16px]" key={s.label}>
            <div className="min-w-0"><div className="[font-family:'Outfit',_sans-serif] text-[22px] font-bold text-[#0f1c16] leading-[1] mb-1">{s.v}</div><div className="text-[12px] text-[#7a9185] font-medium">{s.label} Dispatches</div></div>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <h2>Dispatch Register</h2>
          <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] flex-1 max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]"><Search size={14} /><input placeholder="Search dispatch or customer…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto">
          <DataTable columns={["Dispatch #","Customer","Sales Order","Vehicle","Lines","Total Value","Status","Date","Actions"]}>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td><strong className="text-[#0d3b2e] font-mono">{d.dispatchNumber}</strong></td>
                  <td><strong>{d.customer?.name ?? '—'}</strong></td>
                  <td><span className="text-[11px] text-[#7a9185]">{d.salesOrder?.number ?? '—'}</span></td>
                  <td><span className="font-mono text-[12px]">{d.vehicleNo ?? '—'}</span></td>
                  <td>{d.lines.length} items</td>
                  <td>{d.totalValue ? d.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
                  <td>{statusBadge(d.status)}</td>
                  <td className="text-[12px] text-[#7a9185]">{d.dispatchedAt ? new Date(d.dispatchedAt).toLocaleDateString('en-GB') : '—'}</td>
                  <td>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(d)}><FileText size={14} /></Button>
                      <Button size="sm" variant="secondary" onClick={() => printDispatch(d)}><Truck size={14} /> Note</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          {filtered.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Truck size={28} /></div><b>No dispatches yet</b><p>Record your first FG dispatch to a customer.</p></div>}
        </div>
      </Card>

      {open && (
        <Modal title="New FM Dispatch" description="Dispatch finished goods with lot traceability." onClose={() => setOpen(false)} wide
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Dispatch</Button></>}
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr]">
            <FormField label="Customer"><Dropdown value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">— Select customer —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Dropdown></FormField>
            <FormField label="Sales Order Ref"><Dropdown value={form.salesOrderId} onChange={(e) => setForm({ ...form, salesOrderId: e.target.value })}><option value="">— Link SO (optional) —</option>{salesOrders.map((so) => <option key={so.id} value={so.id}>{so.number}</option>)}</Dropdown></FormField>
            <FormField label="Vehicle Number"><Input placeholder="DHK-TRK-0001" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} /></FormField>
          </div>
          <div className="[border-top:1px_solid_#e0e5dd] pt-3.5">
            <div className="flex justify-between mb-2.5">
              <strong className="text-[14px]">Dispatch Lines</strong>
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { fgProductId: '', lotId: '', uomId: '', dispatchedQty: '', unitPrice: '' }])}><Plus size={14} /> Add</Button>
            </div>
            {lines.map((line, i) => {
              const avlLots = lots.filter((l) => l.productId === line.fgProductId && l.currentQty > 0);
              return (
                <div key={i} className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr] bg-[#f8faf7] p-3 rounded-[10px] mb-2.5">
                  <FormField label="FG Product"><Dropdown value={line.fgProductId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, fgProductId: e.target.value, lotId: '' } : l))}><option value="">— Select FG —</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Dropdown></FormField>
                  <FormField label="Batch Lot"><Dropdown value={line.lotId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, lotId: e.target.value } : l))}><option value="">— Select lot —</option>{avlLots.map((lt) => <option key={lt.id} value={lt.id}>{lt.lotNumber} ({Number(lt.currentQty).toLocaleString()} avail.)</option>)}</Dropdown></FormField>
                  <FormField label="Qty"><Input type="number" value={line.dispatchedQty} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, dispatchedQty: e.target.value } : l))} /></FormField>
                  <FormField label="Unit Price"><Input type="number" value={line.unitPrice} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, unitPrice: e.target.value } : l))} /></FormField>
                  <FormField label="UOM"><Dropdown value={line.uomId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, uomId: e.target.value } : l))}><option value="">— UOM —</option>{uoms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Dropdown></FormField>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {selected && (
        <Modal title={`Dispatch: ${selected.dispatchNumber}`} description={`Customer: ${selected.customer?.name ?? '—'} · Vehicle: ${selected.vehicleNo ?? '—'}`} onClose={() => setSelected(null)} wide footer={<><Button variant="secondary" onClick={() => printDispatch(selected)}><Truck size={14} /> Print Note</Button><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button></>}>
          <div className="overflow-x-auto">
            <DataTable columns={["FG Product","SKU","Batch Lot","Qty","UOM","Unit Price"]}>{selected.lines.map((l, i) => <tr key={i}><td>{l.fgProduct?.name ?? '—'}</td><td><span className="text-[11px] font-mono text-[#7a9185]">{l.fgProduct?.sku}</span></td><td><span className="font-mono text-[11px] text-[#7a9185]">{l.lot?.lotNumber ?? '—'}</span></td><td><strong>{Number(l.dispatchedQty).toLocaleString()}</strong></td><td>{l.uom?.code ?? '—'}</td><td>{l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td></tr>)}</DataTable>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}


