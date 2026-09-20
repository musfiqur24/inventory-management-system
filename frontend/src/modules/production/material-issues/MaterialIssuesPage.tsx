import { usePageLoading } from "../../../shared/hooks/usePageLoading";
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
import { Dropdown } from '../../../components/ui/Dropdown';
import { statusBadge } from '../../../components/ui/Badge';

interface MaterialIssue {
  id: string; issueNumber: string; status: string; issuedAt: string;
  productionOrder?: { number: string } | null;
  issuedBy?: string;
  lines: Array<{ id: string; rawMaterial?: { name: string; sku: string }; lot?: { lotNumber: string }; uom?: { code: string }; issuedQty: number; }>;
}
interface ProductionOrder { id: string; number: string; status: string; lines: Array<{ productId: string; uomId: string; requiredQty: number; issuedQty: number; rawMaterial?: { name: string; sku: string } }>; }
interface Product { id: string; name: string; sku: string; type: string; }
interface Lot { id: string; lotNumber: string; productId: string; currentQty: number; }
interface Position { id: string; productId: string; lotId: string; binId: string; uomId: string; quantity: number; reservedQty: number; lot?: { code?: string; qualityStatus?: string; expiryDate?: string | null }; bin: {code:string;name:string;storeId?:string;store?:{id:string;name:string}}; }
interface UOM { id: string; name: string; code: string; }
interface Store { id: string; code: string; name: string; }
interface IssueLine { rawMaterialId: string; lotId: string; fromBinId: string; uomId: string; issuedQty: string; }
interface AllocationShortfall { name: string; quantity: number; uomId: string; }

