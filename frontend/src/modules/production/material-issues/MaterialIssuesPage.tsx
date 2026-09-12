import { DataTable } from "../../../components/ui/DataTable";
import { useToastMessage } from "../../../components/ui/Toast";
import { useEffect, useState } from 'react';
import { Plus, ArrowLeftRight } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
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
interface Position { id: string; productId: string; lotId: string; binId: string; uomId: string; quantity: number; reservedQty: number; bin: {code:string;store?:{name:string}}; }
interface UOM { id: string; name: string; code: string; }

export function MaterialIssuesPage() {
  const [positions,setPositions]=useState<Position[]>([]);
  const [saving,setSaving]=useState(false);
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const [rows, setRows] = useState<MaterialIssue[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [open, setOpen] = useState(false);
  const [, setMessage] = useToastMessage();
  const [form, setForm] = useState({ productionOrderId: '' });
  const [lines, setLines] = useState([{ rawMaterialId: '', lotId: '', fromBinId: '', uomId: '', issuedQty: '' }]);

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
  useEffect(()=>{if(open)void api<{data:Position[]}>('/rm-store/balances').then(r=>setPositions(r.data)).catch(e=>setMessage(e.message));},[open]);

  const submit = async () => {
    if(saving)return;
    setSaving(true);
    try {
      const validLines = lines.filter((l) => l.rawMaterialId && l.uomId && l.issuedQty);
      await api('/material-issues', {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          productionOrderId: form.productionOrderId || undefined,
          lines: validLines.map((l) => ({
            productId: l.rawMaterialId,
            lotId: l.lotId || undefined,
            fromBinId: l.fromBinId,
            uomId: l.uomId,
            quantity: Number(l.issuedQty),
          })),
        }),
      });
      setOpen(false); setForm({ productionOrderId: '' });
      setLines([{ rawMaterialId: '', lotId: '', fromBinId: '', uomId: '', issuedQty: '' }]); void load();
    } catch (e: any) { setMessage(e.message); } finally { setSaving(false); }
  };

  return (
    <PageContainer
      cap="PRODUCTION"
      title="Issue RM to Factory"
      description="Issue raw materials from RM store to the production floor. Deducts from lot balances and links to production orders."
      actions={<Button variant="primary" onClick={() => {setRequestId(crypto.randomUUID());setOpen(true);}}><Plus size={16} /> Issue Materials</Button>}
   >

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0"><h2>Material Issue Register</h2><span className="text-[12px] text-[#7a9185]">{rows.length} issues</span></div>
        <div className="overflow-x-auto">
          <DataTable columns={["Issue #","Production Order","Lines","Status","Issued At"]} empty={rows.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><ArrowLeftRight size={28} /></div><b>No issues yet</b><p>Issue raw materials to the factory floor to start production.</p></div>}>
              {rows.map((mi) => (
                <tr key={mi.id}>
                  <td><strong className="text-[#0d3b2e] font-mono">{mi.issueNumber}</strong></td>
                  <td>{mi.productionOrder?.number ?? <span className="text-[#7a9185]">Direct issue</span>}</td>
                  <td>{mi.lines.length} materials</td>
                  <td>{statusBadge(mi.status)}</td>
                  <td className="text-[12px] text-[#7a9185]">{new Date(mi.issuedAt).toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </DataTable>
          
        </div>
      </Card>

      {open && (
        <Modal title="Issue RM Materials to Factory" description="Select materials from RM lots. Stock will be deducted immediately on save." onClose={() => setOpen(false)} wide
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={saving}>Confirm Issue</Button></>}
       >
          <FormField label="Linked Production Order">
            <Dropdown value={form.productionOrderId} onChange={(e) => setForm({ productionOrderId: e.target.value })}>
              <option value="">— Select order —</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
            </Dropdown>
          </FormField>

          <Notice variant="warn">Stock will be deducted from the selected lot immediately. Ensure lot availability before issuing.</Notice>

          <div className="[border-top:1px_solid_#e0e5dd] pt-3.5">
            <div className="flex justify-between mb-2.5">
              <strong className="text-[14px]">Material Lines</strong>
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { rawMaterialId: '', lotId: '', fromBinId: '', uomId: '', issuedQty: '' }])}>
                <Plus size={14} /> Add Line
              </Button>
            </div>
            {lines.map((line, i) => {
              const availableLots = lots.filter((l) => l.productId === line.rawMaterialId && l.currentQty > 0);
              return (
                <div key={i} className="bg-[#f8faf7] rounded-[10px] p-3 mb-2.5 grid gap-2.5">
                  <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr]">
                    <FormField label="Raw Material">
                      <Dropdown value={line.rawMaterialId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, rawMaterialId: e.target.value, lotId: '' } : l))}>
                        <option value="">— Select RM —</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </Dropdown>
                    </FormField>
                    <FormField label="Lot (for traceability)">
                      <Dropdown value={line.lotId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, lotId: e.target.value, fromBinId: '' } : l))}>
                        <option value="">— Select lot —</option>
                        {availableLots.map((lt) => <option key={lt.id} value={lt.id}>{lt.lotNumber} ({Number(lt.currentQty).toLocaleString()} avail.)</option>)}
                      </Dropdown>
                    </FormField>
                    <FormField label="Store / Bin" required><Dropdown value={line.fromBinId} onChange={e=>setLines(lines.map((l,li)=>li===i?{...l,fromBinId:e.target.value}:l))}><option value="">Select store bin</option>{positions.filter(p=>p.productId===line.rawMaterialId&&p.lotId===line.lotId&&Number(p.quantity)>Number(p.reservedQty)).map(p=><option key={p.id} value={p.binId}>{p.bin.store?.name} / {p.bin.code} ({Number(p.quantity)-Number(p.reservedQty)} available)</option>)}</Dropdown></FormField>
                    <FormField label="Qty to Issue">
                      <Input type="number" placeholder="Quantity" value={line.issuedQty} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, issuedQty: e.target.value } : l))} />
                    </FormField>
                    <FormField label="UOM">
                      <Dropdown value={line.uomId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, uomId: e.target.value } : l))}>
                        <option value="">— UOM —</option>
                        {uoms.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                      </Dropdown>
                    </FormField>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}

