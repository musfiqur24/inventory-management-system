export interface MaterialIssueReport {
  issueNumber: string;
  status: string;
  issuedAt: string;
  notes?: string | null;
  issuedBy?: string | null;
  productionOrder?: { number: string } | null;
  productionRequisition?: { id: string; number: string } | null;
  lines: Array<{
    id: string;
    rawMaterial?: { name: string; sku: string };
    lot?: { lotNumber: string };
    fromBin?: { code: string; name: string; store?: { code: string; name: string } };
    uom?: { code: string };
    issuedQty: number;
  }>;
}

const safe = (value: unknown) =>
  String(value ?? "-").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]!);

export function printMaterialIssue(issue: MaterialIssueReport) {
  const popup = window.open("", "_blank", "width=1180,height=820");
  if (!popup) return false;
  const logo = new URL("/Inventory_Logo.png", window.location.origin).href;
  const totals = new Map<string, number>();
  issue.lines.forEach((line) => {
    const uom = line.uom?.code ?? "";
    totals.set(uom, (totals.get(uom) ?? 0) + Number(line.issuedQty));
  });
  const totalText = [...totals].map(([uom, quantity]) => quantity.toLocaleString() + " " + uom).join(" | ");
  const rows = issue.lines.map((line, index) => `<tr>
    <td class="center">${index + 1}</td>
    <td><b>${safe(line.rawMaterial?.name)}</b><small>${safe(line.rawMaterial?.sku)}</small></td>
    <td><b>${safe(line.fromBin?.store?.code ?? "RM Store")} / ${safe(line.fromBin?.code)}</b><small>${safe(line.fromBin?.store?.name)}${line.fromBin?.name ? " - " + safe(line.fromBin.name) : ""}</small></td>
    <td class="num"><b>${Number(line.issuedQty).toLocaleString()}</b> ${safe(line.uom?.code)}</td>
  </tr>`).join("");
  popup.document.write(`<!doctype html><html><head><title>${safe(issue.issueNumber)}</title><style>
  @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#eef5f0;color:#18271f;font:11px Arial,sans-serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}.report{max-width:1120px;margin:18px auto;background:#fff;border:1px solid #d7e2da;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px #163d2d22}.hero{display:flex;justify-content:space-between;align-items:center;padding:21px 27px;color:#fff;background:linear-gradient(120deg,#0b4636,#176146 62%,#8bbb3f)}.brand{display:flex;align-items:center;gap:13px}.logo{width:64px;height:64px;border-radius:14px;background:#fff;padding:4px;object-fit:contain}.brand b{display:block;font-size:21px}.brand span,.title p{color:#d9f1e4;font-size:9px;letter-spacing:.14em;text-transform:uppercase}.title{text-align:right}.title h1{margin:0;font-size:24px}.title p{margin:6px 0 0}.meta{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #d7e2da;background:#f8fbf7}.meta div{padding:12px 17px;border-right:1px solid #d7e2da}.meta div:last-child{border:0}.label{display:block;color:#71877b;font-size:8px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}.meta b{display:block;margin-top:5px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;padding:16px 20px;background:#fffaf0}.metric{border:1px solid #e5d9be;border-radius:12px;padding:12px;background:linear-gradient(145deg,#fffdf8,#f3ead9)}.metric:nth-child(2){border-color:#ccdfd2;background:linear-gradient(145deg,#f8fcf7,#e1f0e5)}.metric:nth-child(3){border-color:#cbdde3;background:linear-gradient(145deg,#f6fbfc,#deedf1)}.metric b{display:block;margin-top:5px;font-size:15px}.content{padding:18px 20px}h2{margin:0 0 9px;color:#164d39;font-size:13px}table{width:100%;border:1px solid #d5e1d8;border-collapse:separate;border-spacing:0;border-radius:11px;overflow:hidden}th{padding:9px;background:#eaf2eb;color:#315b49;font-size:8px;text-align:left;text-transform:uppercase}td{padding:9px;border-top:1px solid #e5ebe6}tbody tr:nth-child(even){background:#fafcf9}.num{text-align:right!important;font-variant-numeric:tabular-nums}.center{text-align:center!important}small{display:block;margin-top:3px;color:#71877b}.notes{margin-top:14px;border-left:4px solid #83b638;border-radius:8px;background:#f4f8ef;padding:11px 13px}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:60px;padding:34px 42px 20px;text-align:center;color:#60766a}.sign div{border-top:1px solid #8fa196;padding-top:7px}.foot{padding:10px;text-align:center;background:#f3f7f2;color:#7b8d83;font-size:8px}@media print{body{background:#fff}.report{margin:0;box-shadow:none}}
  </style></head><body><main class="report"><header class="hero"><div class="brand"><img class="logo" src="${logo}" alt="FeedTrack"><div><b>FeedTrack</b><span>Production Inventory</span></div></div><div class="title"><h1>Raw Material Issue Report</h1><p>${safe(issue.issueNumber)}</p></div></header><section class="meta"><div><span class="label">Dispatch No.</span><b>${safe(issue.issueNumber)}</b></div><div><span class="label">FM Requisition</span><b>${safe(issue.productionRequisition?.number)}</b></div><div><span class="label">Status</span><b>${safe(issue.status)}</b></div><div><span class="label">Issue Time</span><b>${new Date(issue.issuedAt).toLocaleString("en-GB")}</b></div></section><section class="metrics"><div class="metric"><span class="label">RM Lines</span><b>${issue.lines.length}</b></div><div class="metric"><span class="label">Total Issued</span><b>${safe(totalText || "-")}</b></div><div class="metric"><span class="label">Linked Production Order</span><b>${safe(issue.productionOrder?.number)}</b></div></section><section class="content"><h2>Issued Raw Materials</h2><table><thead><tr><th class="center">#</th><th>Raw Material</th><th>Store / Bin</th><th class="num">Issued Quantity</th></tr></thead><tbody>${rows}</tbody></table><div class="notes"><span class="label">Notes</span><b>${safe(issue.notes || "No notes")}</b></div></section><section class="sign"><div>Store Officer</div><div>Production Receiver</div><div>Authorized By</div></section><footer class="foot">Generated by FeedTrack Production Inventory on ${new Date().toLocaleString("en-GB")}</footer></main><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  popup.document.close();
  return true;
}
