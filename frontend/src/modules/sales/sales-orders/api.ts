import { api } from "../../../shared/api/http";

export interface SalesOrderLine {
  id?: string;
  productId: string;
  uomId: string;
  quantity: string | number;
  dispatchedQty?: string | number;
  unitPrice?: string | number | null;
  product?: { id: string; name: string; sku: string };
  uom?: { id: string; code: string; name: string };
}

export interface SalesOrder {
  id: string;
  number: string;
  customerId: string;
  assignedPersonId?: string | null;
  status: string;
  orderedAt: string;
  totalValue: number;
  customer?: { id: string; name: string } | null;
  assignedPerson?: { id: string; fullName: string; email: string } | null;
  lines: SalesOrderLine[];
}

export interface Customer { id: string; name: string; partnerType?: string; type?: string }
export interface Assignee { id: string; fullName: string; email: string }
export interface FinishedProduct { id: string; name: string; sku: string; type: string; baseUomId: string; isActive?: boolean }
export interface Uom { id: string; code: string; name: string }

export const salesOrderApi = {
  list: () => api<{ data: SalesOrder[] }>("/sales-orders").then((response) => response.data),
  customers: () => api<{ data: Customer[] }>("/partners").then((response) => response.data.filter((item) => item.partnerType === "CUSTOMER" || item.type === "CUSTOMER" || item.type === "BOTH")),
  assignees: () => api<{ data: Assignee[] }>("/sales-orders/assignees").then((response) => response.data),
  products: () => api<{ data: FinishedProduct[] }>("/products").then((response) => response.data.filter((item) => item.type === "FINISHED_GOOD" && item.isActive !== false)),
  uoms: () => api<{ data: Uom[] }>("/uoms").then((response) => response.data),
  create: (payload: { customerId: string; assignedPersonId: string; lines: Array<{ productId: string; uomId: string; quantity: number; unitPrice: number }> }) =>
    api<{ data: SalesOrder }>("/sales-orders", { method: "POST", body: JSON.stringify(payload) }).then((response) => response.data),
};