export function MaterialIssuesPage() {
  const [pageLoading, runPageLoad] = usePageLoading();
  const [positions,setPositions]=useState<Position[]>([]);
  const [saving,setSaving]=useState(false);
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const [rows, setRows] = useState<MaterialIssue[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [open, setOpen] = useState(false);
  const [, setMessage] = useToastMessage();
  const [form, setForm] = useState({ productionOrderId: '', storeId: '' });
  const [lines, setLines] = useState<IssueLine[]>([]);
  const [allocationShortfalls, setAllocationShortfalls] = useState<AllocationShortfall[]>([]);
  const [preferredPositions, setPreferredPositions] = useState<Record<string, string>>({});

  const load = async () => { return runPageLoad(async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [mi, po, p, lt, u, s] = await Promise.all([
        api<{ data: MaterialIssue[] }>('/material-issues'),
        api<{ data: ProductionOrder[] }>('/production-orders'),
        api<{ data: Product[] }>('/products'),
        api<{ data: Lot[] }>('/rm-store/lots'),
        api<{ data: UOM[] }>('/uoms'),
        api<{ data: Store[] }>('/stores?type=RM_STORE'),
      ]);
      setRows(mi.data); setOrders(po.data);
      setProducts(p.data.filter((x) => x.type === 'RAW_MATERIAL'));
      setLots(lt.data); setUoms(u.data); setStores(s.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  });};

  useEffect(() => { void load(); }, []);
  useEffect(()=>{if(open)void api<{data:Position[]}>('/rm-store/balances').then(r=>setPositions(r.data)).catch(e=>setMessage(e.message));},[open]);

  const allocateOrder = (productionOrderId: string, storeId: string, preferred = preferredPositions) => {
    if (!productionOrderId || !storeId) { setLines([]); setAllocationShortfalls([]); return; }
    const order = orders.find((item) => item.id === productionOrderId);
    if (!order) return;
    const availableByPosition = new Map(positions.map((position) => [position.id, Math.max(0, Number(position.quantity) - Number(position.reservedQty))]));
    const generated: IssueLine[] = [];
    const shortfalls: AllocationShortfall[] = [];
    for (const requirement of order.lines ?? []) {
      let remaining = Math.max(0, Number(requirement.requiredQty) - Number(requirement.issuedQty));
      if (remaining <= 0) continue;
      const candidates = positions.filter((position) => {
        const selectedStore = (position.bin.storeId ?? position.bin.store?.id) === storeId;
        const released = !position.lot?.qualityStatus || position.lot.qualityStatus === 'RELEASED';
        const unexpired = !position.lot?.expiryDate || new Date(position.lot.expiryDate).getTime() >= Date.now();
        return selectedStore && position.productId === requirement.productId && position.uomId === requirement.uomId && released && unexpired && (availableByPosition.get(position.id) ?? 0) > 0;
      }).sort((a, b) => {
        const preference = preferred[requirement.productId + ':' + requirement.uomId];
        if (a.id === preference && b.id !== preference) return -1;
        if (b.id === preference && a.id !== preference) return 1;
        const first = a.lot?.expiryDate ? new Date(a.lot.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        const second = b.lot?.expiryDate ? new Date(b.lot.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        return first - second;
      });
      for (const position of candidates) {
        if (remaining <= 0.000001) break;
        const available = availableByPosition.get(position.id) ?? 0;
        const allocated = Math.min(remaining, available);
        if (allocated <= 0) continue;
        generated.push({ rawMaterialId: requirement.productId, lotId: position.lotId, fromBinId: position.binId, uomId: requirement.uomId, issuedQty: String(Number(allocated.toFixed(6))) });
        availableByPosition.set(position.id, available - allocated);
        remaining -= allocated;
      }
      if (remaining > 0.000001) shortfalls.push({ name: requirement.rawMaterial?.name ?? products.find((p) => p.id === requirement.productId)?.name ?? 'Raw material', quantity: Number(remaining.toFixed(6)), uomId: requirement.uomId });
    }
    setLines(generated);
    setAllocationShortfalls(shortfalls);
  };

  useEffect(() => {
    if (open && form.productionOrderId && form.storeId) allocateOrder(form.productionOrderId, form.storeId);
  }, [open, form.productionOrderId, form.storeId, positions]);

  const submit = async () => {
    if(saving)return;
    if (!form.productionOrderId || !form.storeId) return setMessage('Select a production order and RM store first.');
    if (allocationShortfalls.length) return setMessage('The selected store does not have enough released stock to satisfy this production order.');
    if (!lines.length || lines.some((line) => !line.rawMaterialId || !line.lotId || !line.fromBinId || !line.uomId || Number(line.issuedQty) <= 0)) return setMessage('Review the allocation and complete every issue line.');
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
      setOpen(false); setForm({ productionOrderId: '', storeId: '' });
      setLines([]); setAllocationShortfalls([]); void load();
    } catch (e: any) { setMessage(e.message); } finally { setSaving(false); }
  };


  const selectedOrder = orders.find((order) => order.id === form.productionOrderId);
  const allocationReview = (() => {
    const grouped = new Map<string, { productId: string; uomId: string; name: string; sku: string; required: number; allocated: number; sources: string[] }>();
    for (const requirement of selectedOrder?.lines ?? []) {
      const key = requirement.productId + ':' + requirement.uomId;
      const product = products.find((item) => item.id === requirement.productId);
      const current = grouped.get(key) ?? {
        productId: requirement.productId,
        uomId: requirement.uomId,
        name: requirement.rawMaterial?.name ?? product?.name ?? 'Raw material',
        sku: requirement.rawMaterial?.sku ?? product?.sku ?? '',
        required: 0,
        allocated: 0,
        sources: [],
      };
      current.required += Math.max(0, Number(requirement.requiredQty) - Number(requirement.issuedQty));
      grouped.set(key, current);
    }
    for (const line of lines) {
      const key = line.rawMaterialId + ':' + line.uomId;
      const current = grouped.get(key);
      if (!current) continue;
      current.allocated += Number(line.issuedQty) || 0;
      const position = positions.find((item) => item.binId === line.fromBinId && item.lotId === line.lotId && item.productId === line.rawMaterialId);
      const source = (position?.lot?.code ?? lots.find((lot) => lot.id === line.lotId)?.lotNumber ?? 'Lot') + ' / ' + (position?.bin.code ?? 'Bin') + ' - ' + Number(line.issuedQty).toLocaleString();
      current.sources.push(source);
    }
    return [...grouped.values()].map((item) => ({ ...item, insufficient: Math.max(0, item.required - item.allocated), uom: uoms.find((uom) => uom.id === item.uomId)?.code ?? '' }));
  })();

  return (
    <PageContainer loading={pageLoading}
      cap="PRODUCTION"
      title="Issue RM to Factory"
      description="Issue raw materials from RM store to the production floor."
      actions={<Button variant="primary" onClick={() => {setRequestId(crypto.randomUUID());setForm({ productionOrderId: '', storeId: '' });setLines([]);setAllocationShortfalls([]);setPreferredPositions({});setOpen(true);}}><Plus size={16} /> Issue Materials</Button>}
   >

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0"><h2>Material Issue Register</h2><span className="text-[12px] text-[#7a9185]">{rows.length} issues</span></div>
        <div className="overflow-x-auto">
          <DataTable columns={["Issue #","Production Order","Lines","Status","Issued At"]} empty={rows.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><ArrowLeftRight size={28} /></div><b>No issues yet</b></div>}>
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
        <Modal title="Issue RM Materials to Factory" description="Select a production order and RM store, then review the automatically allocated stock." onClose={() => setOpen(false)} extraWide fixedHeight
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit} disabled={saving || !lines.length || allocationShortfalls.length > 0}>Confirm Issue</Button></>}
       >
          <div className="grid grid-cols-2 gap-3.5 max-[700px]:grid-cols-1">
            <FormField label="Production Order" required><Dropdown value={form.productionOrderId} onChange={(e) => setForm((current) => ({ ...current, productionOrderId: e.target.value }))}><option value="">Select order</option>{orders.filter((o) => !['CANCELLED','REJECTED','CLOSED'].includes(o.status)).map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}</Dropdown></FormField>
            <FormField label="RM Store" required><Dropdown value={form.storeId} onChange={(e) => setForm((current) => ({ ...current, storeId: e.target.value }))}><option value="">Select RM store</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.code} - {store.name}</option>)}</Dropdown></FormField>
          </div>

          <div className="[border-top:1px_solid_#e0e5dd] pt-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div><strong className="text-[14px]">Material Allocation Review</strong><div className="mt-0.5 text-[12px] text-[#7a9185]">Available stock is allocated by earliest expiry. Stock is deducted only after confirmation.</div></div>
              {form.productionOrderId && form.storeId && <Button size="sm" variant="secondary" onClick={() => allocateOrder(form.productionOrderId, form.storeId)}>Recalculate</Button>}
            </div>
            {!form.productionOrderId || !form.storeId ? (
              <div className="rounded-md border border-[#dce5dc] bg-[#f8faf7] px-4 py-8 text-center text-[13px] text-[#7a9185]">Select a production order and RM store to review every required material.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-[#d7dfd6]">
                <div className="min-w-[920px]">
                  <div className="grid grid-cols-[minmax(190px,1.35fr)_110px_110px_125px_minmax(250px,1.8fr)_105px] items-center gap-3 bg-[#f2f5f3] px-4 py-3 text-[11px] font-bold uppercase tracking-[.06em] text-[#405047]">
                    <span>Raw material</span><span>Required</span><span>Allocated</span><span>Insufficient</span><span>Bin Allocation</span><span>Status</span>
                  </div>
                  {allocationReview.map((item) => {
                    const shortage = item.insufficient > 0.000001;
                    const eligiblePositions = positions.filter((position) => {
                      const selectedStore = (position.bin.storeId ?? position.bin.store?.id) === form.storeId;
                      const released = !position.lot?.qualityStatus || position.lot.qualityStatus === 'RELEASED';
                      const unexpired = !position.lot?.expiryDate || new Date(position.lot.expiryDate).getTime() >= Date.now();
                      return selectedStore && position.productId === item.productId && position.uomId === item.uomId && released && unexpired && Number(position.quantity) - Number(position.reservedQty) > 0;
                    }).sort((a, b) => a.bin.code.localeCompare(b.bin.code));
                    const firstAllocation = lines.find((line) => line.rawMaterialId === item.productId && line.uomId === item.uomId);
                    const selectedPosition = eligiblePositions.find((position) => position.binId === firstAllocation?.fromBinId && position.lotId === firstAllocation?.lotId);
                    return <div key={item.productId + item.uomId} className="grid grid-cols-[minmax(190px,1.35fr)_110px_110px_125px_minmax(250px,1.8fr)_105px] items-center gap-3 border-t border-[#e0e5dd] px-4 py-3 text-[13px]">
                      <div className="min-w-0"><strong className="block truncate text-[#173b30]">{item.name}</strong>{item.sku && <span className="block truncate text-[11px] text-[#7a9185]">{item.sku}</span>}</div>
                      <strong>{item.required.toLocaleString()} {item.uom}</strong>
                      <span className={item.allocated > 0 ? 'font-semibold text-[#176b4b]' : 'font-semibold text-[#9a3b32]'}>{item.allocated.toLocaleString()} {item.uom}</span>
                      <strong className={shortage ? 'text-[#c34838]' : 'text-[#176b4b]'}>{shortage ? item.insufficient.toLocaleString() + ' ' + item.uom : '0 ' + item.uom}</strong>
                      <div className="min-w-0"><Dropdown aria-label={"Allocation bin for " + item.name} value={preferredPositions[item.productId + ":" + item.uomId] ?? selectedPosition?.id ?? ""} disabled={!eligiblePositions.length} onChange={(event) => { const next = { ...preferredPositions, [item.productId + ":" + item.uomId]: event.target.value }; setPreferredPositions(next); allocateOrder(form.productionOrderId, form.storeId, next); }}><option value="">{eligiblePositions.length ? "Select allocation bin" : "Not available in selected store"}</option>{eligiblePositions.map((position) => <option key={position.id} value={position.id}>{position.bin.name || position.bin.code}</option>)}</Dropdown>{item.sources.length > 1 && <span className="mt-1 block text-[10.5px] text-[#7a9185]">Allocation continues across {item.sources.length} bins when required.</span>}</div>
                      <span className={shortage ? 'w-fit rounded-full bg-[#fde8e5] px-2.5 py-1 text-[11px] font-semibold text-[#b23b31]' : 'w-fit rounded-full bg-[#e5f5eb] px-2.5 py-1 text-[11px] font-semibold text-[#16734f]'}>{shortage ? (item.allocated > 0 ? 'Insufficient' : 'No stock') : 'Ready'}</span>
                    </div>;
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
