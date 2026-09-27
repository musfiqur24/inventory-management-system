import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Factory,
  TrendingUp,
  Printer,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { api, selectedOrg } from "../../../shared/api/http";
import { usePageLoading } from "../../../shared/hooks/usePageLoading";
import { useToastMessage } from "../../../components/ui/Toast";
import { PageContainer } from "../../../components/ui/PageContainer";
import { Card } from "../../../components/ui/Card";
import { Tooltip } from "../../../components/ui/Tooltip";
import { printBatchReport } from "./batchPrint";
import { ConfirmationModal } from "../../../components/ui/ConfirmationModal";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { Dropdown } from "../../../components/ui/Dropdown";
import { TextArea } from "../../../components/ui/TextArea";
import { DataTable } from "../../../components/ui/DataTable";
import { statusBadge } from "../../../components/ui/Badge";

type Product = {
  id: string;
  sku: string;
  name: string;
  type: string;
  amount?: number;
};
type Order = {
  id: string;
  number: string;
  requisitionId?: string;
  fgProduct?: Product;
  lines?: {
    productId: string;
    product?: Product;
    category?: string;
    requiredQty: number;
    unitPrice?: number;
  }[];
};
type Line = {
  productId: string;
  description: string;
  category: string;
  quantity: string;
  unitPrice: string;
  lotCode?: string;
  targetQty?: number;
  expectedQty?: number;
  wastePercent?: number;
  locked?: boolean;
};
type Metrics = {
  rawMaterialCost: number;
  otherInputCost: number;
  operatingCost: number;
  totalCost: number;
  totalOutputQty: number;
  costPerKg: number;
  costPerTon: number;
  revenue: number;
  profit: number;
  profitPerTon: number;
  marginPercent: number;
  salesPosted: boolean;
};
type FinishedGood = {
  orderId: string;
  orderNumber: string;
  product?: Product;
  plannedQty: number;
  expectedQty: number;
  wastePercent: number;
};
type Batch = {
  id: string;
  batchNumber: string;
  requisitionId?: string;
  requisitionNumber?: string;
  status: string;
  plannedQty: number;
  actualQty: number;
  actualWastePct: number;
  completedAt?: string;
  productionOrder?: Order;
  productionOrders?: Order[];
  finishedGoods: FinishedGood[];
  fgProduct?: Product;
  inputLines: Line[];
  outputLines: Line[];
  costLines: Line[];
  metrics: Metrics;
};
const blank = (category = "RAW_MATERIAL"): Line => ({
  productId: "",
  description: "",
  category,
  quantity: "",
  unitPrice: "",
});
const money = (value: number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value || 0);
const amount = (value: number) =>
  new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export function ProductionBatchesPage() {
  const { user } = useAuth();
  const [loading, runLoad] = usePageLoading(),
    [, setMessage] = useToastMessage();
  const [rows, setRows] = useState<Batch[]>([]),
    [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [selected, setSelected] = useState<Batch | null>(null),
    [editing, setEditing] = useState<Batch | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Batch | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [form, setForm] = useState({
    productionOrderId: "",
    startedAt: "",
    completedAt: "",
    notes: "",
    inputs: [blank()],
    outputs: [blank("OUTPUT")],
    costs: [blank("OPERATING")],
  });
  const load = () =>
    runLoad(async () => {
      if (!selectedOrg()) return setMessage("Select an organisation first.");
      try {
        const [b, p] = await Promise.all([
          api<{ data: Batch[] }>("/batches"),
          api<{ data: Product[] }>("/products"),
        ]);
        setRows(b.data);
        setProducts(p.data);
      } catch (error: any) {
        setMessage(error.message);
      }
    });
  useEffect(() => {
    void load();
  }, []);
  const isManager = user?.organizations.find((organization) => organization.id === selectedOrg())?.role.code === "MANAGER";
  const totals = useMemo(
    () => ({
      input: form.inputs
        .filter((line) => line.category === "RAW_MATERIAL")
        .reduce((s, x) => s + Number(x.quantity), 0),
      output: form.outputs.reduce((s, x) => s + Number(x.quantity), 0),
    }),
    [form],
  );
  const reset = () =>
    setForm({
      productionOrderId: "",
      startedAt: "",
      completedAt: "",
      notes: "",
      inputs: [blank()],
      outputs: [blank("OUTPUT")],
      costs: [blank("OPERATING")],
    });
  const setLines = (key: "inputs" | "outputs" | "costs", lines: Line[]) =>
    setForm((current) => ({ ...current, [key]: lines }));
  const editBatch = (batch: Batch) => {
    const order = batch.productionOrder;
    if (!order) return;
    setEditing(batch);
    setForm({
      productionOrderId: order.id,
      startedAt: "",
      completedAt: "",
      notes: "",
      inputs: order.lines?.length
        ? order.lines.map((line) => ({
            productId: line.productId,
            description: line.product?.name ?? "",
            category:
              line.category ??
              (line.product?.type === "PACKAGING"
                ? "PACKAGING"
                : "RAW_MATERIAL"),
            quantity: String(line.requiredQty ?? ""),
            unitPrice: String(line.unitPrice ?? 0),
            locked: true,
          }))
        : [blank()],
      outputs: batch.finishedGoods?.length
        ? batch.finishedGoods.map((item) => ({
            productId: item.product?.id ?? "",
            description: item.product?.name ?? "",
            category: "OUTPUT",
            quantity: "",
            unitPrice: String(item.product?.amount ?? ""),
            lotCode: "",
            targetQty: item.plannedQty,
            expectedQty: item.expectedQty,
            wastePercent: item.wastePercent,
            locked: true,
          }))
        : order.fgProduct
          ? [
              {
                productId: order.fgProduct.id,
                description: order.fgProduct.name,
                category: "OUTPUT",
                quantity: "",
                unitPrice: String(order.fgProduct.amount ?? ""),
                lotCode: "",
                locked: true,
              },
            ]
          : [blank("OUTPUT")],
      costs: [blank("OPERATING")],
    });
    setOpen(true);
  };
  const submit = async () => {
    const valid = (line: Line) =>
      Boolean(
        line.productId && line.description.trim() && Number(line.quantity) >= 0,
      );
    if (
      !form.productionOrderId ||
      !form.inputs.every(valid) ||
      !form.outputs.every(valid)
    )
      return setMessage("Select an order and complete every line.");
    setSaving(true);
    try {
      const normalize = (line: Line) => ({
        ...line,
        productId: line.productId || null,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice) || 0,
      });
      await api(editing ? "/batches/" + editing.id : "/batches", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          startedAt: form.startedAt || undefined,
          completedAt: form.completedAt || undefined,
          inputs: form.inputs.map(normalize),
          outputs: form.outputs.map(normalize),
          costs: [],
        }),
      });
      setOpen(false);
      setEditing(null);
      reset();
      setMessage(
        "Finished-good details saved. Batch is Ready for FM Store receipt.",
      );
      await load();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };
  const approveBatch = async (batch: Batch) => {
    if (actionPending) return;
    setActionPending(true);
    try {
      await api('/batches/' + batch.id + '/approve', { method: 'POST' });
      setMessage('Batch approved and ready for FM Store receipt.');
      await load();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setActionPending(false);
    }
  };
  const deleteBatch = async () => {
    if (!deleting || actionPending) return;
    setActionPending(true);
    try {
      await api('/batches/' + deleting.id, { method: 'DELETE' });
      setDeleting(null);
      setMessage('Batch and linked RM dispatch deleted. Dispatched materials were returned to RM Store.');
      await load();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setActionPending(false);
    }
  };
  const outputEditor = () => (
    <Card className="overflow-hidden p-0">
      <div className="px-4 py-4">
        <h3 className="text-sm font-bold">Finished material outputs</h3>
        <p className="text-xs text-[#7a9185]">
          Enter the actual finished quantity and per kg price. Requisition
          products are locked.
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[2fr_.7fr_.9fr_.9fr_.8fr_.9fr_42px] items-center gap-2 bg-[#f2f5f3] px-4 py-2 text-[10px] font-bold uppercase text-[#53665c]">
            <span>FM product</span>
            <span className="px-2">Target</span>
            <span className="px-2">Expected (waste applied)</span>
            <span>Ready Received FM</span>
            <span>Per kg price</span>
            <span className="px-2 text-right">Total price</span>
            <span />
          </div>
          {form.outputs.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-[2fr_.7fr_.9fr_.9fr_.8fr_.9fr_42px] items-center gap-2 border-t border-[#e0e5dd] px-4 py-2"
            >
              <Dropdown
                value={line.productId}
                disabled={line.locked}
                onChange={(e) => {
                  const product = products.find((p) => p.id === e.target.value);
                  const next = [...form.outputs];
                  next[index] = {
                    ...line,
                    productId: e.target.value,
                    description: product?.name ?? "",
                    unitPrice: String(product?.amount ?? ""),
                  };
                  setLines("outputs", next);
                }}
              >
                <option value="">Select product</option>
                {products
                  .filter(
                    (p) =>
                      p.type === "FINISHED_GOOD" || p.type === "BY_PRODUCT",
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name}
                    </option>
                  ))}
              </Dropdown>
              <span className="px-2 text-sm font-semibold">
                {line.targetQty == null
                  ? "-"
                  : Number(line.targetQty).toLocaleString() + " kg"}
              </span>
              <span className="whitespace-nowrap px-2 text-sm font-semibold text-[#1b7250]">
                {line.expectedQty == null ? (
                  "-"
                ) : (
                  <>
                    {Number(line.expectedQty).toLocaleString()} kg{" "}
                    <small className="font-normal text-[#7a9185]">
                      ({line.wastePercent}% waste)
                    </small>
                  </>
                )}
              </span>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={line.quantity}
                placeholder="Actual kg"
                onChange={(e) => {
                  const next = [...form.outputs];
                  next[index] = { ...line, quantity: e.target.value };
                  setLines("outputs", next);
                }}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={line.unitPrice}
                placeholder="Price / kg"
                onChange={(e) => {
                  const next = [...form.outputs];
                  next[index] = { ...line, unitPrice: e.target.value };
                  setLines("outputs", next);
                }}
              />
              <strong className="px-2 text-right text-sm">
                {money(Number(line.quantity) * Number(line.unitPrice))}
              </strong>
              <button
                type="button"
                aria-label="Remove finished material"
                className="grid size-10 place-items-center text-red-600 disabled:cursor-not-allowed disabled:opacity-25"
                disabled={line.locked}
                onClick={() =>
                  setLines(
                    "outputs",
                    form.outputs.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div className="grid grid-cols-[2fr_.7fr_.9fr_.9fr_.8fr_.9fr_42px] gap-2 border-t border-[#e0e5dd] p-3">
            <Button
              type="button"
              className="col-span-4 w-full justify-center"
              variant="secondary"
              onClick={() =>
                setLines("outputs", [
                  ...form.outputs,
                  { ...blank("OUTPUT"), locked: false },
                ])
              }
            >
              <Plus size={14} /> Add Finished Material
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
  const inputRows = (category: "RAW_MATERIAL" | "PACKAGING") =>
    form.inputs.filter((line) => line.category === category);
  const inputEditor = (
    category: "RAW_MATERIAL" | "PACKAGING",
    title: string,
    description: string,
  ) => (
    <Card className="overflow-hidden p-0">
      <div className="px-4 py-4">
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="text-xs text-[#7a9185]">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[2fr_.8fr_.8fr_1fr] gap-3 bg-[#f2f5f3] px-4 py-2 text-[10px] font-bold uppercase text-[#53665c]">
            <span>
              {category === "RAW_MATERIAL"
                ? "Raw material"
                : "Utility / packaging"}
            </span>
            <span>Total kg</span>
            <span>Per kg price</span>
            <span className="text-right">Total price</span>
          </div>
          {inputRows(category).map((line, index) => (
            <div
              key={line.productId || index}
              className="grid grid-cols-[2fr_.8fr_.8fr_1fr] items-center gap-3 border-t border-[#e0e5dd] px-4 py-3"
            >
              <strong className="text-sm text-[#243b30]">
                {line.description}
              </strong>
              <span>{Number(line.quantity).toLocaleString()} kg</span>
              <span>{money(Number(line.unitPrice))}</span>
              <strong className="text-right">
                {money(Number(line.quantity) * Number(line.unitPrice))}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
  const totalFmPrice = rows.reduce((sum, row) => sum + row.metrics.revenue, 0);
  return (
    <PageContainer
      loading={loading}
      cap="PRODUCTION & COSTING"
      title="Register FM"
      description="Production lots are created automatically when RM is dispatched. Complete FG details to make them Ready for FM Store."
      headerContent={
        <div className="summary-grid grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            ["Production lots", rows.length],
            ["Total output", rows.reduce((sum, row) => sum + Number(row.actualQty), 0).toLocaleString() + " kg"],
            ["Total batch cost", money(rows.reduce((sum, row) => sum + row.metrics.totalCost, 0))],
            ["FM Price", money(totalFmPrice)],
          ].map(([label, value]) => <Card key={String(label)} className="p-5"><div className="text-xs font-semibold uppercase tracking-wide text-[#7a9185]">{label}</div><div className="mt-2 text-xl font-bold text-[#0f1c16]">{value}</div></Card>)}
        </div>
      }
    >
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-[#e0e5dd] p-5">
          <div>
            <h2 className="font-bold">Batch costing register</h2>
            <p className="text-xs text-[#7a9185]">
              FM Price uses the recorded per-kg amount for each finished product.
            </p>
          </div>
          <TrendingUp size={20} className="text-[#1b8f5a]" />
        </div>
        <div className="overflow-x-auto">
          <DataTable
            columns={[
              "Batch / requisition",
              "FM products",
              "Target",
              "Output",
              "Total cost",
              "FM Price",
              "Status",
              "Actions",
            ]}
            empty={
              rows.length === 0 && (
                <div className="grid place-items-center gap-2 p-12 text-center text-[#7a9185]">
                  <Factory size={30} />
                  <b className="text-[#0f1c16]">No batches recorded</b>
                </div>
              )
            }
          >
            {rows.map((row) => {
              const isOpen = expanded.has(row.id);
              return (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          className="mt-0.5"
                          onClick={() =>
                            setExpanded((current) => {
                              const next = new Set(current);
                              next.has(row.id)
                                ? next.delete(row.id)
                                : next.add(row.id);
                              return next;
                            })
                          }
                        >
                          {isOpen ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </button>
                        <div>
                          <strong className="font-mono text-[#0d3b2e]">
                            {row.batchNumber}
                          </strong>
                          <div className="text-xs text-[#7a9185]">
                            {row.requisitionNumber ?? "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{row.finishedGoods?.length ?? 0} finished goods</td>
                    <td>{Number(row.plannedQty).toLocaleString()} kg</td>
                    <td>{Number(row.actualQty).toLocaleString()} kg</td>
                    <td>{money(row.metrics.totalCost)}</td>
                    <td>{money(row.metrics.revenue)}</td>
                    <td>{statusBadge(row.status)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {row.status === "IN_PRODUCTION" ? (
                          <Button variant="primary" onClick={() => editBatch(row)}>Update FG Details</Button>
                        ) : (
                          <>
                            <Button variant="secondary" className="size-9 min-h-9 p-0" title="View batch details" aria-label="View batch details" onClick={() => setSelected(row)}><Eye size={15} /></Button>
                            <Button variant="secondary" className="size-9 min-h-9 p-0" title="Print batch report" aria-label="Print batch report" onClick={() => { if (!printBatchReport(row, products)) setMessage("Allow pop-ups to print the batch report."); }}><Printer size={15} /></Button>
                          </>
                        )}
                        {isManager && row.status === "AWAITING_APPROVAL" && (
                          <Button variant="accent" className="size-9 min-h-9 p-0" disabled={actionPending} title="Approve FG details" aria-label="Approve FG details" onClick={() => void approveBatch(row)}><CheckCircle2 size={15} /></Button>
                        )}
                        {isManager && row.status !== "COMPLETED" && (
                          <Button variant="danger" className="size-9 min-h-9 p-0" disabled={actionPending} title="Delete batch and reverse RM dispatch" aria-label="Delete batch and reverse RM dispatch" onClick={() => setDeleting(row)}><Trash2 size={15} /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={8} className="bg-[#f8faf7] p-3">
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {row.finishedGoods?.map((item, index) => {
                            const output = row.outputLines.find(
                              (line) => line.productId === item.product?.id,
                            );
                            return (
                              <div
                                key={item.orderId}
                                className="rounded-lg border border-[#dfe7df] bg-white p-3"
                              >
                                <div className="text-[10px] font-bold uppercase text-[#7a9185]">
                                  FM Product{" "}
                                  {String(index + 1).padStart(2, "0")}
                                </div>
                                <strong className="text-sm text-[#173b30]">
                                  {item.product?.name ?? "Finished good"}
                                </strong>
                                <div className="mt-1 text-xs text-[#708279]">
                                  Target {item.plannedQty.toLocaleString()} kg -
                                  Output{" "}
                                  {Number(
                                    output?.quantity ?? 0,
                                  ).toLocaleString()}{" "}
                                  kg - Waste {item.wastePercent}%
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </DataTable>
        </div>
      </Card>

      {open && (
        <Modal
          extraWide
          fixedHeight
          title={
            editing
              ? "Update FG Details - " + editing.batchNumber
              : "Record production batch"
          }
          description={
            editing
              ? "Production requisition: " + (editing.requisitionNumber ?? "-")
              : "Complete the finished-good production details."
          }
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={saving || !form.productionOrderId}
                onClick={() => void submit()}
              >
                {saving ? "Saving…" : "Complete batch"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 max-[850px]:grid-cols-1">
              <FormField label="FM requisition" required>
                <Input
                  value={editing?.requisitionNumber ?? ""}
                  readOnly
                  placeholder="Linked requisition number"
                />
              </FormField>
              <FormField label="Started at">
                <Input
                  type="datetime-local"
                  value={form.startedAt}
                  onChange={(e) =>
                    setForm({ ...form, startedAt: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Completed at">
                <Input
                  type="datetime-local"
                  value={form.completedAt}
                  onChange={(e) =>
                    setForm({ ...form, completedAt: e.target.value })
                  }
                />
              </FormField>
            </div>
            {outputEditor()}
            {inputEditor(
              "RAW_MATERIAL",
              "Raw materials used",
              "Only these quantities are included in RM-to-FM conversion, consumption, and loss measurements.",
            )}
            {inputRows("PACKAGING").length > 0 &&
              inputEditor(
                "PACKAGING",
                "Utilities and packaging",
                "Shown separately and included in batch cost, but excluded from RM-to-FM weight and loss measurements.",
              )}
            <Card className="grid grid-cols-3 gap-3 bg-[#f8faf7] p-4 max-[700px]:grid-cols-1">
              <div>
                <span className="text-xs text-[#7a9185]">
                  Total RM quantity
                </span>
                <b className="block">{totals.input.toLocaleString()}</b>
              </div>
              <div>
                <span className="text-xs text-[#7a9185]">
                  Total FM output quantity
                </span>
                <b className="block">{totals.output.toLocaleString()}</b>
              </div>
              <div>
                <span className="text-xs text-[#7a9185]">
                  RM-to-FM difference / loss
                </span>
                <b className="block">
                  {Math.max(0, totals.input - totals.output).toLocaleString()}
                </b>
              </div>
            </Card>
            <FormField label="Production notes">
              <TextArea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Shift, machine, quality observations or approval note"
              />
            </FormField>
          </div>
        </Modal>
      )}

      {selected &&
        (() => {
          const isUtility = (line: Line) =>
            line.category !== "RAW_MATERIAL" ||
            products.find((product) => product.id === line.productId)?.type ===
              "PACKAGING";
          const rawMaterials = selected.inputLines.filter(
            (line) => !isUtility(line),
          );
          const utilities = selected.inputLines.filter(isUtility);
          const fmQuantity = selected.outputLines.reduce(
            (sum, line) => sum + Number(line.quantity),
            0,
          );
          const rawMaterialCost = rawMaterials.reduce(
            (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
            0,
          );
          const utilityCost = utilities.reduce(
            (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
            0,
          );
          const fmProducedValue = selected.outputLines.reduce(
            (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
            0,
          );
          const fmAveragePrice =
            fmQuantity > 0 ? fmProducedValue / fmQuantity : 0;
          const rmCostPerKgFm =
            fmQuantity > 0 ? rawMaterialCost / fmQuantity : 0;
          const costTable = (title: string, costLines: Line[]) =>
            costLines.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-bold">{title}</h3>
                <div className="overflow-x-auto rounded-lg border border-[#e0e5dd]">
                  <div className="min-w-[680px]">
                    <div className="grid grid-cols-[2fr_.7fr_.8fr_.9fr] gap-4 bg-[#f2f5f3] px-4 py-2 text-[10px] font-bold uppercase text-[#53665c]">
                      <span>Product</span>
                      <span className="text-right">Quantity (kg)</span>
                      <span className="text-right">Per Kg Price (BDT)</span>
                      <span className="text-right">Total Price (BDT)</span>
                    </div>
                    {costLines.map((line, index) => (
                      <div
                        key={line.productId || index}
                        className="grid grid-cols-[2fr_.7fr_.8fr_.9fr] gap-4 border-t border-[#edf0eb] px-4 py-3 text-sm"
                      >
                        <span>{line.description}</span>
                        <span className="text-right tabular-nums">
                          {Number(line.quantity).toLocaleString()}
                        </span>
                        <span className="text-right tabular-nums">
                          {amount(Number(line.unitPrice))}
                        </span>
                        <b className="text-right tabular-nums">
                          {amount(
                            Number(line.quantity) * Number(line.unitPrice),
                          )}
                        </b>
                      </div>
                    ))}
                    <div className="grid grid-cols-[2fr_.7fr_.8fr_.9fr] gap-4 border-t-2 border-[#cfd8d1] bg-[#f8faf7] px-4 py-3 text-sm font-bold">
                      <span>Total</span>
                      <span className="text-right tabular-nums">
                        {costLines
                          .reduce((sum, line) => sum + Number(line.quantity), 0)
                          .toLocaleString()}
                      </span>
                      <span />
                      <span className="text-right tabular-nums">
                        {amount(
                          costLines.reduce(
                            (sum, line) =>
                              sum +
                              Number(line.quantity) * Number(line.unitPrice),
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          return (
            <Modal
              extraWide
              title={selected.batchNumber}
              description={
                "Linked FM requisition: " +
                (selected.requisitionNumber ?? selected.requisitionId ?? "-")
              }
              onClose={() => setSelected(null)}
              footer={
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>
              }
            >
              <div className="summary-grid grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card className="p-4">
                  <span className="text-xs text-[#7a9185]">
                    RM material cost
                  </span>
                  <b className="block text-lg">BDT {amount(rawMaterialCost)}</b>
                </Card>
                <Card className="p-4">
                  <span className="text-xs text-[#7a9185]">
                    Utility / packaging cost
                  </span>
                  <b className="block text-lg">BDT {amount(utilityCost)}</b>
                </Card>
                <Card className="p-4">
                  <span className="text-xs text-[#7a9185]">
                    FM produced value
                  </span>
                  <b className="block text-lg">BDT {amount(fmProducedValue)}</b>
                  <small className="text-[#7a9185]">
                    {fmQuantity.toLocaleString()} kg produced
                  </small>
                </Card>
                <Tooltip
                  position="bottom"
                  content={
                    <div className="w-72">
                      <b className="block text-sm">RM cost per kg FM</b>
                      <p className="mt-1 text-white/70">Average across all FM products. Utilities and packaging are excluded.</p>
                      <div className="mt-3 space-y-2 border-t border-white/20 pt-3">
                        <div className="flex justify-between gap-4"><span className="text-white/70">Total RM cost</span><b>BDT {amount(rawMaterialCost)}</b></div>
                        <div className="flex justify-between gap-4"><span className="text-white/70">Total FM produced</span><b>{fmQuantity.toLocaleString()} kg</b></div>
                        <div className="border-t border-white/20 pt-2"><span className="block text-white/70">Calculation</span><b>{amount(rawMaterialCost)} / {fmQuantity.toLocaleString()} = {amount(rmCostPerKgFm)} BDT/kg</b></div>
                      </div>
                    </div>
                  }
                >
                  <Card className="h-full cursor-help p-4 outline-none">
                    <span className="text-xs text-[#7a9185]">RM cost per kg FM</span>
                    <b className="block text-lg">BDT {amount(rmCostPerKgFm)}</b>
                    <small className="text-[#7a9185]">Hover or click for calculation</small>
                  </Card>
                </Tooltip>
              </div>
              {costTable("Raw materials", rawMaterials)}
              {costTable("Utilities and packaging", utilities)}
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-bold">
                  Finished materials produced
                </h3>
                <div className="overflow-x-auto rounded-lg border border-[#e0e5dd]">
                  <div className="min-w-[680px]">
                    <div className="grid grid-cols-[2fr_.7fr_.8fr_.9fr] gap-4 bg-[#f2f5f3] px-4 py-2 text-[10px] font-bold uppercase text-[#53665c]">
                      <span>FM product</span>
                      <span className="text-right">Produced Quantity (kg)</span>
                      <span className="text-right">Per Kg Amount (BDT)</span>
                      <span className="text-right">Total Amount (BDT)</span>
                    </div>
                    {selected.outputLines.map((line, index) => (
                      <div
                        key={line.productId || index}
                        className="grid grid-cols-[2fr_.7fr_.8fr_.9fr] gap-4 border-t border-[#edf0eb] px-4 py-3 text-sm"
                      >
                        <span>{line.description}</span>
                        <span className="text-right tabular-nums">
                          {Number(line.quantity).toLocaleString()}
                        </span>
                        <span className="text-right tabular-nums">
                          {amount(Number(line.unitPrice))}
                        </span>
                        <b className="text-right tabular-nums">
                          {amount(
                            Number(line.quantity) * Number(line.unitPrice),
                          )}
                        </b>
                      </div>
                    ))}
                    <div className="grid grid-cols-[2fr_.7fr_.8fr_.9fr] gap-4 border-t-2 border-[#cfd8d1] bg-[#f8faf7] px-4 py-3 text-sm font-bold">
                      <span>Total</span>
                      <span className="text-right tabular-nums">
                        {fmQuantity.toLocaleString()}
                      </span>
                      <span className="text-right tabular-nums">
                        {amount(fmAveragePrice)}
                      </span>
                      <span className="text-right tabular-nums">
                        {amount(fmProducedValue)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Modal>
          );
        })()}
      {deleting && <ConfirmationModal
        title="Delete batch and reverse RM dispatch?"
        confirmLabel="Delete and return RM"
        pending={actionPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void deleteBatch()}
      >
        This will permanently delete <b>{deleting.batchNumber}</b> and its linked Dispatch RM record. Every dispatched RM quantity will be returned to its original RM Store lot and bin. This action is available only before FM Store receipt.
      </ConfirmationModal>}
    </PageContainer>
  );
}
