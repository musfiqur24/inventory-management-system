import { useEffect, useState } from 'react';
import { api } from '../../../shared/api/http';
import { appToast } from '../../../components/ui/Toast';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import type { Bin, ReceiptDocument, Store, StockBalance } from './store.types';

export function ReceiveStockModal({store,bins,onClose,onSaved}:{store:Store;bins:Bin[];onClose:()=>void;onSaved:()=>void}) {
 const [documents,setDocuments]=useState<ReceiptDocument[]>([]);
 const [loading,setLoading]=useState(true);
 const [documentId,setDocumentId]=useState('');
 const [allocations,setAllocations]=useState<Record<string,{binId:string;quantity:string}>>({});
 const [notes,setNotes]=useState('');
 const [saving,setSaving]=useState(false);
 const [requestId]=useState(()=>crypto.randomUUID());
 const document=documents.find(d=>d.id===documentId);
 const fm=store.storeType==='FM_STORE';
 useEffect(()=>{let active=true;void api<{data:ReceiptDocument[]}>(`/stores/${store.id}/receiving-options`).then(r=>{if(active)setDocuments(r.data)}).catch(e=>appToast.error(e.message)).finally(()=>{if(active)setLoading(false)});return()=>{active=false};},[store.id]);
 const selectDocument=(id:string)=>{setDocumentId(id);setAllocations(Object.fromEntries((documents.find(d=>d.id===id)?.lines??[]).map(l=>[l.id,{binId:bins[0]?.id??'',quantity:String(l.remaining)}])));};
 const submit=async()=>{
  if(saving||!document)return;
  const lines=document.lines.filter(l=>Number(allocations[l.id]?.quantity)>0);
  if(!lines.length||lines.some(l=>!allocations[l.id]?.binId||!Number.isFinite(Number(allocations[l.id].quantity))))return appToast.validation('Choose a bin and positive quantity for at least one line.');
  setSaving(true);
  try {
   await api(fm?'/fm-store/receive':'/rm-store/receive',{method:'POST',body:JSON.stringify(fm?{batchId:document.id,binId:allocations[document.lines[0].id].binId,notes}:{requestId,deliveryId:document.id,notes,lineAllocations:lines.map(l=>({lineId:l.id,productId:l.productId,uomId:l.uomId,binId:allocations[l.id].binId,acceptedQty:Number(allocations[l.id].quantity)}))})});
   onSaved();onClose();
  }catch(e){appToast.error(e instanceof Error?e.message:'Unable to receive stock.')}finally{setSaving(false)}
 };
 return <Modal title={`Receive into ${store.name}`} description={fm?'Select completed production output and its destination bin.':'Select a supplier delivery and assign its products to bins in this store.'} wide onClose={()=>{if(!saving)onClose()}} footer={<><Button disabled={saving} onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving||!document||!bins.length} onClick={submit}>{saving?'Receiving...':'Receive Stock'}</Button></>}>
  <FormField label={fm?'Production Batch':'Supplier Delivery'} required><Dropdown aria-label="Receipt source" value={documentId} onChange={e=>selectDocument(e.target.value)}><option value="">{loading?'Loading documents...':'Choose a document'}</option>{documents.map(d=><option key={d.id} value={d.id}>{d.number}{d.referenceNumber?` — ${d.referenceNumber}`:''}</option>)}</Dropdown></FormField>
  {!loading&&!documents.length&&<p className="py-4 text-sm text-[#73877c]">No outstanding {fm?'completed batches':'supplier deliveries'} are available to receive.</p>}
  {!bins.length&&<p className="text-sm text-amber-700">Create a bin in this store before receiving stock.</p>}
  <div className="space-y-3">{document?.lines.map(line=><div key={line.id} className="rounded-lg border border-[#e0e5dd] p-4"><p className="mb-3 text-sm font-semibold">{line.productName} <span className="font-normal text-[#73877c]">— {Number(line.remaining).toLocaleString()} {line.uomCode} remaining</span></p><div className="grid gap-3 sm:grid-cols-2 [&>div]:mb-0">
   <FormField label="Destination Bin" required><Dropdown aria-label={`Bin for ${line.productName}`} value={allocations[line.id]?.binId??''} onChange={e=>setAllocations({...allocations,[line.id]:{...allocations[line.id],binId:e.target.value}})}><option value="">Choose a bin</option>{bins.map(b=><option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}</Dropdown></FormField>
   <FormField label={`Quantity (${line.uomCode})`} required><Input aria-label={`Quantity for ${line.productName}`} type="number" min="0" max={Number(line.remaining)} step="0.001" readOnly={fm} value={allocations[line.id]?.quantity??''} onChange={e=>setAllocations({...allocations,[line.id]:{...allocations[line.id],quantity:e.target.value}})} /></FormField>
  </div></div>)}</div>
  <div className="mt-4"><FormField label="Notes"><Input value={notes} onChange={e=>setNotes(e.target.value)} /></FormField></div>
 </Modal>;
}

