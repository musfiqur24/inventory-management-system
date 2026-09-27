import { useEffect, useState } from "react";
import { Eye, FileText, Printer, Search } from "lucide-react";
import { PageContainer } from "../../../components/ui/PageContainer";
import { Card } from "../../../components/ui/Card";
import { DataTable } from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { appToast } from "../../../components/ui/Toast";
import { printReport } from "../../../shared/printReport";
import { invoiceNumber, listSalesInvoices, type SalesInvoice } from "./api";

const money = (value: number) => "BDT " + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function InvoicesPage() {
  const [rows, setRows] = useState<SalesInvoice[]>([]);
  const [selected, setSelected] = useState<SalesInvoice | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void listSalesInvoices()
      .then((data) => { if (active) setRows(data); })
      .catch((error) => appToast.error(error instanceof Error ? error.message : "Unable to load invoices."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const printInvoice = (invoice: SalesInvoice) => {
    const number = invoiceNumber(invoice);
    const logo = new URL("/Inventory_Logo.png", window.location.origin).href;
    const body = invoice.lines.map((line, index) => {
      const quantity = Number(line.dispatchedQty);
      const price = Number(line.unitPrice ?? 0);
      return `<tr><td>${index + 1}</td><td><b>${line.fgProduct?.name ?? "-"}</b><small>${line.fgProduct?.sku ?? ""}</small></td><td class="num">${quantity.toLocaleString()} ${line.uom?.code ?? ""}</td><td class="num">${money(price)}</td><td class="num"><b>${money(quantity * price)}</b></td></tr>`;
    }).join("");
    printReport(number, `<div class="overflow-hidden rounded-2xl border border-[#d7e2da]"><header class="flex items-center justify-between bg-gradient-to-r from-[#0d4938] to-[#78aE37] p-6 text-white"><div class="flex items-center gap-3"><img src="${logo}" class="size-16 rounded-xl bg-white p-1"/><div><b class="text-xl">FeedTrack</b><small class="block uppercase tracking-widest text-emerald-100">Production Inventory</small></div></div><div class="text-right"><h1 class="text-2xl font-bold">Sales Invoice</h1><p>${number}</p></div></header><section class="grid grid-cols-4 border-b bg-[#f8fbf7]"><div class="p-4"><small>Customer</small><b class="block">${invoice.customer?.name ?? "-"}</b></div><div class="p-4"><small>Sales Order</small><b class="block">${invoice.salesOrder?.number ?? "-"}</b></div><div class="p-4"><small>FM Dispatch</small><b class="block">${invoice.dispatchNumber}</b></div><div class="p-4"><small>Invoice Date</small><b class="block">${invoice.dispatchedAt ? new Date(invoice.dispatchedAt).toLocaleDateString("en-GB") : "-"}</b></div></section><div class="p-5"><table class="w-full border-collapse"><thead><tr class="bg-[#eaf2eb]"><th class="p-3 text-left">#</th><th class="p-3 text-left">Finished Product</th><th class="p-3 text-right">Quantity</th><th class="p-3 text-right">Unit Price</th><th class="p-3 text-right">Amount</th></tr></thead><tbody>${body}</tbody><tfoot><tr class="border-t-2 border-[#1a5c45]"><td colspan="4" class="p-3 text-right font-bold">Total Invoice Amount</td><td class="p-3 text-right text-lg font-bold">${money(Number(invoice.totalValue ?? 0))}</td></tr></tfoot></table><div class="mt-16 grid grid-cols-3 gap-16 text-center text-sm text-[#60766a]"><div class="border-t pt-2">Prepared By</div><div class="border-t pt-2">Customer Signature</div><div class="border-t pt-2">Authorized By</div></div></div></div>`);
  };

  const filtered = rows.filter((invoice) =>
    [invoiceNumber(invoice), invoice.dispatchNumber, invoice.salesOrder?.number ?? "", invoice.customer?.name ?? ""]
      .some((value) => value.toLowerCase().includes(search.toLowerCase())),
  );
  const totalValue = filtered.reduce((sum, invoice) => sum + Number(invoice.totalValue ?? 0), 0);

  return <PageContainer loading={loading} cap="SALES" title="Invoices" description="View and print customer invoices generated from completed FM dispatches.">
    <div className="summary-grid mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Card tone="sage" className="text-center"><strong className="text-2xl">{filtered.length}</strong><span className="mt-1 block text-sm text-[#73877c]">Invoices</span></Card>
      <Card tone="sand" className="text-center"><strong className="text-xl">{money(totalValue)}</strong><span className="mt-1 block text-sm text-[#73877c]">Total invoiced</span></Card>
      <Card tone="blue" className="text-center"><strong className="text-2xl">{new Set(filtered.map((row) => row.customer?.name).filter(Boolean)).size}</strong><span className="mt-1 block text-sm text-[#73877c]">Customers</span></Card>
    </div>
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e5dd] p-5"><h2 className="font-semibold">Invoice Register</h2><div className="flex w-full max-w-80 items-center gap-2"><Search size={16} className="text-[#73877c]"/><Input placeholder="Search invoices..." value={search} onChange={(event) => setSearch(event.target.value)}/></div></div>
      <DataTable columns={["Invoice #", "Customer", "Sales Order", "FM Dispatch", "Total Amount", "Date", "Actions"]} empty={!filtered.length && <div className="py-12 text-center text-[#73877c]"><FileText className="mx-auto mb-3"/><b>No invoices found</b></div>}>
        {filtered.map((invoice) => <tr key={invoice.id}><td><strong className="font-mono text-[#0d3b2e]">{invoiceNumber(invoice)}</strong></td><td>{invoice.customer?.name ?? "-"}</td><td>{invoice.salesOrder?.number ?? "-"}</td><td>{invoice.dispatchNumber}</td><td className="font-semibold">{money(Number(invoice.totalValue ?? 0))}</td><td>{invoice.dispatchedAt ? new Date(invoice.dispatchedAt).toLocaleDateString("en-GB") : "-"}</td><td><div className="flex gap-1"><Button size="sm" variant="secondary" className="size-9 min-h-9 p-0" title="View invoice" onClick={() => setSelected(invoice)}><Eye size={15}/></Button><Button size="sm" variant="secondary" className="size-9 min-h-9 p-0" title="Print invoice" onClick={() => printInvoice(invoice)}><Printer size={15}/></Button></div></td></tr>)}
      </DataTable>
    </Card>
    {selected && <Modal title={invoiceNumber(selected)} description={`Customer: ${selected.customer?.name ?? "-"} | FM Dispatch: ${selected.dispatchNumber}`} onClose={() => setSelected(null)} extraWide fixedHeight footer={<><Button onClick={() => printInvoice(selected)}><Printer size={15}/> Print Invoice</Button><Button onClick={() => setSelected(null)}>Close</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3"><Card tone="sage"><span className="text-xs text-[#73877c]">Sales Order</span><strong className="mt-1 block">{selected.salesOrder?.number ?? "-"}</strong></Card><Card tone="blue"><span className="text-xs text-[#73877c]">FM Dispatch</span><strong className="mt-1 block">{selected.dispatchNumber}</strong></Card><Card tone="sand"><span className="text-xs text-[#73877c]">Total</span><strong className="mt-1 block text-lg">{money(Number(selected.totalValue ?? 0))}</strong></Card></div>
      <div className="mt-5 overflow-x-auto rounded-lg border border-[#d7dfd6]"><table className="w-full min-w-[700px] text-sm"><thead className="bg-[#eef4ef]"><tr><th className="p-3 text-left">Finished Product</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-right">Unit Price</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{selected.lines.map((line) => { const qty=Number(line.dispatchedQty), price=Number(line.unitPrice??0); return <tr key={line.id} className="border-t"><td className="p-3"><b>{line.fgProduct?.name ?? "-"}</b><small className="block text-[#73877c]">{line.fgProduct?.sku}</small></td><td className="p-3 text-right">{qty.toLocaleString()} {line.uom?.code}</td><td className="p-3 text-right">{money(price)}</td><td className="p-3 text-right font-semibold">{money(qty*price)}</td></tr>; })}</tbody></table></div>
    </Modal>}
  </PageContainer>;
}
