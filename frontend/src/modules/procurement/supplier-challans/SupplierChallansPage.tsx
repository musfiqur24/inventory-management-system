import { usePageLoading } from "../../../shared/hooks/usePageLoading";
import { DataTable } from "../../../components/ui/DataTable";
import { appToast } from "../../../components/ui/Toast";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, Eye, FileImage, FileText, Pencil, Plus, Printer, Search, Trash2, Truck, XCircle } from "lucide-react";
import { api, selectedOrg } from "../../../shared/api/http";
import { printReport } from "../../../shared/printReport";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { PageContainer } from "../../../components/ui/PageContainer";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ConfirmationModal } from "../../../components/ui/ConfirmationModal";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { Dropdown } from "../../../components/ui/Dropdown";
import { statusBadge } from "../../../components/ui/Badge";

type Line={id?:string;productId:string;uomId:string;declaredQty:string;unitPrice:string;verifiedQty?:string|number|null;measuredQty?:string|number|null;weighbridgeMatched?:boolean|null;product?:{name:string;sku:string};uom?:{code:string}};
type Weighment={id:string;vehicleNo?:string;grossWeight:number|string;tareWeight:number|string;netWeight:number|string;measuredAt:string;operator?:Manager|null};
type Delivery={id:string;number:string;status:string;supplierId:string;requisitionId?:string;createdById?:string;assignedManagerId?:string;approvedAt?:string;weighedAt?:string;assignedManager?:Manager;vehicleNo?:string;invoiceNo?:string;deliveredAt?:string;grossWeight?:number;tareWeight?:number;netWeight?:number;supplier?:{name:string}|null;requisition?:{number:string}|null;hasAttachment?:boolean;attachmentName?:string;latestWeighment?:Weighment|null;lines:Line[]};
type Requisition={id:string;number:string;status:string;supplierId?:string;assignedManagerId?:string;lines:{productId:string;uomId:string;requestedQty:string|number;verifiedQty?:string|number;unitPrice?:string|number}[]};type Partner={id:string;name:string;partnerType?:string;type?:string};type Product={id:string;name:string;sku:string;type:string;baseUomId?:string};type UOM={id:string;name:string;code:string};type Manager={id:string;fullName:string;email:string};
const blank=()=>({productId:"",uomId:"",declaredQty:"",unitPrice:""});
const emptyForm={requisitionId:"",supplierId:"",assignedManagerId:"",invoiceNo:"",vehicleNo:"",grossWeight:"",tareWeight:""};
function fileBase64(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("Unable to read attachment."));reader.onload=()=>resolve(String(reader.result).split(",")[1]??"");reader.readAsDataURL(file)})}
export function SupplierChallansPage(){
 const [pageLoading,runPageLoad]=usePageLoading(),{user}=useAuth();
 const [rows,setRows]=useState<Delivery[]>([]),[requisitions,setRequisitions]=useState<Requisition[]>([]),[suppliers,setSuppliers]=useState<Partner[]>([]),[products,setProducts]=useState<Product[]>([]),[uoms,setUoms]=useState<UOM[]>([]),[managers,setManagers]=useState<Manager[]>([]);
 const [search,setSearch]=useState("");
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<Delivery|null>(null),[showWeighbridge,setShowWeighbridge]=useState(false),[editing,setEditing]=useState<Delivery|null>(null),[deleting,setDeleting]=useState<Delivery|null>(null),[saving,setSaving]=useState(false),[acting,setActing]=useState("");
 const [form,setForm]=useState(emptyForm),[lines,setLines]=useState<Line[]>([blank()]),[attachment,setAttachment]=useState<{name:string;mime:string;contentBase64:string}|null>(null);
 const [params,setParams]=useSearchParams(),requestedId=params.get("challan");
 const role=user?.organizations.find(o=>o.id===selectedOrg())?.role.code,isManager=role==="MANAGER";
 const load=async()=>runPageLoad(async()=>{if(!selectedOrg())return;try{const[d,r,p,pr,u,m]=await Promise.all([api<{data:Delivery[]}>("/deliveries"),api<{data:Requisition[]}>("/purchase-requisitions"),api<{data:Partner[]}>("/partners"),api<{data:Product[]}>("/products"),api<{data:UOM[]}>("/uoms"),api<{data:Manager[]}>("/deliveries/managers")]);setRows(d.data);setRequisitions(r.data.filter(x=>!["CANCELLED","REJECTED"].includes(x.status)));setSuppliers(p.data.filter(x=>x.partnerType==="SUPPLIER"||x.type==="SUPPLIER"||x.type==="BOTH"));setProducts(pr.data);setUoms(u.data);setManagers(m.data)}catch(e){appToast.error(e instanceof Error?e.message:"Unable to load challans.")}});
 useEffect(()=>{void load()},[]);
 useEffect(()=>{if(requestedId&&rows.length){const found=rows.find(x=>x.id===requestedId);if(found)openDetails(found)}},[requestedId,rows]);
 const closeDetails=()=>{setSelected(null);setShowWeighbridge(false);setParams(current=>{const next=new URLSearchParams(current);next.delete("challan");return next},{replace:true})};
 const reset=()=>{setEditing(null);setForm(emptyForm);setLines([blank()]);setAttachment(null)};
 const startNew=()=>{reset();setOpen(true)};
 const edit=(d:Delivery)=>{setEditing(d);setForm({requisitionId:d.requisitionId??"",supplierId:d.supplierId,assignedManagerId:d.assignedManagerId??"",invoiceNo:d.invoiceNo??"",vehicleNo:d.vehicleNo??"",grossWeight:d.grossWeight?String(d.grossWeight):"",tareWeight:d.tareWeight?String(d.tareWeight):""});setLines(d.lines.map(l=>({...l,declaredQty:String(l.declaredQty),unitPrice:l.unitPrice?String(l.unitPrice):""})));setAttachment(null);setOpen(true)};
 const openDetails=(d:Delivery)=>{setSelected(d);setShowWeighbridge(false)};
 const chooseRequisition=(id:string)=>{const req=requisitions.find(r=>r.id===id);setForm(v=>({...v,requisitionId:id,supplierId:req?.supplierId??v.supplierId,assignedManagerId:req?.assignedManagerId??v.assignedManagerId}));if(req){const remaining=req.lines.map(l=>({...blank(),productId:l.productId,uomId:l.uomId,declaredQty:String(Math.max(0,Number(l.requestedQty)-Number(l.verifiedQty??0))),unitPrice:l.unitPrice?String(l.unitPrice):""})).filter(l=>Number(l.declaredQty)>0);setLines(remaining.length?remaining:[blank()])}};
 const setLine=(i:number,key:keyof Line,value:string)=>setLines(v=>v.map((l,n)=>n===i?{...l,[key]:value,...(key==="productId"?{uomId:products.find(p=>p.id===value)?.baseUomId??l.uomId}:{} )}:l));
 const total=useMemo(()=>lines.reduce((s,l)=>s+(Number(l.declaredQty)||0)*(Number(l.unitPrice)||0),0),[lines]);
 const chooseFile=async(file?:File)=>{if(!file)return;if(!["image/png","image/jpeg","application/pdf"].includes(file.type)||file.size>8*1024*1024)return appToast.error("Choose a PNG, JPG, or PDF up to 8 MB.");try{setAttachment({name:file.name,mime:file.type,contentBase64:await fileBase64(file)})}catch(e){appToast.error(e instanceof Error?e.message:"Unable to read attachment.")}};
 const submit=async()=>{if(saving)return;const valid=lines.filter(l=>l.productId&&l.uomId&&Number(l.declaredQty)>0);if(!form.supplierId||!form.assignedManagerId||!form.vehicleNo.trim()||valid.length!==lines.length)return appToast.error("Complete supplier, manager, vehicle, and every product line.");setSaving(true);try{await api(editing?`/deliveries/${editing.id}`:"/deliveries",{method:editing?"PUT":"POST",body:JSON.stringify({...form,requisitionId:form.requisitionId||undefined,grossWeight:form.grossWeight?Number(form.grossWeight):undefined,tareWeight:form.tareWeight?Number(form.tareWeight):undefined,attachment:attachment??undefined,lines:valid.map(l=>({...l,declaredQty:Number(l.declaredQty),unitPrice:l.unitPrice?Number(l.unitPrice):undefined}))})});setOpen(false);reset();await load();window.dispatchEvent(new Event("notificationsChanged"))}catch(e){appToast.error(e instanceof Error?e.message:"Unable to save challan.")}finally{setSaving(false)}};
 const approve=async(d:Delivery)=>{setActing(d.id);try{await api(`/deliveries/${d.id}/approve`,{method:"POST"});closeDetails();await load();window.dispatchEvent(new Event("notificationsChanged"))}catch(e){appToast.error(e instanceof Error?e.message:"Unable to verify challan.")}finally{setActing("")}};
 const reject=async(d:Delivery)=>{setActing(d.id);try{await api(`/deliveries/${d.id}/reject`,{method:"POST"});closeDetails();await load();window.dispatchEvent(new Event("notificationsChanged"))}catch(e){appToast.error(e instanceof Error?e.message:"Unable to reject challan.")}finally{setActing("")}};
 const remove=async()=>{if(!deleting)return;setActing(deleting.id);try{await api(`/deliveries/${deleting.id}`,{method:"DELETE"});setDeleting(null);await load()}catch(e){appToast.error(e instanceof Error?e.message:"Unable to delete.")}finally{setActing("")}};
 const preview=async(d:Delivery)=>{try{const r=await api<{data:{name:string;mime:string;contentBase64:string}}>(`/deliveries/${d.id}/attachment`),bytes=atob(r.data.contentBase64),array=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);const url=URL.createObjectURL(new Blob([array],{type:r.data.mime}));window.open(url,"_blank","noopener,noreferrer");window.setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){appToast.error(e instanceof Error?e.message:"Unable to preview attachment.")}};
 const print=(d:Delivery)=>{
  const logo=new URL("/Inventory_Logo.png",window.location.origin).href;
  const amount=d.lines.reduce((sum,line)=>sum+Number(line.declaredQty)*Number(line.unitPrice||0),0);
  const quantity=d.lines.reduce((sum,line)=>sum+Number(line.declaredQty||0),0);
  const status=d.status.replaceAll("_"," ");
  const statusClass=["APPROVED","RECEIVED"].includes(d.status)?"approved":["REJECTED","CANCELLED"].includes(d.status)?"rejected":["WEIGHED","AWAITING_DELIVERY"].includes(d.status)?"review":"pending";
  const format=(value:number)=>value.toLocaleString("en-BD",{minimumFractionDigits:2,maximumFractionDigits:2});
  const safe=(value:unknown)=>String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]!));
  printReport(`Supplier Challan ${d.number}`,`
   <style>
    @page{size:A4 landscape;margin:10mm}
    *{box-sizing:border-box}
    .challan{max-width:1120px;margin:0 auto;color:#17231d;font:11px Arial,sans-serif;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 0 13px;border-bottom:2px solid #1a5c45}
    .brand-block{display:flex;align-items:center;gap:11px}.logo{width:58px;height:58px;object-fit:contain}.brand-name{font-size:16px;font-weight:800;color:#123d2f}.brand-sub{margin-top:3px;color:#6f8378;font-size:8px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}
    .document-title{text-align:center}.eyebrow{color:#6b8477;font-size:8px;font-weight:800;letter-spacing:.2em;text-transform:uppercase}.document-title h1{margin:5px 0 0;font-size:23px;letter-spacing:-.02em;color:#13231b}
    .doc-ref{text-align:right}.doc-number{font-size:15px;font-weight:800;color:#123d2f}.status{display:inline-block;margin-top:7px;border:1px solid;border-radius:20px;padding:4px 10px;font-size:8px;font-weight:800;letter-spacing:.06em}.status.approved{border-color:#b8dcc5;background:#eaf7ee;color:#17633f}.status.pending{border-color:#ebd49e;background:#fff7df;color:#8b6517}.status.review{border-color:#b9d5e8;background:#edf7fd;color:#28658b}.status.rejected{border-color:#efc1b9;background:#fff0ed;color:#a44032}
    .meta{display:grid;grid-template-columns:repeat(6,1fr);margin-top:14px;border:1px solid #d7e3da;border-radius:10px;overflow:hidden;background:#f8fbf8}.meta>div{min-height:52px;padding:9px 11px;border-right:1px solid #dce6de}.meta>div:last-child{border:0}.label{display:block;color:#74877c;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.value{display:block;margin-top:5px;font-size:10px;font-weight:700;color:#1c3026}
    .items{width:100%;margin-top:14px;border:1px solid #cfdcd2;border-collapse:separate;border-spacing:0;border-radius:10px;overflow:hidden}.items thead{display:table-header-group}.items tr{break-inside:avoid}.items th{padding:8px 9px;border-bottom:1px solid #c5d5c9;background:#eaf2eb;color:#244839;font-size:8px;letter-spacing:.05em;text-align:left;text-transform:uppercase}.items td{padding:7px 9px;border-bottom:1px solid #e1e9e3}.items tbody tr:nth-child(even){background:#f8faf8}.items tbody tr:last-child td{border-bottom:0}.items .product{font-weight:700}.items small{display:block;margin-top:2px;color:#71877b;font-size:8px}.num{text-align:right!important;font-variant-numeric:tabular-nums}.center{text-align:center!important}.items tfoot td{padding:8px 9px;border-top:1px solid #c7d7ca;border-bottom:0;background:#edf4ee;color:#123d2f;font-weight:800}.grand-total{font-size:13px}
    .summary{display:grid;grid-template-columns:1.3fr .7fr;margin-top:12px;gap:12px}.note{min-height:70px;border:1px solid #dce5de;border-radius:9px;background:#fbfcfa;padding:10px}.note p{margin:7px 0 0;color:#718178;line-height:1.45}.weights{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d5e2d8;border-radius:9px;overflow:hidden;background:#f4f8f4}.weights div{padding:10px;border-right:1px solid #d5e2d8}.weights div:last-child{border:0}.weights strong{display:block;margin-top:5px;font-size:13px;color:#184735}
    .signatures{display:grid;grid-template-columns:repeat(4,1fr);gap:34px;margin-top:35px;text-align:center;color:#526b5e}.signature{border-top:1px solid #82988c;padding-top:6px;font-size:9px;font-weight:700}.footer{display:flex;justify-content:space-between;margin-top:16px;border-top:1px solid #dce5dd;padding-top:6px;color:#819187;font-size:7px}
   </style>
   <main class="challan">
    <header class="header">
     <div class="brand-block"><img class="logo" src="${logo}" alt="FeedTrack logo"><div><div class="brand-name">FeedTrack</div><div class="brand-sub">Production Inventory</div></div></div>
     <div class="document-title"><div class="eyebrow">Raw Material Procurement</div><h1>Supplier Delivery Challan</h1></div>
     <div class="doc-ref"><div class="doc-number">${safe(d.number)}</div><span class="status ${statusClass}">${safe(status)}</span></div>
    </header>
    <section class="meta">
     <div><span class="label">Supplier</span><span class="value">${safe(d.supplier?.name||"Not assigned")}</span></div>
     <div><span class="label">Requisition</span><span class="value">${safe(d.requisition?.number||"Direct delivery")}</span></div>
     <div><span class="label">Invoice No.</span><span class="value">${safe(d.invoiceNo||"Not provided")}</span></div>
     <div><span class="label">Vehicle No.</span><span class="value">${safe(d.vehicleNo||"Not provided")}</span></div>
     <div><span class="label">Delivery Date</span><span class="value">${d.deliveredAt?new Date(d.deliveredAt).toLocaleDateString("en-GB"):"—"}</span></div>
     <div><span class="label">Assigned Manager</span><span class="value">${safe(d.assignedManager?.fullName||"Not assigned")}</span></div>
    </section>
    <table class="items">
     <thead><tr><th class="center">#</th><th>Product Description</th><th class="center">UOM</th><th class="num">Quantity</th><th class="num">Unit Price</th><th class="num">Line Total</th></tr></thead>
     <tbody>${d.lines.map((line,index)=>`<tr><td class="center">${index+1}</td><td><span class="product">${safe(line.product?.name||"—")}</span><small>${safe(line.product?.sku||"")}</small></td><td class="center">${safe(line.uom?.code||"—")}</td><td class="num">${Number(line.declaredQty).toLocaleString("en-BD",{maximumFractionDigits:3})}</td><td class="num">${line.unitPrice?format(Number(line.unitPrice)):"—"}</td><td class="num"><strong>${line.unitPrice?format(Number(line.declaredQty)*Number(line.unitPrice)):"—"}</strong></td></tr>`).join("")}</tbody>
     <tfoot><tr><td colspan="3"><strong>${d.lines.length} product line${d.lines.length===1?"":"s"}</strong></td><td class="num">${quantity.toLocaleString("en-BD",{maximumFractionDigits:3})}</td><td class="num">Grand Total</td><td class="num grand-total">${format(amount)}</td></tr></tfoot>
    </table>
    <section class="summary">
     <div class="note"><span class="label">Delivery Notes</span><p>Goods listed above were delivered against this challan. Quantities remain subject to weighbridge verification, quality inspection, and final approval.</p></div>
     <div class="weights"><div><span class="label">Gross Weight</span><strong>${d.grossWeight==null?"—":Number(d.grossWeight).toLocaleString("en-BD")+" kg"}</strong></div><div><span class="label">Tare Weight</span><strong>${d.tareWeight==null?"—":Number(d.tareWeight).toLocaleString("en-BD")+" kg"}</strong></div><div><span class="label">Net Weight</span><strong>${d.netWeight==null?"—":Number(d.netWeight).toLocaleString("en-BD")+" kg"}</strong></div></div>
    </section>
    <section class="signatures"><div class="signature">Supplier / Driver</div><div class="signature">Received By</div><div class="signature">Weighbridge Operator</div><div class="signature">Approved By</div></section>
    <footer class="footer"><span>Generated from FeedTrack &bull; ${new Date().toLocaleString("en-GB")}</span><span>Challan ${safe(d.number)}</span></footer>
   </main>`);
 };
 const filteredRows=rows.filter(d=>{const q=search.trim().toLowerCase();return !q||[d.number,d.requisition?.number,d.supplier?.name,d.vehicleNo,d.invoiceNo].some(value=>value?.toLowerCase().includes(q))});
 const canEdit=(d:Delivery)=>d.status==="SUBMITTED"&&!d.weighedAt&&!d.approvedAt&&d.createdById===user?.id,canApprove=(d:Delivery)=>isManager&&d.status==="WEIGHED"&&d.assignedManagerId===user?.id;
 return <PageContainer loading={pageLoading} cap="RM PROCUREMENT" title="Supplier Delivery Challans" description="Register supplier challans against RM requisitions." actions={<Button variant="primary" onClick={startNew}><Plus size={16}/> New Challan</Button>}>
  <Card padding="none">
   <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e5dd] px-4 py-3"><div><h2 className="m-0 text-sm font-semibold">Challan Register</h2><span className="text-xs text-[#7a9185]">{filteredRows.length} of {rows.length} challans</span></div><div className="relative w-full sm:w-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a9185]" size={15}/><Input className="w-full pl-9 sm:w-80" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search requisition ID, challan..."/></div></div>
   <div className="[&_tbody_td]:px-3 [&_tbody_td]:py-3 [&_tbody_td]:text-xs [&_tbody_td]:whitespace-nowrap">
    <DataTable tableClassName="min-w-225" columnWidths={["13%","14%","13%","12%","10%","11%","10%","9%","8%"]} columns={["Challan #","Requisition #","Supplier","Manager","Vehicle","Total Value","Status","Date","Actions"]} empty={filteredRows.length===0?<div className="flex flex-col items-center gap-2"><Truck size={28}/><b>No challans yet</b></div>:undefined}>
     {filteredRows.map(d=><tr key={d.id}><td><strong className="text-[#0d3b2e]">{d.number}</strong></td><td><strong>{d.requisition?.number??"-"}</strong></td><td>{d.supplier?.name??"-"}</td><td>{d.assignedManager?.fullName??"-"}</td><td>{d.vehicleNo??"-"}</td><td>{d.lines.reduce((s,l)=>s+Number(l.declaredQty)*Number(l.unitPrice||0),0).toLocaleString()}</td><td>{statusBadge(d.status==="SUBMITTED"?"WEIGHING_PENDING":d.status)}</td><td>{d.deliveredAt?new Date(d.deliveredAt).toLocaleDateString("en-GB"):"-"}</td><td><div className="flex gap-1">{(d.status!=="APPROVED"||isManager)&&<Button size="sm" className="size-8 min-h-8 p-0" title="View" onClick={()=>openDetails(d)}><FileText size={14}/></Button>}{d.hasAttachment&&<Button size="sm" className="size-8 min-h-8 p-0" title="Preview attachment" onClick={()=>void preview(d)}><Eye size={14}/></Button>}<Button size="sm" className="size-8 min-h-8 p-0" title="Print" onClick={()=>print(d)}><Printer size={14}/></Button>{canEdit(d)&&<Button size="sm" className="size-8 min-h-8 p-0" title="Edit" onClick={()=>edit(d)}><Pencil size={14}/></Button>}{canApprove(d)&&<Button size="sm" variant="accent" className="size-8 min-h-8 p-0" disabled={acting===d.id} title="Approve challan" onClick={()=>openDetails(d)}><CheckCircle2 size={14}/></Button>}{isManager&&<Button size="sm" variant="danger" className="size-8 min-h-8 p-0" title="Delete" onClick={()=>setDeleting(d)}><Trash2 size={14}/></Button>}</div></td></tr>)}
    </DataTable>
   </div>
  </Card>
  {deleting&&<ConfirmationModal title="Delete challan?" confirmLabel="Delete Challan" pending={acting===deleting.id} onCancel={()=>setDeleting(null)} onConfirm={()=>void remove()}>Delete {deleting.number}? Posted stock and its audit trail will remain intact.</ConfirmationModal>}
  {open&&<Modal title={editing?"Edit Supplier Delivery Challan":"New Supplier Delivery Challan"} description="After approval, this challan becomes available from Receive Stock in the RM Store." onClose={()=>!saving&&setOpen(false)} extraWide fixedHeight footer={<><Button disabled={saving} onClick={()=>setOpen(false)}>Cancel</Button><Button variant="primary" disabled={saving} onClick={submit}>{saving?"Saving...":editing?"Save Changes":"Save Challan"}</Button></>}>
   <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
    <FormField label="Linked Requisition"><Dropdown value={form.requisitionId} onChange={e=>chooseRequisition(e.target.value)}><option value="">Select optional requisition</option>{requisitions.map(r=>{const eligible=["AWAITING_DELIVERY","INCOMPLETE","PARTIALLY_RECEIVED"].includes(r.status);return <option key={r.id} value={r.id} disabled={!eligible}>{r.number} - {r.status.replaceAll("_"," ")}</option>})}</Dropdown></FormField>
    <FormField label="Supplier" required><Dropdown value={form.supplierId} onChange={e=>setForm({...form,supplierId:e.target.value})}><option value="">Select supplier</option>{suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Dropdown></FormField>
    <FormField label="Assigned Manager" required><Dropdown value={form.assignedManagerId} onChange={e=>setForm({...form,assignedManagerId:e.target.value})}><option value="">Select manager</option>{managers.map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</Dropdown></FormField>
    <FormField label="Invoice Number"><Input value={form.invoiceNo} onChange={e=>setForm({...form,invoiceNo:e.target.value})} placeholder="INV-2026-001"/></FormField>
    <FormField label="Vehicle Number" required><Input value={form.vehicleNo} onChange={e=>setForm({...form,vehicleNo:e.target.value})} placeholder="DHK-TRK-0001"/></FormField>
    <FormField label="Gross / Tare Weight (kg)"><div className="grid grid-cols-2 gap-2"><Input type="number" value={form.grossWeight} onChange={e=>setForm({...form,grossWeight:e.target.value})} placeholder="Gross"/><Input type="number" value={form.tareWeight} onChange={e=>setForm({...form,tareWeight:e.target.value})} placeholder="Tare"/></div></FormField>
    <FormField label="Attachment (PNG, JPG, PDF; max 8 MB)"><label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#d7e0d8] px-3 text-sm"><FileImage size={16}/><span className="truncate">{attachment?.name??(editing?.attachmentName||"Choose file")}</span><input className="sr-only" type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" onChange={e=>void chooseFile(e.target.files?.[0])}/></label></FormField>
   </div>
   <div className="mt-3 border-t border-[#e0e5dd] pt-3"><div className="mb-2"><strong className="text-sm">Product Lines</strong></div>
    <div className="overflow-x-auto rounded-xl border border-[#dfe7df]"><div className="min-w-0 sm:min-w-[820px]"><div className="hidden grid-cols-[2fr_1.1fr_.8fr_.9fr_.9fr_44px] gap-2 bg-[#f4f6f4] sm:grid px-3 py-2 text-[11px] font-bold uppercase"><span>Product</span><span>UOM</span><span>Qty</span><span>Unit Price</span><span className="text-right">Total</span><span className="text-center">Action</span></div>{lines.map((l,i)=><div key={i} className="grid grid-cols-1 items-center gap-2 border-t sm:grid-cols-[2fr_1.1fr_.8fr_.9fr_.9fr_44px] border-[#e4e9e3] p-2"><Dropdown aria-label="Product" value={l.productId} onChange={e=>setLine(i,"productId",e.target.value)}><option value="">Product</option>{products.filter(x=>!form.requisitionId||requisitions.find(r=>r.id===form.requisitionId)?.lines.some(l=>l.productId===x.id&&Number(l.requestedQty)>Number(l.verifiedQty??0))).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Dropdown><Dropdown aria-label="UOM" value={l.uomId} onChange={e=>setLine(i,"uomId",e.target.value)}><option value="">UOM</option>{uoms.map(x=><option key={x.id} value={x.id}>{x.code}</option>)}</Dropdown><Input aria-label="Quantity" type="number" value={l.declaredQty} onChange={e=>setLine(i,"declaredQty",e.target.value)} placeholder="Qty"/><Input aria-label="Unit price" type="number" value={l.unitPrice} onChange={e=>setLine(i,"unitPrice",e.target.value)} placeholder="Price"/><span className="px-2 text-right text-sm font-semibold tabular-nums">{((Number(l.declaredQty)||0)*(Number(l.unitPrice)||0)).toLocaleString()}</span><Button variant="ghost" className="size-11 p-0 text-red-600 hover:bg-red-50" aria-label={`Remove line ${i + 1}`} title="Remove line" disabled={lines.length===1} onClick={()=>setLines(lines.filter((_,n)=>n!==i))}><Trash2 size={16}/></Button></div>)}</div></div>
    <Button className="mt-3 w-full justify-center" size="sm" onClick={()=>setLines([...lines,blank()])}><Plus size={14}/> Add Product Line</Button>
    <div className="mt-2 text-right text-sm font-bold">Challan total: {total.toLocaleString()}</div>
   </div>
  </Modal>}
  {selected&&<Modal title={"Challan: "+selected.number} description={[selected.requisition?.number?"Requisition "+selected.requisition.number:"",selected.supplier?.name??"",selected.vehicleNo??""].filter(Boolean).join(" | ")} onClose={closeDetails} extraWide fixedHeight footer={<><Button onClick={()=>print(selected)}><Printer size={14}/> Print</Button>{canApprove(selected)&&<><Button variant="primary" disabled={acting===selected.id} onClick={()=>void approve(selected)}><CheckCircle2 size={14}/>{acting===selected.id?"Working...":"Approve"}</Button><Button variant="danger" disabled={acting===selected.id} onClick={()=>void reject(selected)}><XCircle size={14}/> Reject</Button></>}<Button onClick={closeDetails}>Close</Button></>}>
   {selected.status==="SUBMITTED"&&<div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Awaiting weighbridge measurement. Manager approval becomes available after the report is submitted.</div>}
   {selected.weighedAt&&<>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dce7df] bg-[#f5f8f5] px-4 py-3 text-sm">
     <div><strong>Weighbridge report</strong> submitted {new Date(selected.latestWeighment?.measuredAt??selected.weighedAt).toLocaleString("en-GB")}<div className="mt-0.5 text-xs text-[#6f8177]">{selected.lines.every(l=>l.weighbridgeMatched)?"All lines fulfilled":"Partial fulfillment - review required"}</div></div>
     <Button size="sm" variant="secondary" onClick={()=>setShowWeighbridge(value=>!value)}><Eye size={14}/>{showWeighbridge?"Hide Report":"View Weighbridge Report"}</Button>
    </div>
    {showWeighbridge&&<div className="mb-4 overflow-hidden rounded-xl border border-[#d9e5dc] bg-linear-to-br from-[#fbfdf9] to-[#f1f7f2] shadow-[0_2px_8px_rgba(32,74,55,0.06)]">
     <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d9e5dc] bg-[#eaf3ec] px-4 py-3"><div><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#648071]">Linked Weighbridge Report</div><div className="mt-0.5 text-sm font-bold text-[#173e30]">{selected.number}</div></div><span className={"rounded-full px-2.5 py-1 text-xs font-semibold "+(selected.lines.every(l=>l.weighbridgeMatched)?"bg-green-100 text-green-800":"bg-amber-100 text-amber-800")}>{selected.lines.every(l=>l.weighbridgeMatched)?"Complete Match":"Partial / Mismatch"}</span></div>
     <div className="grid grid-cols-2 gap-px bg-[#dfe8e1] sm:grid-cols-3 lg:grid-cols-6">
      {[
       ["Gross Weight",selected.latestWeighment?Number(selected.latestWeighment.grossWeight).toLocaleString()+" kg":"—"],
       ["Tare Weight",selected.latestWeighment?Number(selected.latestWeighment.tareWeight).toLocaleString()+" kg":"—"],
       ["Net Weight",selected.latestWeighment?Number(selected.latestWeighment.netWeight).toLocaleString()+" kg":"—"],
       ["Vehicle",selected.latestWeighment?.vehicleNo??selected.vehicleNo??"—"],
       ["Operator",selected.latestWeighment?.operator?.fullName??"—"],
       ["Measured At",new Date(selected.latestWeighment?.measuredAt??selected.weighedAt).toLocaleString("en-GB")],
      ].map(([label,value])=><div key={label} className="bg-white/85 px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-wide text-[#71877b]">{label}</div><div className="mt-1 text-sm font-semibold text-[#233b30]">{value}</div></div>)}
     </div>
     <div className="px-4 py-2 text-xs text-[#667b70]">Measured quantities and individual line results are shown in the product table below.</div>
    </div>}
   </>}
   <DataTable pagination={false} scrollAreaClassName="max-h-80 h-auto" columns={["Product","UOM","Challan Qty","Measured Qty","Result","Unit Price","Total"]}>
    {selected.lines.map((l,i)=><tr key={l.id??i}><td><strong>{l.product?.name??"-"}</strong><div className="text-xs text-[#73877c]">{l.product?.sku}</div></td><td>{l.uom?.code??"-"}</td><td>{Number(l.declaredQty).toLocaleString()}</td><td><strong>{l.measuredQty==null?"-":Number(l.measuredQty).toLocaleString()}</strong></td><td>{l.measuredQty==null?"Awaiting weighbridge":l.weighbridgeMatched?<span className="text-green-700">Match</span>:<span className="inline-flex items-center gap-1 text-amber-700"><CircleDashed size={14}/> Partial delivery</span>}</td><td>{l.unitPrice?Number(l.unitPrice).toLocaleString():"-"}</td><td>{(Number(l.measuredQty??l.declaredQty)*Number(l.unitPrice||0)).toLocaleString()}</td></tr>)}
   </DataTable>
  </Modal>}
 </PageContainer>
}
