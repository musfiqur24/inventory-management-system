import { useEffect, useState } from "react";
import { Eye, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { PageContainer } from "../../../components/ui/PageContainer";
import { Card } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { FormField } from "../../../components/ui/FormField";
import { Dropdown } from "../../../components/ui/Dropdown";
import { Input } from "../../../components/ui/Input";
import { statusBadge } from "../../../components/ui/Badge";
import { appToast } from "../../../components/ui/Toast";
import { salesOrderApi, type Assignee, type Customer, type FinishedProduct, type SalesOrder, type Uom } from "./api";

type DraftLine = { productId: string; uomId: string; quantity: string; unitPrice: string };
const blankLine = (): DraftLine => ({ productId: "", uomId: "", quantity: "", unitPrice: "" });
const money = (value: number) => "BDT " + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SalesOrdersPage() {
  const [rows, setRows] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: "", assignedPersonId: "" });
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);

  const load = async () => {
    setLoading(true);
    try {
      const [orderRows, customerRows, assigneeRows, productRows, uomRows] = await Promise.all([
        salesOrderApi.list(), salesOrderApi.customers(), salesOrderApi.assignees(), salesOrderApi.products(), salesOrderApi.uoms(),
      ]);
      setRows(orderRows); setCustomers(customerRows); setAssignees(assigneeRows); setProducts(productRows); setUoms(uomRows);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : "Unable to load sales orders.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const reset = () => {
    setForm({ customerId: "", assignedPersonId: "" });
    setLines([blankLine()]);
  };
  const openCreate = () => { reset(); setOpen(true); };
  const setLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  const chooseProduct = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId);
    setLine(index, { productId, uomId: product?.baseUomId ?? "" });
  };
  const grandTotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);
  const complete = Boolean(form.customerId && form.assignedPersonId && lines.length && lines.every((line) => line.productId && line.uomId && Number(line.quantity) > 0 && Number(line.unitPrice) > 0));

  const submit = async () => {
    if (!complete || saving) return;
    setSaving(true);
    try {
      await salesOrderApi.create({
        ...form,
        lines: lines.map((line) => ({ productId: line.productId, uomId: line.uomId, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })),
      });
      setOpen(false); reset(); await load(); appToast.success("Sales order created successfully.");
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : "Unable to create sales order.");
    } finally {
      setSaving(false);
    }
  };

  return <PageContainer loading={loading} cap="SALES" title="Sales Orders" description="Capture customer demand, assign responsibility, and price finished-material order lines." actions={<Button variant="primary" onClick={openCreate}><Plus size={16}/> New Sales Order</Button>}>
    <div className="summary-grid mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card tone="sage" className="text-center"><strong className="text-2xl">{rows.length}</strong><span className="mt-1 block text-sm text-[#73877c]">Total Orders</span></Card>
      <Card tone="blue" className="text-center"><strong className="text-2xl">{rows.filter((row) => row.status === "SUBMITTED").length}</strong><span className="mt-1 block text-sm text-[#73877c]">Submitted</span></Card>
      <Card tone="sand" className="text-center"><strong className="text-2xl">{rows.filter((row) => row.status === "APPROVED").length}</strong><span className="mt-1 block text-sm text-[#73877c]">Approved</span></Card>
      <Card className="text-center"><strong className="text-xl">{money(rows.reduce((sum, row) => sum + Number(row.totalValue ?? 0), 0))}</strong><span className="mt-1 block text-sm text-[#73877c]">Order Value</span></Card>
    </div>
    <Card className="p-0">
      <div className="border-b border-[#e0e5dd] p-5"><h2 className="font-semibold">Sales Order Register</h2></div>
      <DataTable columns={["Sales Order", "Customer", "Assigned Person", "Products", "Total Price (BDT)", "Status", "Order Date", "Actions"]} empty={!rows.length && <div className="py-12 text-center text-[#73877c]"><ShoppingCart className="mx-auto mb-3"/><b>No sales orders yet</b></div>}>
        {rows.map((order) => <tr key={order.id}><td><strong className="font-mono text-[#0d3b2e]">{order.number}</strong></td><td>{order.customer?.name ?? "-"}</td><td>{order.assignedPerson?.fullName ?? "-"}</td><td>{order.lines.length} product{order.lines.length === 1 ? "" : "s"}</td><td className="font-semibold">{money(Number(order.totalValue ?? 0))}</td><td>{statusBadge(order.status)}</td><td>{new Date(order.orderedAt).toLocaleDateString("en-GB")}</td><td><Button size="sm" variant="secondary" className="size-9 min-h-9 p-0" title="View sales order" onClick={() => setSelected(order)}><Eye size={15}/></Button></td></tr>)}
      </DataTable>
    </Card>

    {open && <Modal title="Create Sales Order" description="Select the customer and assigned person, then add finished-material products." onClose={() => { if (!saving) setOpen(false); }} extraWide fixedHeight footer={<><Button disabled={saving} onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!complete || saving} onClick={() => void submit()}>{saving ? "Creating..." : "Create Sales Order"}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Customer Name" required><Dropdown value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</Dropdown></FormField>
        <FormField label="Assigned Person" required><Dropdown value={form.assignedPersonId} onChange={(event) => setForm({ ...form, assignedPersonId: event.target.value })}><option value="">Select assigned person</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.fullName} - {person.email}</option>)}</Dropdown></FormField>
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-[#d7dfd6]">
        <div className="min-w-[850px]">
          <div className="grid grid-cols-[minmax(260px,1.7fr)_150px_170px_170px_52px] gap-3 bg-[#eef4ef] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#53665c]"><span>FM Product</span><span>Quantity</span><span>Per Unit Price (BDT)</span><span>Total Price (BDT)</span><span/></div>
          {lines.map((line, index) => {
            const product = products.find((item) => item.id === line.productId);
            const uom = uoms.find((item) => item.id === line.uomId);
            const total = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
            return <div key={index} className="grid grid-cols-[minmax(260px,1.7fr)_150px_170px_170px_52px] items-center gap-3 border-t border-[#e0e5dd] bg-white px-4 py-3">
              <Dropdown aria-label={`FM product row ${index + 1}`} value={line.productId} onChange={(event) => chooseProduct(index, event.target.value)}><option value="">Search FM product</option>{products.map((item) => <option key={item.id} value={item.id} disabled={lines.some((row, rowIndex) => rowIndex !== index && row.productId === item.id)}>{item.name} - {item.sku}</option>)}</Dropdown>
              <div className="relative"><Input aria-label={`Quantity for ${product?.name ?? "product"}`} type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })}/><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#73877c]">{uom?.code}</span></div>
              <Input aria-label={`Price for ${product?.name ?? "product"}`} type="number" min="0.01" step="0.01" value={line.unitPrice} onChange={(event) => setLine(index, { unitPrice: event.target.value })}/>
              <strong className="text-right">{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              <Button variant="danger" size="sm" className="size-9 min-h-9 p-0" disabled={lines.length === 1} title="Remove product" onClick={() => setLines((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={15}/></Button>
            </div>;
          })}
          <div className="flex items-center justify-between border-t border-[#d7dfd6] bg-[#f8faf7] px-4 py-4"><Button size="sm" variant="secondary" onClick={() => setLines((current) => [...current, blankLine()])}><Plus size={15}/> Add Product</Button><div className="text-right"><span className="text-xs font-semibold uppercase text-[#73877c]">Grand Total</span><strong className="ml-4 text-xl text-[#0d3b2e]">{money(grandTotal)}</strong></div></div>
        </div>
      </div>
    </Modal>}

    {selected && <Modal title={selected.number} description={`${selected.customer?.name ?? "-"} | Assigned to ${selected.assignedPerson?.fullName ?? "-"}`} onClose={() => setSelected(null)} extraWide footer={<Button onClick={() => setSelected(null)}>Close</Button>}>
      <div className="overflow-x-auto rounded-lg border border-[#d7dfd6]"><table className="w-full min-w-[700px] text-sm"><thead className="bg-[#eef4ef]"><tr><th className="p-3 text-left">FM Product</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-right">Unit Price</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{selected.lines.map((line, index) => { const qty=Number(line.quantity), price=Number(line.unitPrice??0); return <tr key={line.id??index} className="border-t"><td className="p-3"><b>{line.product?.name ?? "-"}</b><small className="block text-[#73877c]">{line.product?.sku}</small></td><td className="p-3 text-right">{qty.toLocaleString()} {line.uom?.code}</td><td className="p-3 text-right">{money(price)}</td><td className="p-3 text-right font-semibold">{money(qty*price)}</td></tr>; })}</tbody><tfoot><tr className="border-t-2"><td colSpan={3} className="p-3 text-right font-bold">Grand Total</td><td className="p-3 text-right text-lg font-bold">{money(Number(selected.totalValue??0))}</td></tr></tfoot></table></div>
    </Modal>}
  </PageContainer>;
}
