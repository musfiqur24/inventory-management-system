import { api } from "../../../shared/api/http";

export interface SalesInvoice {
  id: string;
  dispatchNumber: string;
  status: string;
  dispatchedAt?: string;
  vehicleNo?: string;
  totalValue?: number;
  salesOrder?: { number: string } | null;
  customer?: { name: string } | null;
  lines: Array<{
    id: string;
    fgProduct?: { name: string; sku: string };
    uom?: { code: string };
    dispatchedQty: number;
    unitPrice?: number | null;
  }>;
}

export const invoiceNumber = (invoice: SalesInvoice) =>
  "INV-" + invoice.dispatchNumber.replace(/^DISP-/, "");

export async function listSalesInvoices() {
  const response = await api<{ data: SalesInvoice[] }>("/dispatches");
  return response.data;
}
