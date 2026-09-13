import { usePageLoading } from "../../../shared/hooks/usePageLoading";
import { ConfirmationModal } from "../../../components/ui/ConfirmationModal";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { DataTable } from "../../../components/ui/DataTable";
import { useToastMessage } from "../../../components/ui/Toast";
import { printReport } from '../../../shared/printReport';
import { useEffect, useState } from 'react';
import { Plus, Printer, Search, FileText, CheckCircle2, Trash2, Pencil } from 'lucide-react';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { statusBadge } from '../../../components/ui/Badge';

interface Product { id: string; sku: string; name: string; type: string; baseUomId: string; }
interface UOM { id: string; code: string; name: string; }
interface Partner { id: string; name: string; partnerType: string; }

interface Manager { id: string; fullName: string; email: string; }
interface ReqLine { productId: string; uomId: string; requestedQty: string; unitPrice: string; }
interface Requisition {
  id: string; number: string; status: string; requestedOn: string; salesOrderRef?: string;
  createdById?: string | null; approvedAt?: string | null; supplierId?: string | null;
  assignedManagerId?: string | null; assignedManager?: Manager | null;
  supplier?: { name: string } | null;
  lines: Array<{ id: string; productId: string; uomId: string; product?: Product; uom?: UOM; requestedQty: number; receivedQty: number; unitPrice?: number; }>;
  totalEstimatedCost?: number;
}

