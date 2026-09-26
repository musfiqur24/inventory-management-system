import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Factory, TrendingUp } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { usePageLoading } from '../../../shared/hooks/usePageLoading';
import { useToastMessage } from '../../../components/ui/Toast';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { TextArea } from '../../../components/ui/TextArea';
import { DataTable } from '../../../components/ui/DataTable';
import { statusBadge } from '../../../components/ui/Badge';

type Product = { id: string; sku: string; name: string; type: string; amount?: number };
type Order = { id: string; number: string; requisitionId?: string; fgProduct?: Product; lines?: { productId: string; product?: Product; requiredQty: number }[] };
type Line = { productId: string; description: string; category: string; quantity: string; unitPrice: string; lotCode?: string; targetQty?: number; expectedQty?: number; wastePercent?: number; locked?: boolean };
type Metrics = { totalCost: number; costPerKg: number; costPerTon: number; revenue: number; profit: number; profitPerTon: number; marginPercent: number; salesPosted: boolean };
type FinishedGood = { orderId: string; orderNumber: string; product?: Product; plannedQty: number; expectedQty: number; wastePercent: number };
type Batch = { id: string; batchNumber: string; requisitionId?: string; requisitionNumber?: string; status: string; plannedQty: number; actualQty: number; actualWastePct: number; completedAt?: string; productionOrder?: Order; productionOrders?: Order[]; finishedGoods: FinishedGood[]; fgProduct?: Product; inputLines: Line[]; outputLines: Line[]; costLines: Line[]; metrics: Metrics };
const blank = (category = 'RAW_MATERIAL'): Line => ({ productId: '', description: '', category, quantity: '', unitPrice: '' });
const money = (value: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(value || 0);

export function ProductionBatchesPage() {
  const [loading, runLoad] = usePageLoading(), [, setMessage] = useToastMessage();
  const [rows, setRows] = useState<Batch[]>([]), [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false), [selected, setSelected] = useState<Batch | null>(null), [editing, setEditing] = useState<Batch | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ productionOrderId: '', startedAt: '', completedAt: '', notes: '', inputs: [blank()], outputs: [blank('OUTPUT')], costs: [blank('OPERATING')] });
  const load = () => runLoad(async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try { const [b, p] = await Promise.all([api<{data: Batch[]}>('/batches'), api<{data: Product[]}>('/products')]); setRows(b.data); setProducts(p.data); }
    catch (error: any) { setMessage(error.message); }
  });
  useEffect(() => { void load(); }, []);
  const totals = useMemo(() => ({ input: form.inputs.reduce((s, x) => s + Number(x.quantity), 0), output: form.outputs.reduce((s, x) => s + Number(x.quantity), 0) }), [form]);
  const reset = () => setForm({ productionOrderId: '', startedAt: '', completedAt: '', notes: '', inputs: [blank()], outputs: [blank('OUTPUT')], costs: [blank('OPERATING')] });
  const setLines = (key: 'inputs' | 'outputs' | 'costs', lines: Line[]) => setForm(current => ({ ...current, [key]: lines }));
  const editBatch = (batch: Batch) => {
    const order = batch.productionOrder;
    if (!order) return;
    setEditing(batch);
    setForm({
      productionOrderId: order.id,
      startedAt: '',
      completedAt: '',
      notes: '',
      inputs: order.lines?.length ? order.lines.map((line: any) => ({ productId: line.productId, description: line.product?.name ?? '', category: 'RAW_MATERIAL', quantity: String(line.requiredQty ?? ''), unitPrice: String(line.unitPrice ?? 0), locked: true })) : [blank()],
      outputs: batch.finishedGoods?.length ? batch.finishedGoods.map((item) => ({ productId: item.product?.id ?? '', description: item.product?.name ?? '', category: 'OUTPUT', quantity: '', unitPrice: String(item.product?.amount ?? ''), lotCode: '', targetQty: item.plannedQty, expectedQty: item.expectedQty, wastePercent: item.wastePercent, locked: true })) : order.fgProduct ? [{ productId: order.fgProduct.id, description: order.fgProduct.name, category: 'OUTPUT', quantity: '', unitPrice: String(order.fgProduct.amount ?? ''), lotCode: '', locked: true }] : [blank('OUTPUT')],
      costs: [blank('OPERATING')],
    });
    setOpen(true);
  };
  const submit = async () => {
    const valid = (line: Line) => Boolean(line.productId && line.description.trim() && Number(line.quantity) >= 0);
    if (!form.productionOrderId || !form.inputs.every(valid) || !form.outputs.every(valid)) return setMessage('Select an order and complete every line.');
    setSaving(true);
    try {
      const normalize = (line: Line) => ({ ...line, productId: line.productId || null, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) || 0 });
      await api(editing ? '/batches/' + editing.id : '/batches', { method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...form, startedAt: form.startedAt || undefined, completedAt: form.completedAt || undefined, inputs: form.inputs.map(normalize), outputs: form.outputs.map(normalize), costs: [] }) });
      setOpen(false); setEditing(null); reset(); setMessage('Finished-good details saved. Batch is Ready for FM Store receipt.'); await load();
    } catch (error: any) { setMessage(error.message); } finally { setSaving(false); }
  };
  const outputEditor = () => <Card className="overflow-hidden p-0">
    <div className="px-4 py-4"><h3 className="text-sm font-bold">Finished material outputs</h3><p className="text-xs text-[#7a9185]">Enter the actual finished quantity and per kg price. Requisition products are locked.</p></div>
    <div className="overflow-x-auto"><div className="min-w-[980px]">
      <div className="grid grid-cols-[2fr_.7fr_.9fr_.9fr_.8fr_.9fr_42px] items-center gap-2 bg-[#f2f5f3] px-4 py-2 text-[10px] font-bold uppercase text-[#53665c]"><span>FM product</span><span className="px-2">Target</span><span className="px-2">Expected (waste applied)</span><span>Ready Received FM</span><span>Per kg price</span><span className="px-2 text-right">Total price</span><span/></div>
      {form.outputs.map((line, index) => <div key={index} className="grid grid-cols-[2fr_.7fr_.9fr_.9fr_.8fr_.9fr_42px] items-center gap-2 border-t border-[#e0e5dd] px-4 py-2">
        <Dropdown value={line.productId} disabled={line.locked} onChange={e => { const product = products.find(p => p.id === e.target.value); const next = [...form.outputs]; next[index] = { ...line, productId: e.target.value, description: product?.name ?? '', unitPrice: String(product?.amount ?? '') }; setLines('outputs', next); }}><option value="">Select product</option>{products.filter(p => p.type === 'FINISHED_GOOD' || p.type === 'BY_PRODUCT').map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}</Dropdown>
        <span className="px-2 text-sm font-semibold">{line.targetQty == null ? '-' : Number(line.targetQty).toLocaleString() + ' kg'}</span>
        <span className="whitespace-nowrap px-2 text-sm font-semibold text-[#1b7250]">{line.expectedQty == null ? '-' : <>{Number(line.expectedQty).toLocaleString()} kg <small className="font-normal text-[#7a9185]">({line.wastePercent}% waste)</small></>}</span>
        <Input type="number" min="0" step="0.001" value={line.quantity} placeholder="Actual kg" onChange={e => { const next = [...form.outputs]; next[index] = { ...line, quantity: e.target.value }; setLines('outputs', next); }}/>
        <Input type="number" min="0" step="0.01" value={line.unitPrice} placeholder="Price / kg" onChange={e => { const next = [...form.outputs]; next[index] = { ...line, unitPrice: e.target.value }; setLines('outputs', next); }}/>
        <strong className="px-2 text-right text-sm">{money(Number(line.quantity) * Number(line.unitPrice))}</strong>
        <button type="button" aria-label="Remove finished material" className="grid size-10 place-items-center text-red-600 disabled:cursor-not-allowed disabled:opacity-25" disabled={line.locked} onClick={() => setLines('outputs', form.outputs.filter((_, i) => i !== index))}><Trash2 size={16}/></button>
      </div>)}
      <div className="grid grid-cols-[2fr_.7fr_.9fr_.9fr_.8fr_.9fr_42px] gap-2 border-t border-[#e0e5dd] p-3"><Button type="button" className="col-span-4 w-full justify-center" variant="secondary" onClick={() => setLines('outputs', [...form.outputs, { ...blank('OUTPUT'), locked: false }])}><Plus size={14}/> Add Finished Material</Button></div>
    </div></div>
  </Card>;
  const inputEditor = () => <Card className="overflow-hidden p-0">
    <div className="px-4 py-4"><h3 className="text-sm font-bold">Raw materials and utilities used</h3><p className="text-xs text-[#7a9185]">Quantities and prices come from the linked requisition and procurement records.</p></div>
    <div className="overflow-x-auto"><div className="min-w-[720px]">
      <div className="grid grid-cols-[2fr_.8fr_.8fr_1fr] gap-3 bg-[#f2f5f3] px-4 py-2 text-[10px] font-bold uppercase text-[#53665c]"><span>Raw material</span><span>Total kg</span><span>Per kg price</span><span className="text-right">Total price</span></div>
      {form.inputs.map((line, index) => <div key={index} className="grid grid-cols-[2fr_.8fr_.8fr_1fr] items-center gap-3 border-t border-[#e0e5dd] px-4 py-3"><strong className="text-sm text-[#243b30]">{line.description}</strong><span>{Number(line.quantity).toLocaleString()} kg</span><span>{money(Number(line.unitPrice))}</span><strong className="text-right">{money(Number(line.quantity) * Number(line.unitPrice))}</strong></div>)}
    </div></div>
  </Card>;
  const totalProfit = rows.reduce((sum, row) => sum + row.metrics.profit, 0);
  return <PageContainer loading={loading} cap="PRODUCTION & COSTING" title="Register FM" description="Production lots are created automatically when RM is dispatched. Complete FG details to make them Ready for FM Store.">
    <div className="summary-grid mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {[['Production lots', rows.length], ['Total output', `${rows.reduce((s, r) => s + Number(r.actualQty), 0).toLocaleString()} kg`], ['Total batch cost', money(rows.reduce((s, r) => s + r.metrics.totalCost, 0))], ['Realised profit', money(totalProfit)]].map(([label, value]) => <Card key={String(label)} className="p-5"><div className="text-xs font-semibold uppercase tracking-wide text-[#7a9185]">{label}</div><div className="mt-2 text-xl font-bold text-[#0f1c16]">{value}</div></Card>)}
    </div>
    <Card className="p-0"><div className="flex items-center justify-between border-b border-[#e0e5dd] p-5"><div><h2 className="font-bold">Batch costing register</h2><p className="text-xs text-[#7a9185]">Profit uses the latest weighted sales rate when sales exist; entered output rate is the fallback estimate.</p></div><TrendingUp size={20} className="text-[#1b8f5a]"/></div>
      <div className="overflow-x-auto"><DataTable columns={['Batch / requisition','FM products','Target','Output','Total cost','Revenue','Status','']} empty={rows.length === 0 && <div className="grid place-items-center gap-2 p-12 text-center text-[#7a9185]"><Factory size={30}/><b className="text-[#0f1c16]">No batches recorded</b></div>}>
        {rows.map(row => { const isOpen = expanded.has(row.id); return <Fragment key={row.id}><tr><td><div className="flex items-start gap-2"><button type="button" className="mt-0.5" onClick={() => setExpanded(current => { const next = new Set(current); next.has(row.id) ? next.delete(row.id) : next.add(row.id); return next; })}>{isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</button><div><strong className="font-mono text-[#0d3b2e]">{row.batchNumber}</strong><div className="text-xs text-[#7a9185]">{row.requisitionNumber ?? '-'}</div></div></div></td><td>{row.finishedGoods?.length ?? 0} finished goods</td><td>{Number(row.plannedQty).toLocaleString()} kg</td><td>{Number(row.actualQty).toLocaleString()} kg</td><td>{money(row.metrics.totalCost)}</td><td>{money(row.metrics.revenue)}</td><td>{statusBadge(row.status)}</td><td>{row.status === 'IN_PRODUCTION' ? <Button variant="primary" onClick={() => editBatch(row)}>Update FG Details</Button> : <Button variant="secondary" onClick={() => setSelected(row)}>Details</Button>}</td></tr>{isOpen && <tr><td colSpan={8} className="bg-[#f8faf7] p-3"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{row.finishedGoods?.map((item, index) => { const output = row.outputLines.find(line => line.productId === item.product?.id); return <div key={item.orderId} className="rounded-lg border border-[#dfe7df] bg-white p-3"><div className="text-[10px] font-bold uppercase text-[#7a9185]">FM Product {String(index + 1).padStart(2, '0')}</div><strong className="text-sm text-[#173b30]">{item.product?.name ?? 'Finished good'}</strong><div className="mt-1 text-xs text-[#708279]">Target {item.plannedQty.toLocaleString()} kg - Output {Number(output?.quantity ?? 0).toLocaleString()} kg - Waste {item.wastePercent}%</div></div>})}</div></td></tr>}</Fragment>})}
      </DataTable></div>
    </Card>

    {open && <Modal extraWide fixedHeight title={editing ? 'Update FG Details - ' + editing.batchNumber : 'Record production batch'} description={editing ? 'Production requisition: ' + (editing.requisitionNumber ?? '-') : 'Complete the finished-good production details.'} onClose={() => { setOpen(false); setEditing(null); }} footer={<><Button variant="secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button><Button variant="primary" disabled={saving || !form.productionOrderId} onClick={() => void submit()}>{saving ? 'Saving…' : 'Complete batch'}</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 max-[850px]:grid-cols-1">
          <FormField label="FM requisition" required><Input value={editing?.requisitionNumber ?? ''} readOnly placeholder="Linked requisition number"/></FormField>
          <FormField label="Started at"><Input type="datetime-local" value={form.startedAt} onChange={e => setForm({...form, startedAt: e.target.value})}/></FormField>
          <FormField label="Completed at"><Input type="datetime-local" value={form.completedAt} onChange={e => setForm({...form, completedAt: e.target.value})}/></FormField>
        </div>
        {outputEditor()}
        {inputEditor()}
        <Card className="grid grid-cols-3 gap-3 bg-[#f8faf7] p-4 max-[700px]:grid-cols-1"><div><span className="text-xs text-[#7a9185]">Total input quantity</span><b className="block">{totals.input.toLocaleString()}</b></div><div><span className="text-xs text-[#7a9185]">Total FM output quantity</span><b className="block">{totals.output.toLocaleString()}</b></div><div><span className="text-xs text-[#7a9185]">Difference / loss</span><b className="block">{Math.max(0, totals.input - totals.output).toLocaleString()}</b></div></Card>
        <FormField label="Production notes"><TextArea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Shift, machine, quality observations or approval note"/></FormField>
      </div>
    </Modal>}

    {selected && <Modal title={selected.batchNumber} description={`${selected.fgProduct?.name ?? 'Production batch'} - ${selected.completedAt ? new Date(selected.completedAt).toLocaleDateString('en-GB') : ''}`} onClose={() => setSelected(null)} footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
      <div className="summary-grid grid grid-cols-2 gap-3 sm:grid-cols-3"><Card className="p-4"><span className="text-xs text-[#7a9185]">Total cost</span><b className="block text-lg">{money(selected.metrics.totalCost)}</b></Card><Card className="p-4"><span className="text-xs text-[#7a9185]">Revenue</span><b className="block text-lg">{money(selected.metrics.revenue)}</b></Card><Card className="p-4"><span className="text-xs text-[#7a9185]">Profit</span><b className={`block text-lg ${selected.metrics.profit < 0 ? 'text-red-600' : 'text-[#1b8f5a]'}`}>{money(selected.metrics.profit)}</b></Card></div>
      {[['Consumed materials', selected.inputLines], ['Finished outputs', selected.outputLines], ['Other costs', selected.costLines]].map(([title, lines]) => <div className="mt-4" key={title as string}><h3 className="mb-2 text-sm font-bold">{title as string}</h3><div className="rounded-lg border border-[#e0e5dd]">{(lines as Line[]).map((line, i) => <div key={i} className="grid grid-cols-1 gap-2 border-b sm:grid-cols-[1fr_auto_auto] sm:gap-4 border-[#edf0eb] p-3 last:border-0"><span>{line.description}</span><span>{Number(line.quantity).toLocaleString()} × {money(Number(line.unitPrice))}</span><b>{money(Number(line.quantity) * Number(line.unitPrice))}</b></div>)}</div></div>)}
    </Modal>}
  </PageContainer>;
}
