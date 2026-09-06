import { Card } from '../components/ui/Card';
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api, selectedOrg } from "../shared/api/http";
import { PageContainer } from "../components/ui/PageContainer";
import { Notice } from "../components/ui/Notice";

export function TraceabilityPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedOrg()) return setMessage("Select an organisation first.");
    api<{ data: Record<string, unknown>[] }>("/inventory/movements")
      .then((result) => { setRows(result.data); setMessage(""); })
      .catch((error) => setMessage(error.message));
  }, []);

  const filtered = rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <PageContainer
      cap="LOT GENEALOGY"
      title="Traceability"
      description="Follow any lot from requisition and challan through production batch and customer dispatch."
      notice={message ? <Notice variant="error">{message}</Notice> : undefined}
   >
      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
          <h2>Inventory Movements</h2>
          <div className="flex items-center gap-2 p-[8px_12px] bg-[#f8faf7] [border:1.5px_solid_#e0e5dd] rounded-[8px] [transition:border-color_0.15s,_box-shadow_0.15s] flex-1 max-w-90 [&:focus-within]:[border-color:#1a5c45] [&:focus-within]:shadow-[0_0_0_3px_rgba(26,92,69,0.1)] [&:focus-within]:bg-[#fff] [:where(&_svg)]:w-4 [:where(&_svg)]:h-4 [:where(&_svg)]:text-[#7a9185] [:where(&_svg)]:shrink-0 [:where(&_input)]:[border:0] [:where(&_input)]:[background:none] [:where(&_input)]:outline-none [:where(&_input)]:[font:13.5px_'Inter',_sans-serif] [:where(&_input)]:text-[#0f1c16] [:where(&_input)]:w-full [&_input::placeholder]:text-[#7a9185]">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lot, product, document number or movement…"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-140 border-collapse [:where(&_th)]:p-[10px_16px] [:where(&_th)]:text-left [:where(&_th)]:text-[11px] [:where(&_th)]:font-bold [:where(&_th)]:tracking-[0.07em] [:where(&_th)]:uppercase [:where(&_th)]:text-[#7a9185] [:where(&_th)]:bg-[#f8faf7] [:where(&_th)]:[border-bottom:1px_solid_#e0e5dd] [:where(&_td)]:p-[13px_16px] [:where(&_td)]:[border-bottom:1px_solid_#e0e5dd] [:where(&_td)]:text-[13.5px] [:where(&_td)]:text-[#0f1c16] [&_tbody_tr]:[transition:background_0.1s] [&_tbody_tr:hover]:bg-[#f8faf7] [&_tbody_tr:last-child_td]:[border-bottom:0]">
            <thead>
              <tr>
                <th>Movement Type</th>
                <th>Document Type</th>
                <th>Document ID</th>
                <th>Lot</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  <td><strong>{String(row.movementType ?? "—")}</strong></td>
                  <td>{String(row.documentType ?? "—")}</td>
                  <td><span className="font-mono text-[12px] text-[#7a9185]">{String(row.documentId ?? "—")}</span></td>
                  <td><span className="font-mono text-[12px] text-[#7a9185]">{String(row.lotId ?? "—")}</span></td>
                  <td><strong>{String(row.quantity ?? "—")}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !message && (
            <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70">
              <div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Search size={28} /></div>
              <b>No movements found</b>
              <p>Stock movements appear once your store receives, issues, produces or dispatches stock.</p>
            </div>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}
