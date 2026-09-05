import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api, selectedOrg } from "../shared/api/http";
export function TraceabilityPage() {
  const [query,setQuery]=useState(""); const [rows,setRows]=useState<Record<string,unknown>[]>([]); const [message,setMessage]=useState("");
  useEffect(()=>{if(!selectedOrg())return setMessage("Select an organisation first."); api<{data:Record<string,unknown>[]}>("/inventory/movements").then((result)=>setRows(result.data)).catch((error)=>setMessage(error.message));},[]);
  const filtered=rows.filter((row)=>JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return <section className="page"><div className="page-title"><div><p className="cap">LOT GENEALOGY</p><h1>Traceability</h1><span>Follow any lot from requisition and challan through production batch and customer dispatch.</span></div></div><div className="card resource-table"><div className="search page-search"><Search/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search lot, product, document number or movement…" /></div>{message&&<p className="notice">{message}</p>}{!message&&filtered.length===0&&<div className="empty-state"><b>No movements found</b><span>Stock movements appear once your store receives, issues, produces or dispatches stock.</span></div>}{filtered.map((row,index)=><div className="trace-row" key={String(row.id??index)}><b>{String(row.movementType??"Movement")}</b><span>{String(row.documentType??"")} {String(row.documentId??"")}</span><small>Lot: {String(row.lotId??"—")} · Qty: {String(row.quantity??"—")}</small></div>)}</div></section>;
}
