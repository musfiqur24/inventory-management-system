import { DataTable } from "../../../components/ui/DataTable";
import { printReport } from '../../../shared/printReport';
import { useEffect, useState } from 'react';
import { Plus, Printer, Search, FileText, CheckCircle2 } from 'lucide-react';
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

interface Product { id: string; sku: string; name: string; type: string; }
interface UOM { id: string; code: string; name: string; }
interface Partner { id: string; name: string; partnerType: string; }

interface ReqLine { productId: string; uomId: string; requestedQty: string; unitPrice: string; }
interface Requisition {
  id: string; number: string; status: string; requestedOn: string; salesOrderRef?: string;
  supplier?: { name: string } | null;
  lines: Array<{ id: string; product?: Product; uom?: UOM; requestedQty: number; receivedQty: number; unitPrice?: number; }>;
  totalEstimatedCost?: number;
}

export function RmRequisitionsPage() {
  const [rows, setRows] = useState<Requisition[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [form, setForm] = useState({ salesOrderRef: '', supplierId: '' });
  const [lines, setLines] = useState<ReqLine[]>([{ productId: '', uomId: '', requestedQty: '', unitPrice: '' }]);

  const load = async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [reqs, prods, uomData, partnerData] = await Promise.all([
        api<{ data: Requisition[] }>('/purchase-requisitions'),
        api<{ data: Product[] }>('/products'),
        api<{ data: UOM[] }>('/uoms'),
        api<{ data: Partner[] }>('/partners'),
      ]);
      setRows(reqs.data);
      setProducts(prods.data.filter((p) => p.type === 'RAW_MATERIAL'));
      setUoms(uomData.data);
      setPartners(partnerData.data.filter((p) => p.partnerType === 'SUPPLIER'));
      setMessage('');
    } catch (e: any) { setMessage(e.message); }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    try {
      const validLines = lines.filter((l) => l.productId && l.uomId && l.requestedQty);
      if (validLines.length === 0) return setMessage('Add at least one product line.');
      await api('/purchase-requisitions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          supplierId: form.supplierId || undefined,
          lines: validLines.map((l) => ({
            productId: l.productId, uomId: l.uomId,
            requestedQty: Number(l.requestedQty),
            unitPrice: l.unitPrice ? Number(l.unitPrice) : undefined,
          })),
        }),
      });
      setOpen(false);
      setForm({ salesOrderRef: '', supplierId: '' });
      setLines([{ productId: '', uomId: '', requestedQty: '', unitPrice: '' }]);
      void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const approve = async (id: string) => {
    try {
      await api(`/purchase-requisitions/${id}/approve`, { method: 'POST' });
      void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const printReq = (req: Requisition) => {
    printReport(`Requisition ${req.number}`, `
      <div class="flex items-start justify-between"><div><h1 class="text-[22px] font-bold">RM Purchase Requisition</h1><p>ID: <strong>${req.number}</strong> &nbsp;|&nbsp; Date: ${new Date(req.requestedOn).toLocaleDateString('en-GB')}</p>${req.supplier ? `<p>Supplier: <strong>${req.supplier.name}</strong></p>` : ''}</div><span class="rounded-full px-2.5 py-1 text-xs font-bold bg-[#e8f8ef] text-[#1b8f5a]">${req.status}</span></div>
      ${req.salesOrderRef ? `<p>Sales Order Ref: <strong>${req.salesOrderRef}</strong></p>` : ''}
      <table class="mt-5 w-full border-collapse [:where(&_th)]:border [:where(&_th)]:border-[#ccc] [:where(&_th)]:p-2.5 [:where(&_th)]:text-left [:where(&_th)]:bg-[#f5f5f5] [:where(&_td)]:border [:where(&_td)]:border-[#ccc] [:where(&_td)]:p-2.5 [:where(&_td)]:text-left"><thead><tr><th>#</th><th>Product</th><th>Requested Qty</th><th>Received Qty</th><th>UOM</th><th>Unit Price</th></tr></thead>
      <tbody>${req.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${l.product?.name ?? ''}<br><small>${l.product?.sku ?? ''}</small></td><td>${Number(l.requestedQty).toLocaleString()}</td><td>${Number(l.receivedQty).toLocaleString()}</td><td>${l.uom?.code ?? ''}</td><td>${l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td></tr>`).join('')}</tbody></table>
      <div class="mt-10 text-[13px] text-[#777] flex justify-between"><span>Prepared by: _______________________</span><span>Approved by: _______________________</span><span>Date: _____________</span></div>
    `);
  };

  const filtered = rows.filter((r) =>
    r.number.toLowerCase().includes(search.toLowerCase()) ||
    (r.supplier?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer
      cap="RM PROCUREMENT"
      title="Purchase Requisitions"
      description="Create RM requisitions from sales demand. Each gets a unique auto-generated ID and is downloadable as a formal report."
      actions={
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> New Requisition
        </Button>
      }
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
   >

      {/* Stats row */}
      <div className="grid grid-cols-[repeat(4,_1fr)] gap-4 mb-5 max-[900px]:grid-cols-[repeat(2,_1fr)] max-[480px]:grid-cols-[1fr]">
        {[
          { label: 'Total', value: rows.length, color: 'brand' },
          { label: 'Submitted', value: rows.filter((r) => r.status === 'SUBMITTED').length, color: 'blue' },
          { label: 'Approved', value: rows.filter((r) => r.status === 'APPROVED').length, color: 'green' },
          { label: 'Received', value: rows.filter((r) => r.status === 'RECEIVED' || r.status === 'PARTIALLY_RECEIVED').length, color: 'purple' },
        ].map((s) => (
          <Card className="flex items-start gap-3.5 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md p-[14px_16px]" key={s.label}>
            <div className="min-w-0">
              <div className="[font-family:'Outfit',_sans-serif] text-[22px] font-bold text-[#0f1c16] leading-[1] mb-1">{s.value}</div>
              <div className="text-[12px] text-[#7a9185] font-medium">{s.label} Requisitions</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <h2>Requisition Register</h2>
          <div className="flex gap-2.5 items-center">
            <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] flex-1 max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]">
              <Search size={15} />
              <input
                placeholder="Search by number or supplier…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <DataTable columns={["Requisition #","Supplier","Sales Ref","Lines","Est. Value","Status","Date","Actions"]}>
              {filtered.map((req) => (
                <tr key={req.id}>
                  <td><strong className="text-[#0d3b2e]">{req.number}</strong></td>
                  <td>{req.supplier?.name ?? <span className="text-[#7a9185]">—</span>}</td>
                  <td><span className="text-[12px] text-[#7a9185]">{req.salesOrderRef ?? '—'}</span></td>
                  <td>{req.lines.length} items</td>
                  <td>{req.totalEstimatedCost ? req.totalEstimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
                  <td>{statusBadge(req.status)}</td>
                  <td className="text-[12px] text-[#7a9185]">{new Date(req.requestedOn).toLocaleDateString('en-GB')}</td>
                  <td>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(req)}>
                        <FileText size={14} /> View
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => printReq(req)}>
                        <Printer size={14} /> Print
                      </Button>
                      {req.status === 'SUBMITTED' && (
                        <Button size="sm" variant="accent" onClick={() => approve(req.id)}>
                          <CheckCircle2 size={14} /> Approve
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70">
              <div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><FileText size={28} /></div>
              <b>No requisitions found</b>
              <p>Create a new RM requisition from sales demand to get started.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Create modal */}
      {open && (
        <Modal
          title="New RM Purchase Requisition"
          description="Create a sourcing request for raw materials. A unique requisition ID will be auto-generated."
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={submit}>Submit Requisition</Button>
            </>
          }
       >
          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr]">
            <FormField label="Sales Order Reference">
              <Input placeholder="e.g. SO-2026-0012" value={form.salesOrderRef} onChange={(e) => setForm({ ...form, salesOrderRef: e.target.value })} />
            </FormField>
            <FormField label="Preferred Supplier">
              <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">— Select supplier —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="[border-top:1px_solid_#e0e5dd] pt-3.5">
            <div className="flex justify-between items-center mb-3">
              <strong className="text-[14px]">Raw Material Lines</strong>
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { productId: '', uomId: '', requestedQty: '', unitPrice: '' }])}>
                <Plus size={14} /> Add Line
              </Button>
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr] bg-[#f8faf7] p-3 rounded-[10px] mb-2.5">
                <FormField label="Raw Material Product">
                  <Select value={line.productId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, productId: e.target.value } : l))}>
                    <option value="">— Select product —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </Select>
                </FormField>
                <FormField label="UOM">
                  <Select value={line.uomId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, uomId: e.target.value } : l))}>
                    <option value="">— UOM —</option>
                    {uoms.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                  </Select>
                </FormField>
                <FormField label="Requested Quantity">
                  <Input type="number" placeholder="e.g. 30000" value={line.requestedQty} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, requestedQty: e.target.value } : l))} />
                </FormField>
                <FormField label="Unit Price (optional)">
                  <Input type="number" placeholder="Price per UOM" value={line.unitPrice} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, unitPrice: e.target.value } : l))} />
                </FormField>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Detail view modal */}
      {selected && (
        <Modal
          title={`Requisition ${selected.number}`}
          description={`Status: ${selected.status} · Supplier: ${selected.supplier?.name ?? 'Not assigned'}`}
          onClose={() => setSelected(null)}
          wide
          footer={
            <>
              <Button variant="secondary" onClick={() => { printReq(selected); }}>
                <Printer size={14} /> Print Report
              </Button>
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            </>
          }
       >
          <div className="overflow-x-auto">
            <DataTable columns={["Product","SKU","Requested","Received","UOM","Unit Price"]}>
                {selected.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.product?.name ?? '—'}</td>
                    <td><span className="text-[11px] text-[#7a9185] font-mono">{l.product?.sku ?? '—'}</span></td>
                    <td><strong>{Number(l.requestedQty).toLocaleString()}</strong></td>
                    <td>{Number(l.receivedQty).toLocaleString()}</td>
                    <td>{l.uom?.code ?? '—'}</td>
                    <td>{l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </DataTable>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}


