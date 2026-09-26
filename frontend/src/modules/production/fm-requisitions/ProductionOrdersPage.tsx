import { usePageLoading } from "../../../shared/hooks/usePageLoading";
import { DataTable } from "../../../components/ui/DataTable";
import { useToastMessage } from "../../../components/ui/Toast";
import type { CSSProperties } from 'react';
import { twMerge } from 'tailwind-merge';
import { Fragment, useEffect, useState } from 'react';
import { Plus, Factory, Search, Eye, Trash2, ChevronRight, ChevronDown, Printer, CheckCircle2, Pencil, TriangleAlert, XCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { api, selectedOrg } from '../../../shared/api/http';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { FormField } from '../../../components/ui/FormField';
import { Dropdown } from '../../../components/ui/Dropdown';
import { statusBadge } from '../../../components/ui/Badge';

interface ProductionOrder {
  id: string; number: string; requisitionId?: string; requisitionNumber?: string; status: string; targetQty: number; expectedWastePercent: number; plannedStartDate?: string; assignedManagerId?: string | null; assignedManager?: Manager | null; approvedAt?: string | null;
  recipe?: { id: string; name: string; code: string; targetTonnage: number } | null;
  fgProduct?: { name: string; sku: string } | null;
  uom?: { code: string } | null;
  issues?: Array<{ id: string }>;
  lines: Array<{ id: string; productId: string; rawMaterial?: { name: string; sku: string }; requiredQty: number; issuedQty: number; }>;
}
interface Product { id: string; name: string; sku: string; type: string; }
interface Manager { id: string; fullName: string; email: string; }
interface Recipe {
  id: string; name: string; code: string; targetTonnage: number;
  finishedProductId: string; outputUomId: string; outputQty: number;
  ingredients: Array<{
    id: string; rawProductId: string; percentage: number; quantityPerTon: number;
    rawMaterial?: { name: string; sku: string } | null;
  }>;
}

export function ProductionOrdersPage() {
  const [pageLoading, runPageLoad] = usePageLoading();
  const { user, can } = useAuth();
  const [rows, setRows] = useState<ProductionOrder[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<Product[]>([]);
  const [utilityProducts, setUtilityProducts] = useState<Product[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [assignedManagerId, setAssignedManagerId] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<{ number: string; orders: ProductionOrder[] } | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{ number: string; orders: ProductionOrder[] } | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<{ number: string; orders: ProductionOrder[] } | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState<Set<string>>(new Set());
  const [utilities, setUtilities] = useState([{ productId: '', quantity: '' }]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProductionOrder | null>(null);
  const [, setMessage] = useToastMessage();
  const [search, setSearch] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [plannedStartDate, setPlannedStartDate] = useState('');

  const load = async () => { return runPageLoad(async () => {
    if (!selectedOrg()) return setMessage('Select an organisation first.');
    try {
      const [po, r, p, managerData] = await Promise.all([
        api<{ data: ProductionOrder[] }>('/production-orders'),
        api<{ data: Recipe[] }>('/recipes'),
        api<{ data: Product[] }>('/products'),
        api<{ data: Manager[] }>('/production-orders/managers'),
      ]);
      setRows(po.data); setRecipes(r.data); setFinishedGoods(p.data.filter((product) => product.type === 'FINISHED_GOOD')); setUtilityProducts(p.data.filter((product) => product.type === 'PACKAGING')); setManagers(managerData.data); setMessage('');
    } catch (e: any) { setMessage(e.message); }
  });};

  useEffect(() => { void load(); }, []);

  const emptyItem = () => ({ finishedProductId: '', recipeId: '', targetQty: '', expectedWastePercent: '0' });
  const [items, setItems] = useState([emptyItem()]);

  const itemPreview = items.map((item) => {
    const recipe = recipes.find((candidate) => candidate.id === item.recipeId);
    const targetKg = Math.max(0, Number(item.targetQty) || 0);
    const wastePercent = Math.min(50, Math.max(0, Number(item.expectedWastePercent) || 0));
    return { ...item, recipe, targetKg, wastePercent, predictedOutput: targetKg * (1 - wastePercent / 100) };
  });
  const totalRmNeeded = itemPreview.reduce((total, item) => total + (item.recipe?.ingredients.reduce((sum, ingredient) => sum + Number(ingredient.quantityPerTon) * item.targetKg / 1000, 0) ?? 0), 0);
  const combinedRmBreakdown = (() => {
    const materials = new Map<string, { id: string; name: string; sku: string; quantity: number; finishedGoods: Set<string> }>();
    itemPreview.forEach((item) => {
      if (!item.recipe || item.targetKg <= 0) return;
      item.recipe.ingredients.forEach((ingredient) => {
        const current = materials.get(ingredient.rawProductId) ?? {
          id: ingredient.rawProductId,
          name: ingredient.rawMaterial?.name ?? 'Raw material',
          sku: ingredient.rawMaterial?.sku ?? '',
          quantity: 0,
          finishedGoods: new Set<string>(),
        };
        current.quantity += Number(ingredient.quantityPerTon) * item.targetKg / 1000;
        current.finishedGoods.add(item.recipe!.name);
        materials.set(ingredient.rawProductId, current);
      });
    });
    return [...materials.values()].sort((a, b) => b.quantity - a.quantity);
  })();

  const isManager = user?.organizations.find((organization) => organization.id === selectedOrg())?.role.code === 'MANAGER';
  const selectedUtilityIds = utilities.filter((line) => line.productId).map((line) => line.productId);
  const utilitiesAreUnique = new Set(selectedUtilityIds).size === selectedUtilityIds.length;
  const canCreate = utilitiesAreUnique && Boolean(plannedStartDate) && Boolean(assignedManagerId) && itemPreview.length > 0 && itemPreview.every((item) => item.recipe && item.targetKg > 0) && new Set(itemPreview.map((item) => item.recipe?.finishedProductId)).size === itemPreview.length;

  const submit = async (submitNow: boolean) => {
    try {
      await api(editingGroup ? `/production-orders/requisitions/${editingGroup.orders[0].requisitionId}` : '/production-orders', {
        method: editingGroup ? 'PUT' : 'POST',
        body: JSON.stringify({
          submit: submitNow,
          assignedManagerId,
          items: itemPreview.map((item) => ({
            recipeId: item.recipeId,
            plannedQty: item.targetKg,
            expectedWastePercent: item.wastePercent,
            scheduledFor: plannedStartDate,
          })),
          utilities: utilities.filter(line => line.productId && Number(line.quantity) > 0).map(line => ({ productId: line.productId, quantity: Number(line.quantity) })),
        }),
      });
      setOpen(false);
      setEditingGroup(null);
      setItems([emptyItem()]);
      setPlannedStartDate('');
      setAssignedManagerId('');
      setUtilities([{ productId: '', quantity: '' }]);
      void load();
    } catch (e: any) { setMessage(e.message); }
  };

  const requisitions = [...rows.reduce((groups, row) => {
    const number = row.requisitionNumber ?? row.number;
    const group = groups.get(number) ?? [];
    group.push(row);
    groups.set(number, group);
    return groups;
  }, new Map<string, ProductionOrder[]>())].map(([number, orders]) => ({ number, orders }));

  const searchTerm = search.toLowerCase();
  const filtered = requisitions.filter(({ number, orders }) =>
    number.toLowerCase().includes(searchTerm) ||
    orders.some((order) =>
      order.number.toLowerCase().includes(searchTerm) ||
      (order.recipe?.name ?? '').toLowerCase().includes(searchTerm) ||
      (order.fgProduct?.name ?? '').toLowerCase().includes(searchTerm)
    )
  );

  const editGroup = ({ number, orders }: { number: string; orders: ProductionOrder[] }) => {
    const firstDate = orders[0]?.plannedStartDate;
    setEditingGroup({ number, orders });
    setItems(orders.map((order) => ({ finishedProductId: order.recipe?.id ? recipes.find((recipe) => recipe.id === order.recipe?.id)?.finishedProductId ?? '' : '', recipeId: order.recipe?.id ?? '', targetQty: String(order.targetQty), expectedWastePercent: String(order.expectedWastePercent) })));
    setPlannedStartDate(firstDate ? new Date(firstDate).toISOString().slice(0, 10) : '');
    setAssignedManagerId(orders[0]?.assignedManagerId ?? '');
    const recipeProductIds = new Set((recipes.find((recipe) => recipe.id === orders[0]?.recipe?.id)?.ingredients ?? []).map((line) => line.rawProductId));
    const extraLines = (orders[0]?.lines ?? []).filter((line) => !recipeProductIds.has(line.productId)).map((line) => ({ productId: line.productId, quantity: String(line.requiredQty) }));
    setUtilities(extraLines.length ? extraLines : [{ productId: '', quantity: '' }]);
    setOpen(true);
  };
  const deleteGroup = async ({ orders }: { number: string; orders: ProductionOrder[] }) => {
    const requisitionId = orders[0]?.requisitionId;
    if (!requisitionId || deletePending) return;
    setDeletePending(true);
    try {
      await api(`/production-orders/requisitions/${requisitionId}`, { method: 'DELETE' });
      setDeletingGroup(null);
      await load();
    } catch (error: any) { setMessage(error.message); } finally { setDeletePending(false); }
  };

  const toggleExpanded = (number: string) => setExpanded((current) => {
    const next = new Set(current);
    next.has(number) ? next.delete(number) : next.add(number);
    return next;
  });
  const canApproveGroup = (orders: ProductionOrder[]) => {
    const requisition = orders[0];
    return requisition?.status === 'PENDING' && requisition.assignedManagerId === user?.id && can('departments.write') && user?.organizations.find((organization) => organization.id === selectedOrg())?.role.code === 'MANAGER';
  };
  const approveGroup = async (orders: ProductionOrder[]) => {
    const requisitionId = orders[0]?.requisitionId;
    if (!requisitionId || approving) return;
    setApproving(true);
    try {
      await api(`/production-orders/requisitions/${requisitionId}/approve`, { method: 'POST' });
      await load();
      setSelectedGroup(null);
    } catch (error: any) { setMessage(error.message); } finally { setApproving(false); }
  };
  const rejectGroup = async (orders: ProductionOrder[]) => {
    const requisitionId = orders[0]?.requisitionId;
    if (!requisitionId || rejecting) return;
    setRejecting(true);
    try {
      await api('/production-orders/requisitions/' + requisitionId + '/reject', { method: 'POST' });
      await load();
      setSelectedGroup(null);
    } catch (error: any) { setMessage(error.message); } finally { setRejecting(false); }
  };
  const printGroup = ({ number, orders }: { number: string; orders: ProductionOrder[] }) => {
    const manager = orders[0]?.assignedManager?.fullName ?? 'Not assigned';
    const materials = new Map<string, { name: string; sku: string; required: number }>();
    orders.forEach((order) => order.lines.forEach((line) => {
      const key = line.rawMaterial?.sku || line.rawMaterial?.name || line.id;
      const current = materials.get(key) ?? { name: line.rawMaterial?.name ?? '-', sku: line.rawMaterial?.sku ?? '-', required: 0 };
      current.required += Number(line.requiredQty);
      materials.set(key, current);
    }));
    const totalRequired = [...materials.values()].reduce((sum, material) => sum + material.required, 0);
    const rows = [...materials.values()].sort((a, b) => a.name.localeCompare(b.name)).map((material) => `<tr><td>${material.name}</td><td>${material.sku}</td><td>${material.required.toLocaleString()}</td></tr>`).join('');
    const popup = window.open('', '_blank', 'width=1000,height=800');
    if (!popup) return setMessage('Allow pop-ups to print this requisition.');
    popup.document.write(`<!doctype html><html><head><title>${number}</title><style>body{font:13px Arial;color:#17251e;padding:28px}header{border-bottom:3px solid #14563f;margin-bottom:20px}h1{margin:0 0 6px}h2{margin:22px 0 8px;color:#14563f}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ccd6cf;text-align:left}th{background:#eef4ef}tfoot{font-weight:bold;background:#f6f8f4}@media print{button{display:none}}</style></head><body><header><h1>FM Production Requisition</h1><p><b>Requisition:</b> ${number} &nbsp; <b>Status:</b> ${orders[0]?.status} &nbsp; <b>Assigned Manager:</b> ${manager}</p></header><h2>Combined Raw Material Requirements</h2><table><thead><tr><th>Raw Material</th><th>SKU</th><th>Total Required (kg)</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2">Total RM Required</td><td>${totalRequired.toLocaleString()} kg</td></tr></tfoot></table><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  };

  const selectedWastePercent = Number(selected?.expectedWastePercent ?? 0);
  const selectedWasteKg = Number(selected?.targetQty ?? 0) * (selectedWastePercent / 100);
  const selectedExpectedOutputKg = Math.max(0, Number(selected?.targetQty ?? 0) - selectedWasteKg);

  const requisitionCount = requisitions.length;

  const summaryCards = (
    <div className="summary-grid grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {[{ label: 'Total Requisitions', v: requisitionCount, c: 'brand' }, { label: 'Draft', v: requisitions.filter((r) => r.orders[0]?.status === 'DRAFT').length, c: 'gray' }, { label: 'Pending', v: requisitions.filter((r) => r.orders[0]?.status === 'PENDING').length, c: 'blue' }, { label: 'Approved', v: requisitions.filter((r) => r.orders[0]?.status === 'APPROVED').length, c: 'green' }].map((item) => (
        <Card tone={item.c} className="relative flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center [&>*]:relative [&>*]:z-10 after:pointer-events-none after:absolute after:-top-12 after:left-1/2 after:size-28 after:-translate-x-1/2 after:rounded-full after:bg-white/55 after:blur-xl" key={item.label}>
          <div><div className="font-['Outfit',sans-serif] text-[22px] font-bold leading-none text-[#0f1c16]">{item.v}</div><div className="mt-1 text-[12px] font-medium text-[#7a9185]">{item.label}</div></div>
        </Card>
      ))}
    </div>
  );

  return (
    <PageContainer loading={pageLoading}
      cap="PRODUCTION"
      title="FM Production Requisitions"
      description="Auto-scale recipe formulations for target production quantities. RM requirement lines are calculated from the recipe."
      actions={<Button variant="primary" onClick={() => { setEditingGroup(null); setItems([emptyItem()]); setPlannedStartDate(''); setAssignedManagerId(''); setOpen(true); }}><Plus size={16} /> New Production Requisition</Button>}
      headerContent={summaryCards}
   >

      <Card className="p-0">
        <div className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <h2>Production Requisition Register</h2>
          <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] w-full sm:max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]"><Search size={14} /><input placeholder="Search orders…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto">
          <DataTable minRows={5} columns={["Requisition #","Recipe","FG Product","Target Qty","RM Lines","Status","Planned Start","Actions"]} empty={filtered.length === 0 && <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70"><div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Factory size={28} /></div><b>No production orders yet</b></div>}>
              {filtered.map(({ number, orders }) => {
                const po = orders[0];
                const totalTarget = orders.reduce((sum, order) => sum + Number(order.targetQty), 0);
                const totalMaterials = orders.reduce((sum, order) => sum + order.lines.length, 0);
                const isExpanded = expanded.has(number);
                return (
                  <Fragment key={number}>
                    <tr>
                      <td><button type="button" className="flex items-center gap-2 text-left" onClick={() => toggleExpanded(number)}>{isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<span><strong className="block font-mono text-[#0d3b2e]">{number}</strong><small className="text-[#7a9185]">{orders.length} FG product{orders.length === 1 ? '' : 's'}</small></span></button></td>
                      <td>{orders.length} linked recipe{orders.length === 1 ? '' : 's'}</td>
                      <td>{orders.length} finished good{orders.length === 1 ? '' : 's'}</td>
                      <td><strong>{totalTarget.toLocaleString()}</strong> kg</td>
                      <td>{totalMaterials} materials</td>
                      <td>{statusBadge(po.status)}</td>
                      <td className="text-[12px] text-[#7a9185]">{po.plannedStartDate ? new Date(po.plannedStartDate).toLocaleDateString('en-GB') : ''}</td>
                      <td><div className="flex gap-1"><Button size="sm" variant="secondary" className="size-9 min-h-9 p-0" title="View report" onClick={() => { setSelectedGroup({ number, orders }); setDetailExpanded(new Set()); }}><Eye size={15}/></Button><Button size="sm" variant="secondary" className="size-9 min-h-9 p-0" title="Print requisition" onClick={() => printGroup({ number, orders })}><Printer size={15}/></Button>{isManager && <Button size="sm" variant="secondary" className="size-9 min-h-9 p-0" title="Edit requisition" onClick={() => editGroup({ number, orders })}><Pencil size={15}/></Button>}{isManager && <Button size="sm" variant="danger" className="size-9 min-h-9 p-0" disabled={orders.some((order) => (order.issues?.length ?? 0) > 0)} title={orders.some((order) => (order.issues?.length ?? 0) > 0) ? "Cannot delete: linked to Dispatch RM" : "Delete requisition"} onClick={() => setDeletingGroup({ number, orders })}><Trash2 size={15}/></Button>}{canApproveGroup(orders) && <Button size="sm" variant="accent" className="size-9 min-h-9 p-0" title="Review for approval" onClick={() => { setSelectedGroup({ number, orders }); setDetailExpanded(new Set()); }}><CheckCircle2 size={15}/></Button>}</div></td>
                    </tr>
                    {isExpanded && <tr><td colSpan={8} className="bg-[#f8faf7]! p-3!"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{orders.map((order) => <div key={order.id} className="rounded-md border border-[#dce5dc] bg-white p-3"><strong className="block text-[#173b30]">{order.fgProduct?.name ?? '-'}</strong><span className="mt-1 block text-xs text-[#708278]">{order.recipe?.name ?? '-'} | {Number(order.targetQty).toLocaleString()} kg | {Number(order.expectedWastePercent).toLocaleString()}% waste</span></div>)}</div></td></tr>}
                  </Fragment>
                );
              })}
            </DataTable>
          
        </div>
      </Card>

      {open && (
        <Modal extraWide fixedHeight title={editingGroup ? `Edit Requisition ${editingGroup.number}` : 'New Production Requisition'} description="Select finished goods, confirm their linked recipes, and review calculated raw-material requirements before submission." onClose={() => { setOpen(false); setPreviewIndex(null); }}
          footer={<><Button variant="secondary" onClick={() => { setOpen(false); setPreviewIndex(null); }}>Cancel</Button>{!editingGroup && <Button variant="secondary" onClick={()=>void submit(false)} disabled={!canCreate}>Save Draft</Button>}<Button variant="primary" onClick={()=>void submit(true)} disabled={!canCreate} >{editingGroup ? 'Save & Resubmit' : 'Submit Requisition'}</Button></>}
        >
          <div className="mb-4 grid max-w-2xl grid-cols-2 gap-3 max-[650px]:grid-cols-1"><FormField label="Planned Start" required><Input type="date" value={plannedStartDate} onChange={(event) => setPlannedStartDate(event.target.value)} /></FormField><FormField label="Assigned Manager" required><Dropdown value={assignedManagerId} onChange={(event) => setAssignedManagerId(event.target.value)}><option value="">Select manager</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.fullName}</option>)}</Dropdown></FormField></div>
          <div className="summary-grid mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-md border border-[#dfe6dc] bg-[#f8faf7] p-3"><span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#7a9185]">Finished goods</span><strong className="mt-1 block text-lg">{items.filter((item) => item.finishedProductId).length}</strong></div>
            <div className="rounded-md border border-[#dfe6dc] bg-[#f8faf7] p-3"><span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#7a9185]">Total production input</span><strong className="mt-1 block text-lg">{itemPreview.reduce((sum, item) => sum + item.targetKg, 0).toLocaleString()} kg</strong></div>
            <div className="rounded-md border border-[#cfe4d5] bg-[#edf8ef] p-3"><span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#39704f]">Expected FG output</span><strong className="mt-1 block text-lg text-[#176b4b]">{itemPreview.reduce((sum, item) => sum + item.predictedOutput, 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} kg</strong></div>
            <div className="rounded-md border border-[#dfd4b9] bg-[#fff8e9] p-3"><span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#916719]">Total RM needed</span><strong className="mt-1 block text-lg text-[#9a650d]">{totalRmNeeded.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong></div>
          </div>
          <div className="overflow-x-auto rounded-md border border-[#d8e0d7]">
            <div className="min-w-0 lg:min-w-[1210px]">
              <div className="hidden grid-cols-[minmax(300px,_1fr)_205px_145px_135px_135px_70px_40px] items-center gap-3 bg-[#f2f5f3] lg:grid px-4 py-3 text-[10.5px] font-bold uppercase tracking-[.07em] text-[#53665c]">
                <span>Product</span><span>Linked recipe</span><span>Target (kg)</span><span>Waste %</span><span>Expected (kg)</span><span className="text-center">RM Details</span><span />
              </div>
              <div className="min-h-64 max-h-64 overflow-y-auto">
              {itemPreview.map((item, index) => {
                const duplicate = item.finishedProductId && items.some((other, otherIndex) => otherIndex !== index && other.finishedProductId === item.finishedProductId);
                return <div key={index} className="grid grid-cols-1 items-center gap-3 border-t lg:grid-cols-[minmax(300px,_1fr)_205px_145px_135px_135px_70px_40px] border-[#e0e5dd] bg-white px-4 py-3">
                  <Dropdown aria-label="Product" value={item.finishedProductId} onChange={(event) => { const linkedRecipe = recipes.find((recipe) => recipe.finishedProductId === event.target.value); setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, finishedProductId: event.target.value, recipeId: linkedRecipe?.id ?? "" } : line)); }}>
                    <option value="">Select product</option>
                    {finishedGoods.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </Dropdown>
                  <Input aria-label="Linked recipe" readOnly value={item.recipe?.code ?? (item.finishedProductId ? "No linked recipe" : "")} className={item.finishedProductId && !item.recipe ? "border-red-200! bg-red-50! text-red-700!" : "bg-[#f4f6f2]! text-[#52675d]!"} />
                  <Input aria-label="Target quantity in kilograms" type="number" min="0.001" step="0.001" placeholder="kg" value={item.targetQty} onChange={(event) => setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, targetQty: event.target.value } : line))} />
                  <Input aria-label="Expected waste percentage" type="number" min="0" max="50" step="0.01" placeholder="Waste %" value={item.expectedWastePercent} onChange={(event) => setItems(items.map((line, lineIndex) => lineIndex === index ? { ...line, expectedWastePercent: event.target.value } : line))} />
                  <div className="rounded-md border border-[#d5e6d7] bg-[#edf8ef] px-3 py-2.5 text-center"><strong className="text-[14px] text-[#176b4b]">{item.predictedOutput.toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong></div>
                  <Button type="button" size="sm" variant="secondary" className="size-10 p-0" title="View RM details" aria-label={`View RM details for product ${index + 1}`} disabled={!item.recipe} onClick={() => setPreviewIndex(index)}><Eye size={15} /></Button>
                  <Button type="button" size="sm" variant="danger" className="size-10 p-0" disabled={items.length === 1} onClick={() => setItems(items.filter((_, lineIndex) => lineIndex !== index))} title="Remove finished good"><Trash2 size={15} /></Button>
                  {duplicate && <div className="-mt-1 lg:col-span-7 text-[11px] font-medium text-[#c34838]">This finished good is already included.</div>}
                </div>;
              })}
              <div className="grid grid-cols-1 gap-3 border-t border-[#e0e5dd] bg-[#fafbf8] px-4 py-3 lg:grid-cols-[minmax(300px,_1fr)_205px_145px_135px_135px_70px_40px]">
                <Button type="button" className="w-full justify-center lg:col-span-5" variant="secondary" onClick={() => setItems([...items, emptyItem()])}><Plus size={15} /> Add Finished Good</Button>
              </div>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-[#d8e0d7] bg-white p-4">
            <div className="mb-3"><strong className="text-[13px] text-[#173b30]">Utilities and packaging</strong><p className="text-[11px] text-[#75887e]">Enter quantity and requisition rate for each utility.</p></div>
            <div className="space-y-2">{utilities.map((line, index) => <div key={index} className="grid grid-cols-[1fr_180px_42px] gap-2 max-[650px]:grid-cols-1"><Dropdown value={line.productId} onChange={event => setUtilities(utilities.map((value, lineIndex) => lineIndex === index ? { ...value, productId: event.target.value } : value))}><option value="">Select product</option>{utilityProducts.map(product => <option key={product.id} value={product.id} disabled={utilities.some((other, otherIndex) => otherIndex !== index && other.productId === product.id)}>{product.sku} · {product.name}</option>)}</Dropdown><Input type="number" min="0" step="0.001" placeholder="Quantity" value={line.quantity} onChange={event => setUtilities(utilities.map((value, lineIndex) => lineIndex === index ? { ...value, quantity: event.target.value } : value))}/><Button type="button" variant="danger" className="size-10 p-0" disabled={utilities.length === 1} onClick={() => setUtilities(utilities.filter((_, lineIndex) => lineIndex !== index))}><Trash2 size={14}/></Button></div>)}<div className="grid grid-cols-[1fr_180px_42px] gap-2 border-t border-[#e0e5dd] pt-3 max-[650px]:grid-cols-1"><Button type="button" className="col-span-2 w-full justify-center max-[650px]:col-span-1" variant="secondary" onClick={() => setUtilities([...utilities, { productId: '', quantity: '' }])}><Plus size={14}/> Add Utility</Button></div></div>
          </div>
          {combinedRmBreakdown.length > 0 && <div className="mt-4 overflow-x-auto rounded-md border border-[#d8e0d7] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#dfe5dd] bg-[#f5f7f2] px-4 py-3"><div><strong className="text-[13px] text-[#173b30]">Combined Raw Material Breakdown</strong><p className="mt-0.5 text-[11px] text-[#75887e]">Aggregated requirement for every finished good in this requisition.</p></div><strong className="text-[14px] text-[#9a650d]">{totalRmNeeded.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg total</strong></div>
            <div className="grid min-w-[720px] grid-cols-[minmax(220px,1.2fr)_minmax(260px,1.5fr)_120px_100px] gap-3 border-b border-[#e0e5dd] bg-[#fafbf8] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.07em] text-[#66796f]"><span>Raw material</span><span>Used by finished goods</span><span className="text-right">Required</span><span className="text-right">Share</span></div>
            <div className="max-h-52 overflow-y-auto">
              {combinedRmBreakdown.map((material) => <div key={material.id} className="grid min-w-[720px] grid-cols-[minmax(220px,1.2fr)_minmax(260px,1.5fr)_120px_100px] items-center gap-3 border-b border-[#edf0eb] px-4 py-2.5 text-[12px] last:border-b-0">
                <div className="min-w-0"><strong className="block truncate text-[#243b30]">{material.name}</strong>{material.sku && <span className="block truncate text-[10px] text-[#829087]">{material.sku}</span>}</div>
                <span className="truncate text-[#5f7468]" title={[...material.finishedGoods].join(', ')}>{[...material.finishedGoods].join(', ')}</span>
                <strong className="text-right text-[#0d3b2e]">{material.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong>
                <span className="text-right font-semibold text-[#6b7f74]">{totalRmNeeded > 0 ? ((material.quantity / totalRmNeeded) * 100).toFixed(2) : '0.00'}%</span>
              </div>)}
            </div>
          </div>}
          {previewIndex !== null && itemPreview[previewIndex]?.recipe && (() => {
            const preview = itemPreview[previewIndex];
            const materialLines = preview.recipe!.ingredients.map((ingredient) => ({ ...ingredient, quantity: Number(ingredient.quantityPerTon) * preview.targetKg / 1000 }));
            return <div className="fixed inset-0 z-120 flex justify-end bg-[#07130e]/35" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewIndex(null); }}>
              <aside className="flex h-full w-full max-w-xl flex-col border-l border-[#d9e1d8] bg-[#fffdf8] shadow-[-18px_0_55px_rgba(5,20,14,0.22)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#e2e4dc] px-6 py-5">
                  <div><span className="text-[10px] font-bold uppercase tracking-[.1em] text-[#53806b]">Raw material preview</span><h3 className="mt-1 font-['Outfit',sans-serif] text-xl font-bold">{preview.recipe!.name}</h3><p className="mt-1 text-xs text-[#6f8378]">Linked recipe: {preview.recipe!.code} · Target: {preview.targetKg.toLocaleString()} kg</p></div>
                  <Button type="button" variant="secondary" size="sm" className="size-10 p-0" onClick={() => setPreviewIndex(null)} aria-label="Close raw material drawer">×</Button>
                </div>
                <div className="grid grid-cols-2 gap-3 border-b border-[#e2e4dc] bg-[#f6f8f3] px-6 py-4">
                  <div><span className="text-[10px] font-bold uppercase text-[#7a9185]">Total RM</span><strong className="mt-1 block text-lg">{materialLines.reduce((sum, line) => sum + line.quantity, 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong></div>
                  <div><span className="text-[10px] font-bold uppercase text-[#7a9185]">Materials</span><strong className="mt-1 block text-lg">{materialLines.length}</strong></div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="grid gap-2">
                    {materialLines.map((line) => <div key={line.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_85px_125px] sm:gap-3 rounded-md border border-[#dfe6dc] bg-white px-4 py-3">
                      <div className="min-w-0"><strong className="block truncate text-[13px]">{line.rawMaterial?.name ?? 'Raw material'}</strong><span className="block truncate text-[10.5px] text-[#7a9185]">{line.rawMaterial?.sku ?? ''}</span></div>
                      <span className="text-right text-xs font-semibold text-[#52675d]">{Number(line.percentage).toFixed(2)}%</span>
                      <strong className="text-right text-[13px] text-[#0d3b2e]">{line.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong>
                    </div>)}
                  </div>
                </div>
                <div className="border-t border-[#e2e4dc] p-4 text-right"><Button type="button" variant="primary" onClick={() => setPreviewIndex(null)}>Done</Button></div>
              </aside>
            </div>;
          })()}
        </Modal>
      )}

      {deletingGroup && (
        <Modal title="Delete requisition?" onClose={() => { if (!deletePending) setDeletingGroup(null); }}
          footer={<><Button variant="secondary" disabled={deletePending} onClick={() => setDeletingGroup(null)}>Cancel</Button><Button variant="danger" disabled={deletePending} onClick={() => void deleteGroup(deletingGroup)}>{deletePending ? 'Deleting...' : 'Delete Requisition'}</Button></>}>
          <div className="flex items-start gap-3 py-2">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600"><TriangleAlert size={19}/></div>
            <p className="pt-2 text-sm text-[#53665c]">Delete <strong>{deletingGroup.number}</strong>? It will be permanently removed from the register. Requisitions linked to Dispatch RM cannot be deleted.</p>
          </div>
        </Modal>
      )}

      {selectedGroup && (() => {
        const { number, orders } = selectedGroup;
        const totalTarget = orders.reduce((sum, order) => sum + Number(order.targetQty), 0);
        const totalExpected = orders.reduce((sum, order) => sum + Number(order.targetQty) * (1 - Number(order.expectedWastePercent) / 100), 0);
        return (
          <Modal extraWide fixedHeight title={`Requisition ${number}`} description={`${orders.length} finished goods | Assigned manager: ${orders[0]?.assignedManager?.fullName ?? 'Not assigned'}`} onClose={() => setSelectedGroup(null)}
            footer={<>{canApproveGroup(orders) && <Button variant="danger" disabled={rejecting || approving} onClick={() => void rejectGroup(orders)}><XCircle size={14}/> {rejecting ? 'Rejecting...' : 'Reject'}</Button>}{canApproveGroup(orders) && <Button variant="primary" disabled={approving || rejecting} onClick={() => void approveGroup(orders)}><CheckCircle2 size={14}/> {approving ? 'Approving...' : 'Approve'}</Button>}<Button variant="secondary" onClick={() => setSelectedGroup(null)}>Close</Button></>}>
            <div className="mb-4 grid grid-cols-3 gap-3 max-[700px]:grid-cols-1">
              <div className="rounded-md border border-[#dfe6dc] bg-[#f8faf7] p-3"><span className="text-[10px] font-bold uppercase text-[#7a9185]">Status</span><div className="mt-2">{statusBadge(orders[0]?.status)}</div></div>
              <div className="rounded-md border border-[#dfe6dc] bg-[#f8faf7] p-3"><span className="text-[10px] font-bold uppercase text-[#7a9185]">Total Target</span><strong className="mt-1 block text-lg">{totalTarget.toLocaleString()} kg</strong></div>
              <div className="rounded-md border border-[#cfe4d5] bg-[#edf8ef] p-3"><span className="text-[10px] font-bold uppercase text-[#39704f]">Expected Output</span><strong className="mt-1 block text-lg text-[#176b4b]">{totalExpected.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong></div>
            </div>
            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
              {orders.map((order, index) => {
                const target = Number(order.targetQty);
                const expected = target * (1 - Number(order.expectedWastePercent) / 100);
                return <section key={order.id} className="overflow-hidden rounded-md border border-[#d8e0d7]">
                  <button type="button" className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-[#dfe5dd] bg-[#f2f6f2] px-4 py-3 text-left" onClick={() => setDetailExpanded((current) => { const next = new Set(current); next.has(order.id) ? next.delete(order.id) : next.add(order.id); return next; })}>
                    <div className="flex items-center gap-2">{detailExpanded.has(order.id) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<div><span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#71847a]">FM Product {String(index + 1).padStart(2, '0')}</span><h3 className="mt-0.5 font-bold text-[#173b30]">{order.fgProduct?.name ?? '-'}</h3><p className="text-xs text-[#6f8378]">Recipe: {order.recipe?.name ?? '-'}</p></div></div>
                    <div className="flex gap-5 text-right text-xs"><div><span className="block text-[#7a9185]">Target</span><strong>{target.toLocaleString()} kg</strong></div><div><span className="block text-[#7a9185]">Expected</span><strong className="text-[#176b4b]">{expected.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg</strong></div><div><span className="block text-[#7a9185]">Waste</span><strong>{Number(order.expectedWastePercent).toLocaleString()}%</strong></div></div>
                  </button>
                  {detailExpanded.has(order.id) && <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-[#fafbf8] text-[10px] uppercase text-[#66796f]"><tr><th className="px-4 py-2">Raw Material</th><th className="px-4 py-2">SKU</th><th className="px-4 py-2 text-right">Required (kg)</th></tr></thead><tbody>{order.lines.map((line) => <tr key={line.id} className="border-t border-[#edf0eb]"><td className="px-4 py-2">{line.rawMaterial?.name ?? '-'}</td><td className="px-4 py-2 font-mono text-[#7a9185]">{line.rawMaterial?.sku ?? '-'}</td><td className="px-4 py-2 text-right font-semibold">{Number(line.requiredQty).toLocaleString()}</td></tr>)}</tbody></table></div>}
                </section>;
              })}
            </div>
          </Modal>
        );
      })()}

      {selected && (
        <Modal title={`Order ${selected.number} - RM Requirements`} description={`Recipe: ${selected.recipe?.name ?? '-'} | Target: ${Number(selected.targetQty).toLocaleString()} kg`} onClose={() => setSelected(null)} wide footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
          <div className="mb-5 grid grid-cols-3 gap-3 max-[650px]:grid-cols-1">
            <div className="rounded-lg border border-[#dfe6dc] bg-[#f8faf7] px-4 py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a9185]">Production Input</span>
              <strong className="mt-1 block text-lg text-[#263b31]">{Number(selected.targetQty).toLocaleString()} kg</strong>
            </div>
            <div className="rounded-lg border border-[#eadcb9] bg-[#fff8e9] px-4 py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a6a17]">Predicted Waste ({selectedWastePercent.toFixed(2)}%)</span>
              <strong className="mt-1 block text-lg text-[#b06f08]">{selectedWasteKg.toLocaleString(undefined, { maximumFractionDigits: 4 })} kg</strong>
            </div>
            <div className="rounded-lg border border-[#cfe4d5] bg-[#edf8ef] px-4 py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#39704f]">Expected FG Output</span>
              <strong className="mt-1 block text-lg text-[#0d5b3b]">{selectedExpectedOutputKg.toLocaleString(undefined, { maximumFractionDigits: 4 })} kg</strong>
            </div>
          </div>
          <div className="overflow-x-auto">
            <DataTable columns={["Raw Material","SKU","Required Qty","Issued Qty","Remaining","Progress"]}>
                {selected.lines.map((l, i) => {
                  const pct = l.requiredQty > 0 ? Math.min((l.issuedQty / l.requiredQty) * 100, 100) : 0;
                  return (
                    <tr key={i}>
                      <td>{l.rawMaterial?.name ?? '—'}</td>
                      <td><span className="text-[11px] font-mono text-[#7a9185]">{l.rawMaterial?.sku}</span></td>
                      <td><strong>{Number(l.requiredQty).toLocaleString()}</strong></td>
                      <td>{Number(l.issuedQty).toLocaleString()}</td>
                      <td className={twMerge("font-semibold", (l.issuedQty >= l.requiredQty ? "text-[#1b8f5a]" : "text-[#c87d12]"))}>{Math.max(0, l.requiredQty - l.issuedQty).toLocaleString()}</td>
                      <td className="min-w-30">
                        <div className="h-1.5 rounded-[4px] bg-[#e0e5dd] overflow-hidden"><div className="h-full rounded-[4px] [background:linear-gradient(90deg,_#a8d548,_#1a5c45)] [transition:width_0.5s_ease] w-[var(--meter-width)]" style={{ "--meter-width": `${pct}%` } as CSSProperties} /></div>
                        <div className="text-[11px] text-[#7a9185] mt-0.75">{pct.toFixed(0)}%</div>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