export function RmRequisitionsPage() {
  const [pageLoading, runPageLoad] = usePageLoading();
  const { user, can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Requisition | null>(null);
  const [deleting, setDeleting] = useState<Requisition | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const isManager = user?.organizations.find(o=>o.id===selectedOrg())?.role.code === "MANAGER";
  const canDelete = () => isManager;
  const canEdit = (req:Requisition) => !req.approvedAt && ["DRAFT","SUBMITTED"].includes(req.status) && (req.createdById===user?.id || (isManager && req.assignedManagerId===user?.id));
  const [approving, setApproving] = useState<string | null>(null);
  const canApprove = (req: Requisition) => req.status === 'SUBMITTED' && req.assignedManagerId === user?.id && can('departments.write') && user?.organizations.find(o=>o.id===selectedOrg())?.role.code === 'MANAGER';
  const closeDetails = () => { setSelected(null); setParams(current => { const next = new URLSearchParams(current); next.delete('requisition'); return next; }, {replace:true}); };
  const [rows, setRows] = useState<Requisition[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [uoms, setUoms] = useState<UOM[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [open, setOpen] = useState(false);
  const [, setMessage] = useToastMessage();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [form, setForm] = useState({ salesOrderRef: '', supplierId: '', assignedManagerId: '' });
  const [lines, setLines] = useState<ReqLine[]>([{ productId: '', uomId: '', requestedQty: '', unitPrice: '' }]);

  const load = async () => { return runPageLoad(async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [reqs, prods, uomData, partnerData, managerData] = await Promise.all([
        api<{ data: Requisition[] }>('/purchase-requisitions'),
        api<{ data: Product[] }>('/products'),
        api<{ data: UOM[] }>('/uoms'),
        api<{ data: Partner[] }>('/partners'),
        api<{ data: Manager[] }>('/purchase-requisitions/managers'),
      ]);
      setRows(reqs.data);
      setManagers(managerData.data);
      setProducts(prods.data.filter((p) => p.type === 'RAW_MATERIAL'));
      setUoms(uomData.data);
      setPartners(partnerData.data.filter((p) => p.partnerType === 'SUPPLIER'));
      setMessage('');
    } catch (e: any) { setMessage(e.message); }
  });};

  useEffect(() => { void load(); }, []);

  const requestedId = params.get('requisition');
  useEffect(() => {
    if (!requestedId) return;
    let active = true;
    void api<{data:Requisition}>('/purchase-requisitions/'+encodeURIComponent(requestedId)).then(r=>{if(active)setSelected(r.data)}).catch(e=>{if(active)setMessage(e.message)});
    return () => {active=false};
  },[requestedId]);

  const edit = (req:Requisition) => {
    setEditing(req);setForm({salesOrderRef:req.salesOrderRef??'',supplierId:req.supplierId??'',assignedManagerId:req.assignedManagerId??''});
    setLines(req.lines.map(l=>({productId:l.productId,uomId:l.uomId,requestedQty:String(l.requestedQty),unitPrice:l.unitPrice!=null?String(l.unitPrice):''})));setOpen(true);
  };
  const remove = async () => {
    if(!deleting || deletePending)return;setDeletePending(true);
    try{await api('/purchase-requisitions/'+deleting.id,{method:'DELETE'});if(selected?.id===deleting.id)closeDetails();setDeleting(null);window.dispatchEvent(new Event('notificationsChanged'));void load();}catch(e:any){setMessage(e.message)}finally{setDeletePending(false)}
  };
  const lineTotal = (line:ReqLine) => {const value=Number(line.requestedQty)*Number(line.unitPrice);return Number.isFinite(value)?value:0;};
  const price = (value:number) => value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const submit = async () => {
    if (saving) return;
    if (!form.assignedManagerId) return setMessage('Select a manager to approve this requisition.');
    if (lines.some(l=>!l.productId || !l.uomId || !Number.isFinite(Number(l.requestedQty)) || Number(l.requestedQty)<=0 || (l.unitPrice!=='' && (!Number.isFinite(Number(l.unitPrice)) || Number(l.unitPrice)<=0)))) return setMessage('Complete every product line with a positive quantity and valid unit price, or remove unused lines.');
    setSaving(true);
    try {
      const validLines = lines.filter((l) => l.productId && l.uomId && l.requestedQty);
      if (validLines.length === 0) return setMessage('Add at least one product line.');
      await api(editing ? '/purchase-requisitions/'+editing.id : '/purchase-requisitions', {
        method: editing ? 'PUT' : 'POST',
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
      window.dispatchEvent(new Event("notificationsChanged"));
      setOpen(false);
      setEditing(null);
      setForm({ salesOrderRef: '', supplierId: '', assignedManagerId: '' });
      setLines([{ productId: '', uomId: '', requestedQty: '', unitPrice: '' }]);
      void load();
    } catch (e: any) { setMessage(e.message); } finally { setSaving(false); }
  };

  const approve = async (id: string) => {
    if (approving) return;
    setApproving(id);
    try {
      await api(`/purchase-requisitions/${id}/approve`, { method: 'POST' });
      setSelected(current=>current?.id===id?{...current,status:'APPROVED'}:current);
      window.dispatchEvent(new Event('notificationsChanged'));
      void load();
    } catch (e: any) { setMessage(e.message); } finally { setApproving(null); }
  };

  const printReq = (req: Requisition) => {
    printReport(`Requisition ${req.number}`, `
      <div class="flex items-start justify-between"><div><h1 class="text-[22px] font-bold">RM Purchase Requisition</h1><p>ID: <strong>${req.number}</strong> &nbsp;|&nbsp; Date: ${new Date(req.requestedOn).toLocaleDateString('en-GB')}</p>${req.supplier ? `<p>Supplier: <strong>${req.supplier.name}</strong></p>` : ''}</div><span class="rounded-full px-2.5 py-1 text-xs font-bold bg-[#e8f8ef] text-[#1b8f5a]">${req.status}</span></div>
      ${req.salesOrderRef ? `<p>Sales Order Ref: <strong>${req.salesOrderRef}</strong></p>` : ''}
      <table class="mt-5 w-full border-collapse [:where(&_th)]:border [:where(&_th)]:border-[#ccc] [:where(&_th)]:p-2.5 [:where(&_th)]:text-left [:where(&_th)]:bg-[#f5f5f5] [:where(&_td)]:border [:where(&_td)]:border-[#ccc] [:where(&_td)]:p-2.5 [:where(&_td)]:text-left"><thead><tr><th>#</th><th>Product</th><th>Requested Qty</th><th>Received Qty</th><th>UOM</th><th>Unit Price</th><th>Total Price</th></tr></thead>
      <tbody>${req.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${l.product?.name ?? ''}<br><small>${l.product?.sku ?? ''}</small></td><td>${Number(l.requestedQty).toLocaleString()}</td><td>${Number(l.receivedQty).toLocaleString()}</td><td>${l.uom?.code ?? ''}</td><td>${l.unitPrice ? Number(l.unitPrice).toLocaleString() : '—'}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="6" class="text-right font-bold">Total Price</td><td class="font-bold">${req.lines.reduce((sum,l)=>sum+Number(l.requestedQty)*Number(l.unitPrice||0),0).toLocaleString()}</td></tr></tfoot></table>
      <div class="mt-10 text-[13px] text-[#777] flex justify-between"><span>Prepared by: _______________________</span><span>Approved by: _______________________</span><span>Date: _____________</span></div>
    `);
  };

  const matchesStatus = (r:Requisition,filter:string) => filter === 'ALL' || (filter === 'PENDING' ? ['DRAFT','SUBMITTED'].includes(r.status) : r.status === filter);
  const filtered = rows.filter(r => matchesStatus(r,statusFilter) && (r.number.toLowerCase().includes(search.toLowerCase()) || (r.supplier?.name ?? '').toLowerCase().includes(search.toLowerCase())));


  return (
    <PageContainer loading={pageLoading}
      cap="RM PROCUREMENT"
      title="Purchase Requisitions"
      description="Generate production requisitions from Sales demand"
      actions={
        <Button variant="primary" onClick={() => {setEditing(null);setForm({salesOrderRef:"",supplierId:"",assignedManagerId:""});setLines([{productId:"",uomId:"",requestedQty:"",unitPrice:""}]);setOpen(true);}}>
          <Plus size={16} /> New Requisition
        </Button>
      }
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

      <Card padding="none">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[#e0e5dd] px-4 py-3">
          <h2 className="m-0 shrink-0 text-sm font-semibold">Requisition Register</h2>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Filter requisitions by status" className="flex flex-wrap items-center gap-2">
              {[{value:'ALL',label:'All'},{value:'APPROVED',label:'Approved'},{value:'PENDING',label:'Pending'},{value:'REJECTED',label:'Rejected'}].map(filter=><Button key={filter.value} size="sm" className="h-9" variant={statusFilter===filter.value?'primary':'secondary'} aria-pressed={statusFilter===filter.value} onClick={()=>setStatusFilter(filter.value)}>{filter.label}<span className="text-xs opacity-75">({rows.filter(r=>matchesStatus(r,filter.value)).length})</span></Button>)}
            </div>
            <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-[#e0e5dd] bg-[#f8faf7] px-3 focus-within:border-[#1a5c45] focus-within:ring-2 focus-within:ring-[#1a5c45]/10 sm:w-72">
              <Search size={15} className="shrink-0 text-[#7a9185]"/>
              <input aria-label="Search requisitions" placeholder="Search number or supplier..." className="min-w-0 w-full border-0 bg-transparent text-xs text-[#0f1c16] outline-none placeholder:text-[#7a9185]" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto [&_tbody_td]:text-xs [&_tbody_td]:py-3 [&_tbody_td]:px-3 [&_tbody_td]:whitespace-nowrap">
          <DataTable scrollAreaClassName="h-88 overflow-auto overscroll-contain [scrollbar-gutter:stable] sm:h-96" columns={["Requisition #","Supplier","Assigned Manager","Sales Ref","Lines","Est. Value","Status","Date","Actions"]}>
              {filtered.map((req) => (
                <tr key={req.id}>
                  <td><strong className="text-[#0d3b2e]">{req.number}</strong></td>
                  <td>{req.supplier?.name ?? <span className="text-[#7a9185]">—</span>}</td>
                  <td>{req.assignedManager?.fullName ?? "Not assigned"}</td>
                  <td><span className="text-[12px] text-[#7a9185]">{req.salesOrderRef ?? '—'}</span></td>
                  <td>{req.lines.length} items</td>
                  <td>{req.totalEstimatedCost ? req.totalEstimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
                  <td>{statusBadge(req.status)}</td>
                  <td className="text-[12px] text-[#7a9185]">{new Date(req.requestedOn).toLocaleDateString('en-GB')}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button size="sm" className="size-8 min-h-8 p-0" title="View requisition" aria-label="View requisition" onClick={()=>setSelected(req)}><FileText size={15}/></Button>
                      <Button size="sm" className="size-8 min-h-8 p-0" title="Print requisition" aria-label="Print requisition" onClick={()=>printReq(req)}><Printer size={15}/></Button>
                      {canEdit(req)&&<Button size="sm" className="size-8 min-h-8 p-0" title="Edit requisition" aria-label="Edit requisition" onClick={()=>edit(req)}><Pencil size={15}/></Button>}
                      {canApprove(req)&&<Button size="sm" variant="accent" className="size-8 min-h-8 p-0" title="Approve requisition" aria-label="Approve requisition" disabled={!!approving} onClick={()=>void approve(req.id)}><CheckCircle2 size={15}/></Button>}
                      {canDelete()&&<Button size="sm" variant="danger" className="size-8 min-h-8 p-0" title="Delete requisition" aria-label="Delete requisition" onClick={()=>setDeleting(req)}><Trash2 size={15}/></Button>}
                    </div>
                  </td>
                </tr>
              ))}
          {filtered.length === 0 && (
            <tr><td colSpan={9}><div className="grid h-64 place-items-center">
            <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70">
              <div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><FileText size={28} /></div>
              <b>No requisitions found</b>
              <p>{statusFilter!=="ALL" || search ? "No requisitions match these filters. Try another status or clear the search." : "Create a new RM requisition from sales demand to get started."}</p>
            </div>
            </div></td></tr>
          )}
            </DataTable>
        </div>
      </Card>

      {deleting && <ConfirmationModal title="Delete requisition?" confirmLabel="Delete Requisition" pending={deletePending} onCancel={()=>setDeleting(null)} onConfirm={()=>void remove()}>Delete {deleting.number}? It will be removed from the register. Requisitions linked to deliveries cannot be deleted.</ConfirmationModal>}

      {/* Create modal */}
      {open && (
        <Modal
          title={editing ? "Edit RM Purchase Requisition" : "New RM Purchase Requisition"}
          description="Create a sourcing request for raw materials. A unique requisition ID will be auto-generated."
          onClose={() => { if (!saving) setOpen(false); }}
          extraWide
          fixedHeight
          footer={
            <>
              <Button variant="secondary" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" disabled={saving || !form.assignedManagerId} onClick={submit}>{saving ? "Submitting..." : (editing ? "Save Changes" : "Submit Requisition")}</Button>
            </>
          }
       >
          <div className="grid grid-cols-3 gap-3.5 max-[1000px]:grid-cols-2 max-[700px]:grid-cols-1">
            <FormField label="Sales Order Reference">
              <Input placeholder="e.g. SO-2026-0012" value={form.salesOrderRef} onChange={(e) => setForm({ ...form, salesOrderRef: e.target.value })} />
            </FormField>
            <FormField label="Preferred Supplier">
              <Dropdown value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">— Select supplier —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Dropdown>
            </FormField>
          <FormField label="Assigned Manager" required>
            <Dropdown aria-label="Assigned Manager" value={form.assignedManagerId} onChange={e=>setForm({...form,assignedManagerId:e.target.value})}>
              <option value="">Select manager</option>
              {managers.map(manager=><option key={manager.id} value={manager.id}>{manager.fullName}</option>)}
            </Dropdown>
            {!managers.length && <p className="mt-2 text-sm text-amber-700">No active managers are assigned to this organization. Assign a user the Manager role in User Management first.</p>}
          </FormField>
          </div>
          <div className="[border-top:1px_solid_#e0e5dd] pt-3.5">
            <div className="flex justify-between items-center mb-3">
              <strong className="text-[14px]">Raw Material Lines</strong>
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { productId: '', uomId: '', requestedQty: '', unitPrice: '' }])}>
                <Plus size={14} /> Add Line
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[#e0e5dd] pb-1 [&_thead_th:nth-child(5)]:text-right [&_thead_th:last-child]:text-center">
              <DataTable
                columns={['Raw Material Product','UOM','Qty','Unit Price (optional)','Total Price','Actions']}
                columnWidths={['27%','18%','15%','21%','12%','7%']}
                scrollAreaClassName="h-[360px]"
                tableClassName="min-w-[800px] table-fixed [&_th]:px-2 [&_th]:py-3.5 [&_th]:text-[10px] [&_td]:text-xs"
                pagination={false}
                summary={<tr className="border-t border-[#e0e5dd] bg-[#f8faf7]"><th colSpan={4} className="px-3 py-3 text-right text-sm">Estimated Total</th><td className="px-2 py-3 text-right font-semibold tabular-nums">{price(lines.reduce((sum,line)=>sum+lineTotal(line),0))}</td><td/></tr>}
              >
                  {lines.map((line, i) => (
                    <tr key={i} className="border-t border-[#e0e5dd] align-middle">
                      <td className="px-3 py-2"><Dropdown controlClassName="text-xs px-3 pr-14" aria-label={`Product for line ${i + 1}`} value={line.productId} onChange={(e) => { const product=products.find(p=>p.id===e.target.value); setLines(lines.map((l,li)=>li===i?{...l,productId:e.target.value,uomId:product?.baseUomId??""}:l)); }}><option value="">Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Dropdown></td>
                      <td className="px-2 py-2"><Dropdown controlClassName="text-xs px-2.5 pr-9" aria-label={`UOM for line ${i + 1}`} value={line.uomId} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, uomId: e.target.value } : l))}><option value="">UOM</option>{uoms.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</Dropdown></td>
                      <td className="px-2 py-2"><Input aria-label={`Requested quantity for line ${i + 1}`} className="h-11 px-2 text-xs" type="number" min="0.001" step="0.001" placeholder="Qty" value={line.requestedQty} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, requestedQty: e.target.value } : l))}/></td>
                      <td className="px-2 py-2"><Input aria-label={`Unit price for line ${i + 1}`} className="h-11 px-3 text-xs" type="number" min="0" step="0.0001" placeholder="Price" value={line.unitPrice} onChange={(e) => setLines(lines.map((l, li) => li === i ? { ...l, unitPrice: e.target.value } : l))}/></td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold">{line.unitPrice!=="" && line.requestedQty!=="" ? price(lineTotal(line)) : "-"}</td>
                      <td className="px-2 py-2 text-center"><Button variant="ghost" className="size-9 min-h-9 p-0 text-red-600 hover:bg-red-50" aria-label={`Remove line ${i + 1}`} title="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, li) => li !== i))}><Trash2 size={16}/></Button></td>
                    </tr>
                  ))}
              </DataTable>
            </div>
          </div>
        </Modal>
      )}

      {/* Detail view modal */}
      {selected && (
        <Modal
          title={`Requisition ${selected.number}`}
          description={`Status: ${selected.status} · Supplier: ${selected.supplier?.name ?? 'Not assigned'}`}
          onClose={closeDetails}
          wide
          footer={
            <>
              {canApprove(selected) && <Button variant="primary" disabled={!!approving} onClick={()=>void approve(selected.id)}>{approving ? "Approving..." : "Approve Requisition"}</Button>}
              <Button variant="secondary" onClick={() => { printReq(selected); }}>
                <Printer size={14} /> Print Report
              </Button>
              <Button variant="secondary" onClick={closeDetails}>Close</Button>
            </>
          }
       >
          <p className="mb-4 text-sm"><strong>Assigned Manager:</strong> {selected.assignedManager?.fullName ?? "Not assigned"}</p>
          <div className="overflow-x-auto">
            <DataTable columns={["Product","SKU","Requested","Received","UOM","Unit Price","Total Price"]} summary={<tr className="border-t-2 border-[#cfd8d1] bg-[#f3f7f1]"><th colSpan={6} className="px-5 py-4 text-right text-sm font-bold text-[#263b31]">Total Price</th><td className="px-5 py-4 font-bold tabular-nums text-[#0d3b2e]">{selected.lines.reduce((sum,l)=>sum+Number(l.requestedQty)*Number(l.unitPrice||0),0).toLocaleString()}</td></tr>}>
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


