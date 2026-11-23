import { useEffect, useState } from "react";
import { api } from "../../../shared/api/http";
import { DataTable } from "../../../components/ui/DataTable";

type ProductStock = { productId: string; name: string; sku: string; unit: string; quantity: string; reserved: string; available: string; reorderLevel: number | null; lowStock: boolean };
export function ProductStockTable({ storeId, revision, search }: { storeId: string; revision: number; search: string }) {
  const [rows, setRows] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(()=>{if(active){setRows([]);setLoading(true);setError("");}});
    const load = async () => {
      try {
        const result = await api<{ data: ProductStock[] }>(`/stores/${storeId}/product-stock`);
        if (active) { setRows(result.data); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load product stock.");
      } finally { if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [storeId, revision]);
  const term = search.trim().toLowerCase();
  const filtered = rows.filter(row => [row.name, row.sku].some(value => value.toLowerCase().includes(term)));
  const format = (value: string) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
  return <>
    <p className="px-4 py-3 text-sm text-[#73877c]">Totals across all bins, requisitions, and lots in this store. RM weight products have a reorder level of 20 kg.</p>
    {error && <p role="alert" className="px-4 py-3 text-red-700">{error}</p>}
    <DataTable loading={loading} columns={["Product", "On Hand", "Reserved", "Available", "Reorder Level", "Status"]}>
      {filtered.map(row => <tr key={row.productId}>
        <td><strong>{row.name}</strong><div className="text-xs text-[#73877c]">{row.sku}</div></td>
        <td>{format(row.quantity)} {row.unit}</td><td>{format(row.reserved)} {row.unit}</td><td>{format(row.available)} {row.unit}</td>
        <td>{row.reorderLevel === null ? "-" : `${row.reorderLevel} kg`}</td>
        <td><span className={row.lowStock ? "font-semibold text-red-700" : "text-[#315747]"}>{row.lowStock ? "Reorder required" : row.reorderLevel === null ? "-" : "In stock"}</span></td>
      </tr>)}
      {!loading && !error && !filtered.length && <tr><td colSpan={6} className="py-8 text-center">No product stock found.</td></tr>}
    </DataTable>
  </>;
}
