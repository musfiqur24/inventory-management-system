import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Factory, TrendingUp } from 'lucide-react';
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

type Product = { id: string; sku: string; name: string; type: string };
type Order = { id: string; number: string; fgProduct?: Product; lines?: { productId: string; product?: Product; requiredQty: number }[] };
type Line = { productId: string; description: string; category: string; quantity: string; unitPrice: string; lotCode?: string };
type Metrics = { totalCost: number; costPerKg: number; costPerTon: number; revenue: number; profit: number; profitPerTon: number; marginPercent: number; salesPosted: boolean };
type Batch = { id: string; batchNumber: string; status: string; actualQty: number; actualWastePct: number; completedAt?: string; productionOrder?: Order; fgProduct?: Product; inputLines: Line[]; outputLines: Line[]; costLines: Line[]; metrics: Metrics };
const blank = (category = 'RAW_MATERIAL'): Line => ({ productId: '', description: '', category, quantity: '', unitPrice: '' });
const money = (value: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(value || 0);

export function ProductionBatchesPage() {
  const [loading, runLoad] = usePageLoading(), [, setMessage] = useToastMessage();
  const [rows, setRows] = useState<Batch[]>([]), [orders, setOrders] = useState<Order[]>([]), [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false), [selected, setSelected] = useState<Batch | null>(null);
  const [form, setForm] = useState({ productionOrderId: '', startedAt: '', completedAt: '', notes: '', inputs: [blank()], outputs: [blank('OUTPUT')], costs: [blank('OPERATING')] });
  const load = () => runLoad(async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try { const [b, o, p] = await Promise.all([api<{data: Batch[]}>('/batches'), api<{data: Order[]}>('/production-orders'), api<{data: Product[]}>('/products')]); setRows(b.data); setOrders(o.data); setProducts(p.data); }
    catch (error: any) { setMessage(error.message); }
  });
  useEffect(() => { void load(); }, []);
  const totals = useMemo(() => ({ input: form.inputs.reduce((s, x) => s + Number(x.quantity), 0), output: form.outputs.reduce((s, x) => s + Number(x.quantity), 0) }), [form]);
  const reset = () => setForm({ productionOrderId: '', startedAt: '', completedAt: '', notes: '', inputs: [blank()], outputs: [blank('OUTPUT')], costs: [blank('OPERATING')] });
  const setLines = (key: 'inputs' | 'outputs' | 'costs', lines: Line[]) => setForm(current => ({ ...current, [key]: lines }));
  const chooseOrder = (id: string) => {
    const order = orders.find(value => value.id === id);
    setForm(current => ({ ...current, productionOrderId: id,
      inputs: order?.lines?.length ? order.lines.map(line => ({ productId: line.productId, description: line.product?.name ?? '', category: 'RAW_MATERIAL', quantity: String(line.requiredQty ?? ''), unitPrice: '' })) : current.inputs,
      outputs: order?.fgProduct ? [{ productId: order.fgProduct.id, description: order.fgProduct.name, category: 'OUTPUT', quantity: '', unitPrice: '' }] : current.outputs,
    }));
  };
  const submit = async () => {
    const valid = (line: Line) => Boolean(line.productId && line.description.trim() && Number(line.quantity) >= 0);
    if (!form.productionOrderId || !form.inputs.every(valid) || !form.outputs.every(valid)) return setMessage('Select an order and complete every line.');
    setSaving(true);
    try {
      const normalize = (line: Line) => ({ ...line, productId: line.productId || null, quantity: Number(line.quantity), unitPrice: 0 });
      await api('/batches', { method: 'POST', body: JSON.stringify({ ...form, startedAt: form.startedAt || undefined, completedAt: form.completedAt || undefined, inputs: form.inputs.map(normalize), outputs: form.outputs.map(normalize), costs: [] }) });
      setOpen(false); reset(); setMessage('Production batch and costing saved.'); await load();
    } catch (error: any) { setMessage(error.message); } finally { setSaving(false); }
  };
  const lineEditor = (key: 'inputs' | 'outputs' | 'costs', title: string) => {
    const lines = form[key];
    const choices = key === 'outputs' ? products.filter(p => p.type === 'FINISHED_GOOD' || p.type === 'BY_PRODUCT') : products.filter(p => p.type !== 'FINISHED_GOOD' && p.type !== 'BY_PRODUCT');
    return <Card className="p-4"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold">{title}</h3><p className="text-xs text-[#7a9185]">Select a product and store its actual quantity. Pricing comes from procurement, requisitions, and sales.</p></div><Button variant="secondary" onClick={() => setLines(key, [...lines, blank(key === 'inputs' ? 'RAW_MATERIAL' : 'OUTPUT')])}><Plus size={14}/> Add line</Button></div>
      <div className="space-y-2">{lines.map((line, index) => <div key={index} className="grid grid-cols-[minmax(260px,1fr)_220px_auto] gap-2 max-[700px]:grid-cols-1">
        <Dropdown value={line.productId} onChange={e => { const product = products.find(p => p.id === e.target.value); const next = [...lines]; next[index] = { ...line, productId: e.target.value, description: product?.name ?? '' }; setLines(key, next); }}><option value="">Select product</option>{choices.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</Dropdown>
        <Input type="number" min="0" step="0.001" value={line.quantity} placeholder="Quantity" onChange={e => { const next = [...lines]; next[index] = { ...line, quantity: e.target.value }; setLines(key, next); }}/>
        <button type="button" className="grid size-10 place-items-center text-red-600 disabled:opacity-30" disabled={lines.length === 1} onClick={() => setLines(key, lines.filter((_, i) => i !== index))}><Trash2 size={16}/></button>
      </div>)}</div></Card>;
  };
  const totalProfit = rows.reduce((sum, row) => sum + row.metrics.profit, 0);
  return <PageContainer loading={loading} cap="PRODUCTION & COSTING" title="Production batches" description="Capture every material, packaging item, output and overhead for a lot. Cost and profit update from actual sales rates." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16}/> New batch</Button>}>
    <div className="summary-grid mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {[['Production lots', rows.length], ['Total output', `${rows.reduce((s, r) => s + Number(r.actualQty), 0).toLocaleString()} kg`], ['Total batch cost', money(rows.reduce((s, r) => s + r.metrics.totalCost, 0))], ['Realised profit', money(totalProfit)]].map(([label, value]) => <Card key={String(label)} className="p-5"><div className="text-xs font-semibold uppercase tracking-wide text-[#7a9185]">{label}</div><div className="mt-2 text-xl font-bold text-[#0f1c16]">{value}</div></Card>)}
    </div>
    <Card className="p-0"><div className="flex items-center justify-between border-b border-[#e0e5dd] p-5"><div><h2 className="font-bold">Batch costing register</h2><p className="text-xs text-[#7a9185]">Profit uses the latest weighted sales rate when sales exist; entered output rate is the fallback estimate.</p></div><TrendingUp size={20} className="text-[#1b8f5a]"/></div>
      <div className="overflow-x-auto"><DataTable columns={['Batch / order','Product','Output','Cost / kg','Cost / ton','Revenue','Profit / ton','Margin','Status','']} empty={rows.length === 0 && <div className="grid place-items-center gap-2 p-12 text-center text-[#7a9185]"><Factory size={30}/><b className="text-[#0f1c16]">No batches recorded</b></div>}>
        {rows.map(row => <tr key={row.id}><td><strong className="font-mono text-[#0d3b2e]">{row.batchNumber}</strong><div className="text-xs text-[#7a9185]">{row.productionOrder?.number}</div></td><td>{row.fgProduct?.name ?? 'Custom output'}</td><td>{Number(row.actualQty).toLocaleString()} kg<div className="text-xs text-[#7a9185]">Waste {Number(row.actualWastePct).toFixed(2)}%</div></td><td>{money(row.metrics.costPerKg)}</td><td>{money(row.metrics.costPerTon)}</td><td>{money(row.metrics.revenue)}<div className="text-xs text-[#7a9185]">{row.metrics.salesPosted ? 'From sales' : 'Estimated'}</div></td><td className={row.metrics.profit >= 0 ? 'font-bold text-[#1b8f5a]' : 'font-bold text-red-600'}>{money(row.metrics.profitPerTon)}</td><td>{row.metrics.marginPercent.toFixed(2)}%</td><td>{statusBadge(row.status)}</td><td><Button variant="secondary" onClick={() => setSelected(row)}>Details</Button></td></tr>)}
      </DataTable></div>
    </Card>

    {open && <Modal extraWide fixedHeight title="Record production batch" description="Dynamic replacement for the manual lot-consumption and costing sheets." onClose={() => setOpen(false)} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={saving || !form.productionOrderId} onClick={() => void submit()}>{saving ? 'Saving…' : 'Complete batch'}</Button></>}>
      <div className="space-y-4">
        <FormField label="Production order" required><Dropdown value={form.productionOrderId} onChange={e => chooseOrder(e.target.value)}><option value="">Select order</option>{orders.filter(order => !rows.some(row => row.productionOrder?.id === order.id)).map(order => <option key={order.id} value={order.id}>{order.number} · {order.fgProduct?.name ?? 'Finished good'}</option>)}</Dropdown></FormField>
        <div className="grid grid-cols-2 gap-3 max-[700px]:grid-cols-1"><FormField label="Started at"><Input type="datetime-local" value={form.startedAt} onChange={e => setForm({...form, startedAt: e.target.value})}/></FormField><FormField label="Completed at"><Input type="datetime-local" value={form.completedAt} onChange={e => setForm({...form, completedAt: e.target.value})}/></FormField></div>
        {lineEditor('outputs', 'Finished material outputs')}
        {lineEditor('inputs', 'Raw materials and utilities used')}
        <Card className="grid grid-cols-3 gap-3 bg-[#f8faf7] p-4 max-[700px]:grid-cols-1"><div><span className="text-xs text-[#7a9185]">Total input quantity</span><b className="block">{totals.input.toLocaleString()}</b></div><div><span className="text-xs text-[#7a9185]">Total FM output quantity</span><b className="block">{totals.output.toLocaleString()}</b></div><div><span className="text-xs text-[#7a9185]">Difference / loss</span><b className="block">{Math.max(0, totals.input - totals.output).toLocaleString()}</b></div></Card>
        <FormField label="Production notes"><TextArea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Shift, machine, quality observations or approval note"/></FormField>
      </div>
    </Modal>}

    {selected && <Modal title={selected.batchNumber} description={`${selected.fgProduct?.name ?? 'Production batch'} · ${selected.completedAt ? new Date(selected.completedAt).toLocaleDateString('en-GB') : ''}`} onClose={() => setSelected(null)} footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
      <div className="summary-grid grid grid-cols-2 gap-3 sm:grid-cols-3"><Card className="p-4"><span className="text-xs text-[#7a9185]">Total cost</span><b className="block text-lg">{money(selected.metrics.totalCost)}</b></Card><Card className="p-4"><span className="text-xs text-[#7a9185]">Revenue</span><b className="block text-lg">{money(selected.metrics.revenue)}</b></Card><Card className="p-4"><span className="text-xs text-[#7a9185]">Profit</span><b className={`block text-lg ${selected.metrics.profit < 0 ? 'text-red-600' : 'text-[#1b8f5a]'}`}>{money(selected.metrics.profit)}</b></Card></div>
      {[['Consumed materials', selected.inputLines], ['Finished outputs', selected.outputLines], ['Other costs', selected.costLines]].map(([title, lines]) => <div className="mt-4" key={title as string}><h3 className="mb-2 text-sm font-bold">{title as string}</h3><div className="rounded-lg border border-[#e0e5dd]">{(lines as Line[]).map((line, i) => <div key={i} className="grid grid-cols-1 gap-2 border-b sm:grid-cols-[1fr_auto_auto] sm:gap-4 border-[#edf0eb] p-3 last:border-0"><span>{line.description}</span><span>{Number(line.quantity).toLocaleString()} × {money(Number(line.unitPrice))}</span><b>{money(Number(line.quantity) * Number(line.unitPrice))}</b></div>)}</div></div>)}
    </Modal>}
  </PageContainer>;
}
