type Line = {
  productId: string;
  description: string;
  category: string;
  quantity: string | number;
  unitPrice: string | number;
};
type Product = { id: string; type: string };
type Batch = {
  batchNumber: string;
  requisitionNumber?: string;
  requisitionId?: string;
  status: string;
  inputLines: Line[];
  outputLines: Line[];
};

const number = (value: number) =>
  new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
const safe = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );

export function printBatchReport(batch: Batch, products: Product[]) {
  const logo = new URL("/Inventory_Logo.png", window.location.origin).href;
  const isUtility = (line: Line) =>
    line.category !== "RAW_MATERIAL" ||
    products.find((product) => product.id === line.productId)?.type ===
      "PACKAGING";
  const raw = batch.inputLines.filter((line) => !isUtility(line)),
    utilities = batch.inputLines.filter(isUtility),
    fm = batch.outputLines;
  const quantity = (lines: Line[]) =>
    lines.reduce((sum, line) => sum + Number(line.quantity), 0);
  const value = (lines: Line[]) =>
    lines.reduce(
      (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
      0,
    );
  const rmCost = value(raw),
    utilityCost = value(utilities),
    fmPrice = value(fm),
    fmQty = quantity(fm);
  const rows = (lines: Line[]) =>
    lines
      .map(
        (line) =>
          `<tr><td>${safe(line.description)}</td><td class="num">${Number(line.quantity).toLocaleString()}</td><td class="num">${number(Number(line.unitPrice))}</td><td class="num strong">${number(Number(line.quantity) * Number(line.unitPrice))}</td></tr>`,
      )
      .join("");
  const table = (
    title: string,
    lines: Line[],
    quantityLabel = "Quantity (kg)",
  ) =>
    `<section><h2>${title}</h2><table><thead><tr><th>Product</th><th class="num">${quantityLabel}</th><th class="num">Per kg amount (BDT)</th><th class="num">Total amount (BDT)</th></tr></thead><tbody>${rows(lines)}</tbody><tfoot><tr><td>Total</td><td class="num">${quantity(lines).toLocaleString()}</td><td></td><td class="num">${number(value(lines))}</td></tr></tfoot></table></section>`;
  const popup = window.open("", "_blank", "width=1200,height=850");
  if (!popup) return false;
  popup.document
    .write(`<!doctype html><html><head><title>${safe(batch.batchNumber)} - FM Production Cost</title><style>
  @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#edf4ef;color:#18271f;font:11px Arial,sans-serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}.report{max-width:1120px;margin:18px auto;background:#fff;border:1px solid #d7e2da;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px #163d2d22}.hero{display:flex;justify-content:space-between;align-items:center;padding:20px 26px;color:#fff;background:linear-gradient(120deg,#0d4938,#1b694b 65%,#83b638)}.brand{display:flex;align-items:center;gap:13px}.logo{width:64px;height:64px;border-radius:14px;background:#fff;padding:4px;object-fit:contain}.brand b{display:block;font-size:21px}.brand span,.title p{color:#d9f1e4;font-size:9px;letter-spacing:.14em;text-transform:uppercase}.title{text-align:right}.title h1{margin:0;font-size:23px}.title p{margin:6px 0}.meta{display:grid;grid-template-columns:repeat(4,1fr);background:#f8fbf7;border-bottom:1px solid #d7e2da}.meta div{padding:11px 17px;border-right:1px solid #d7e2da}.meta div:last-child{border:0}.label{display:block;color:#71877b;font-size:8px;font-weight:700;text-transform:uppercase}.meta b{display:block;margin-top:4px}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;padding:15px 20px;background:#fffaf0}.metric{border:1px solid #e6dbc3;border-radius:11px;padding:11px;background:linear-gradient(145deg,#fffdf8,#f3ead9)}.metric:nth-child(2){background:linear-gradient(145deg,#f8fcf7,#e1f0e5)}.metric:nth-child(3){background:linear-gradient(145deg,#f6fbfc,#deedf1)}.metric:nth-child(4){background:linear-gradient(145deg,#fff8f2,#f2dfd2)}.metric:nth-child(5){background:linear-gradient(145deg,#faf8ff,#e9e3f3)}.metric b{display:block;margin-top:5px;font-size:15px}.formula{padding:10px 20px;background:#e9f4ed;color:#24513f;border-block:1px solid #ccdfd2}.tables{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:17px 20px}.tables section:last-child{grid-column:1/-1}h2{margin:0 0 7px;color:#164d39;font-size:12px}table{width:100%;border:1px solid #d5e1d8;border-collapse:separate;border-spacing:0;border-radius:10px;overflow:hidden}th{padding:8px;background:#eaf2eb;color:#315b49;font-size:8px;text-align:left;text-transform:uppercase}td{padding:7px 8px;border-top:1px solid #e5ebe6}tbody tr:nth-child(even){background:#fafcf9}tfoot td{border-top:2px solid #c5d7ca;background:#edf5ee;font-weight:800}.num{text-align:right!important;font-variant-numeric:tabular-nums}.strong{font-weight:700}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:60px;padding:30px 42px 18px;text-align:center;color:#60766a}.sign div{border-top:1px solid #8fa196;padding-top:7px}.foot{padding:9px;text-align:center;background:#f3f7f2;color:#7b8d83;font-size:8px}@media print{body{background:#fff}.report{margin:0;box-shadow:none}}
  </style></head><body><main class="report"><header class="hero"><div class="brand"><img class="logo" src="${logo}"><div><b>FeedTrack</b><span>Production Inventory</span></div></div><div class="title"><h1>FM Production Cost Report</h1><p>${safe(batch.batchNumber)}</p></div></header><div class="meta"><div><span class="label">Batch</span><b>${safe(batch.batchNumber)}</b></div><div><span class="label">Linked FM requisition</span><b>${safe(batch.requisitionNumber ?? batch.requisitionId ?? "-")}</b></div><div><span class="label">Status</span><b>${safe(batch.status)}</b></div><div><span class="label">Printed</span><b>${new Date().toLocaleString("en-GB")}</b></div></div><div class="metrics"><div class="metric"><span class="label">RM cost</span><b>BDT ${number(rmCost)}</b></div><div class="metric"><span class="label">Utility cost</span><b>BDT ${number(utilityCost)}</b></div><div class="metric"><span class="label">Batch cost</span><b>BDT ${number(rmCost + utilityCost)}</b></div><div class="metric"><span class="label">FM Price</span><b>BDT ${number(fmPrice)}</b></div><div class="metric"><span class="label">FM produced</span><b>${fmQty.toLocaleString()} kg</b></div></div><div class="formula"><b>RM cost per kg FM:</b> BDT ${number(rmCost)} / ${fmQty.toLocaleString()} kg = <b>BDT ${number(fmQty ? rmCost / fmQty : 0)} per kg</b> (utilities excluded)</div><div class="tables">${table("Raw Materials", raw)}${table("Utilities & Packaging", utilities, "Quantity")}${table("Finished Materials Produced", fm, "Produced quantity (kg)")}</div><div class="sign"><div>Prepared By</div><div>Production Manager</div><div>Approved By</div></div><footer class="foot">Generated by FeedTrack Production Inventory</footer></main><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  popup.document.close();
  return true;
}
