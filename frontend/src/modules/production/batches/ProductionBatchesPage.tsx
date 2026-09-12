import { DataTable } from "../../../components/ui/DataTable";
import { useToastMessage } from "../../../components/ui/Toast";
import { twMerge } from 'tailwind-merge';
import { useEffect, useState } from 'react';
import { Plus, Factory, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
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
  const [, setMessage] = useToastMessage();
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
   >

      <div className="grid grid-cols-[repeat(4,_1fr)] gap-4 mb-5 max-[900px]:grid-cols-[repeat(2,_1fr)] max-[480px]:grid-cols-[1fr]">
        {[
          { label: 'Total', v: rows.length, c: 'brand' },
          { label: 'Active', v: rows.filter((r) => r.status === 'SUBMITTED' || r.status === 'DRAFT').length, c: 'blue' },
          { label: 'Completed', v: rows.filter((r) => r.status === 'CLOSED').length, c: 'green' },
          { label: 'Waste Issues', v: rows.filter((r) => r.variancePct != null && Math.abs(r.variancePct) > 1).length, c: 'red' },
        ].map((s) => (
          <Card className="flex items-start gap-3.5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md p-[14px_16px]" key={s.label}>
            <div className="min-w-0"><div className="[font-family:'Outfit',_sans-serif] text-[22px] font-bold text-[#0f1c16] leading-[1] mb-1">{s.v}</div><div className="text-[12px] text-[#7a9185] font-medium">{s.label} Batches</div></div>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0"><h2>Batch Register</h2></div>
        <div className="overflow-x-auto">
          <DataTable columns={["Batch #","Production Order","FG Product","Planned Qty","Actual Qty","Planned Waste%","Actual Waste%","Variance","Status","Completed"]} empty={rows.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Factory size={28} /></div><b>No batches yet</b><p>Start a factory batch linked to a production order.</p></div>}>
              {rows.map((b) => {
                const isWarn = b.variancePct != null && Math.abs(b.variancePct) > 1;
                return (
                  <tr key={b.id}>
                    <td><strong className="font-mono text-[#0d3b2e]">{b.batchNumber}</strong></td>
                    <td><span className="text-[11px] text-[#7a9185]">{b.productionOrder?.number ?? '—'}</span></td>
                    <td>{b.fgProduct?.name ?? '—'}<br /><span className="text-[11px] text-[#7a9185] font-mono">{b.fgProduct?.sku}</span></td>
                    <td>{Number(b.plannedQty).toLocaleString()}</td>
                    <td>{b.actualQty != null ? <strong>{Number(b.actualQty).toLocaleString()}</strong> : <span className="text-[#7a9185]">—</span>}</td>
                    <td>{b.plannedWastePct != null ? `${Number(b.plannedWastePct).toFixed(2)}%` : '—'}</td>
                    <td>{b.actualWastePct != null ? `${Number(b.actualWastePct).toFixed(2)}%` : '—'}</td>
                    <td>
                      {b.variancePct != null ? (
                        <span className={twMerge("font-bold flex items-center gap-1", (isWarn ? "text-[#c03030]" : "text-[#1b8f5a]"))}>
                          {isWarn ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                          {b.variancePct >= 0 ? '+' : ''}{Number(b.variancePct).toFixed(2)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td>{statusBadge(b.status)}</td>
                    <td className="text-[12px] text-[#7a9185]">{b.completedAt ? new Date(b.completedAt).toLocaleDateString('en-GB') : '—'}</td>
                  </tr>
                );
              })}
            </DataTable>
          
        </div>
      </Card>

      {open && (
        <Modal title="Start Factory Batch" description="Link to a production order and set planned quantities." onClose={() => setOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!form.plannedQty}>Start Batch</Button></>}
       >
          <FormField label="Linked Production Order">
            <Dropdown value={form.productionOrderId} onChange={(e) => setForm({ ...form, productionOrderId: e.target.value })}>
              <option value="">— Select order —</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.number} {o.fgProduct?.name ? `· ${o.fgProduct.name}` : ''}</option>)}
            </Dropdown>
          </FormField>
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr]">
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


