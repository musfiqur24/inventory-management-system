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
      <div className="card" style={{ padding: 0 }}>
        <div className="table-header">
          <h2>Inventory Movements</h2>
          <div className="search-bar">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lot, product, document number or movement…"
            />
          </div>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table">
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
                  <td><span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }}>{String(row.documentId ?? "—")}</span></td>
                  <td><span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }}>{String(row.lotId ?? "—")}</span></td>
                  <td><strong>{String(row.quantity ?? "—")}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !message && (
            <div className="empty-state">
              <div className="empty-state__icon"><Search size={28} /></div>
              <b>No movements found</b>
              <p>Stock movements appear once your store receives, issues, produces or dispatches stock.</p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