export function ReleaseStockModal({store,stock,onClose,onSaved}:{store:Store;stock:StockBalance;onClose:()=>void;onSaved:()=>void}) {
 const [orders,setOrders]=useState<{id:string;number:string}[]>([]);
 const [loading,setLoading]=useState(true);
 const [orderId,setOrderId]=useState('');
 const [quantity,setQuantity]=useState('');
 const [vehicle,setVehicle]=useState('');
 const [notes,setNotes]=useState('');
 const [saving,setSaving]=useState(false);
 const [requestId]=useState(()=>crypto.randomUUID());
 const fm=store.storeType==='FM_STORE',available=Number(stock.quantity)-Number(stock.reservedQty);
 useEffect(()=>{let active=true;void api<{data:{id:string;number:string}[]}>(`/stores/${store.id}/release-options?productId=${stock.productId}`).then(r=>{if(active)setOrders(r.data)}).catch(e=>appToast.error(e.message)).finally(()=>{if(active)setLoading(false)});return()=>{active=false};},[store.id,stock.productId]);
 const submit=async()=>{
  if(saving)return;
  if(!orderId||!Number.isFinite(Number(quantity))||Number(quantity)<=0||Number(quantity)>available)return appToast.validation('Select an order and enter a quantity within available stock.');
  if(fm&&vehicle.trim().length<2)return appToast.validation('Enter the dispatch vehicle number.');
  setSaving(true);
  try{await api(fm?'/dispatches':'/material-issues',{method:'POST',body:JSON.stringify({requestId,...(fm?{salesOrderId:orderId,vehicleNo:vehicle}:{productionOrderId:orderId}),notes,lines:[{productId:stock.productId,lotId:stock.lotId,fromBinId:stock.binId,uomId:stock.uomId,quantity:Number(quantity)}]})});onSaved();onClose()}catch(e){appToast.error(e instanceof Error?e.message:'Unable to release stock.')}finally{setSaving(false)}
 };
 return <Modal title={fm?'Dispatch Finished Stock':'Issue Raw Material'} description={`${stock.product.name} · ${store.name} / ${stock.bin.code} · Lot ${stock.lot.code}`} onClose={()=>{if(!saving)onClose()}} footer={<><Button disabled={saving} onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving||!orderId} onClick={submit}>{saving?'Releasing...':fm?'Dispatch Stock':'Issue Stock'}</Button></>}>
  <p className="mb-4 text-sm font-semibold">Available: {available.toLocaleString()} {stock.uom.code}</p>
  <FormField label={fm?'Sales Order':'Production Requisition'} required><Dropdown aria-label="Release order" value={orderId} onChange={e=>setOrderId(e.target.value)}><option value="">{loading?'Loading orders...':'Choose an order'}</option>{orders.map(o=><option key={o.id} value={o.id}>{o.number}</option>)}</Dropdown></FormField>
  {!loading&&!orders.length&&<p className="mb-4 text-sm text-[#73877c]">No open order requires this product.</p>}
  <FormField label={`Quantity (${stock.uom.code})`} required><Input type="number" min="0.001" step="0.001" max={available} value={quantity} onChange={e=>setQuantity(e.target.value)} /></FormField>
  {fm&&<FormField label="Vehicle Number" required><Input value={vehicle} onChange={e=>setVehicle(e.target.value)} /></FormField>}
  <FormField label="Notes"><Input value={notes} onChange={e=>setNotes(e.target.value)} /></FormField>
 </Modal>;
}
