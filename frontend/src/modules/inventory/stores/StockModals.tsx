import { LoadingBoundary } from "../../../components/ui/Skeleton";
import { useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
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
 const [requisitionNumber,setRequisitionNumber]=useState('');
 const [allocations,setAllocations]=useState<Record<string,{binId:string;quantity:string;expiryDays:string}>>({});
 const [notes,setNotes]=useState('');
 const [saving,setSaving]=useState(false);
 const [requestId]=useState(()=>crypto.randomUUID());
 const document=documents.find(d=>d.id===documentId);
 const fm=store.storeType==='FM_STORE';
 const requisitionNumbers=[...new Set(documents.map(d=>d.referenceNumber).filter((number):number is string=>Boolean(number)))];
 const linkedDocuments=fm?documents:documents.filter(d=>d.referenceNumber===requisitionNumber);
 const lineComplete=(line:ReceiptDocument['lines'][number])=>{const allocation=allocations[line.id],quantity=Number(allocation?.quantity),expiryDays=Number(allocation?.expiryDays);return Boolean(allocation?.binId)&&Number.isFinite(quantity)&&quantity>0&&quantity<=Number(line.remaining)&&(fm||(Number.isInteger(expiryDays)&&expiryDays>0));};
 const formComplete=Boolean(document&&document.lines.length&&document.lines.every(lineComplete)&&bins.length);
 useEffect(()=>{let active=true;void api<{data:ReceiptDocument[]}>(`/stores/${store.id}/receiving-options`).then(r=>{if(active)setDocuments(r.data)}).catch(e=>appToast.error(e.message)).finally(()=>{if(active)setLoading(false)});return()=>{active=false};},[store.id]);
 const selectDocument=(id:string)=>{setDocumentId(id);setAllocations(Object.fromEntries((documents.find(d=>d.id===id)?.lines??[]).map(l=>[l.id,{binId:bins[0]?.id??'',quantity:String(l.remaining),expiryDays:''}])));};
 const submit=async()=>{
  if(saving||!document)return;
  const lines=document.lines.filter(l=>Number(allocations[l.id]?.quantity)>0);
  if(!lines.length||lines.some(l=>!allocations[l.id]?.binId||!Number.isFinite(Number(allocations[l.id].quantity))||(!fm&&(!Number.isInteger(Number(allocations[l.id].expiryDays))||Number(allocations[l.id].expiryDays)<=0))))return appToast.validation('Choose a bin, positive quantity, and positive whole-number expiry days for every received product.');
  setSaving(true);
  try {
   await api(fm?'/fm-store/receive':'/rm-store/receive',{method:'POST',body:JSON.stringify(fm?{batchId:document.id,binId:allocations[document.lines[0].id].binId,notes}:{requestId,deliveryId:document.id,notes,lineAllocations:lines.map(l=>({lineId:l.id,productId:l.productId,uomId:l.uomId,binId:allocations[l.id].binId,acceptedQty:Number(allocations[l.id].quantity),expiryDays:Number(allocations[l.id].expiryDays)}))})});
   onSaved();onClose();
  }catch(e){appToast.error(e instanceof Error?e.message:'Unable to receive stock.')}finally{setSaving(false)}
 };
 return <Modal title={`Receive into ${store.name}`} description={fm?'Select completed production output and its destination bin.':'Select a requisition, then choose one of its linked challans and assign the received products to bins.'} extraWide fixedHeight onClose={()=>{if(!saving)onClose()}} footer={<><Button disabled={saving} onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving||!formComplete} onClick={submit}>{saving?'Receiving...':'Receive Stock'}</Button></>}>
<LoadingBoundary loading={loading}>
  {!fm ? <div className="mb-5 grid gap-3 sm:grid-cols-2 [&>div]:mb-0">
    <FormField label="Requisition ID" required><Dropdown aria-label="Requisition ID" value={requisitionNumber} onChange={e=>{setRequisitionNumber(e.target.value);setDocumentId('');setAllocations({})}}><option value="">{loading?'Loading requisitions...':'Select a requisition'}</option>{requisitionNumbers.map(number=><option key={number} value={number}>{number}</option>)}</Dropdown></FormField>
    <FormField label="Linked Challan" required><Dropdown aria-label="Receipt source" disabled={!requisitionNumber} value={documentId} onChange={e=>selectDocument(e.target.value)}><option value="">{loading?'Loading documents...':!requisitionNumber?'Select a requisition first':'Choose a linked challan'}</option>{linkedDocuments.map(d=><option key={d.id} value={d.id}>{d.number}</option>)}</Dropdown></FormField>
  </div> : <FormField label="Production Batch" required><Dropdown aria-label="Receipt source" value={documentId} onChange={e=>selectDocument(e.target.value)}><option value="">{loading?'Loading documents...':'Choose a batch'}</option>{linkedDocuments.map(d=><option key={d.id} value={d.id}>{d.number}</option>)}</Dropdown></FormField>}
  {!loading&&!documents.length&&<p className="py-4 text-sm text-[#73877c]">No outstanding {fm?'completed batches':'supplier deliveries'} are available to receive.</p>}
  {!bins.length&&<p className="text-sm text-amber-700">Create a bin in this store before receiving stock.</p>}
  {document?.lines.length ? <div className="overflow-x-auto rounded-lg border border-[#d9e1d8]">
    <div className="min-w-0 sm:min-w-[760px]">
      <div className={fm?"hidden grid-cols-[minmax(220px,1.4fr)_minmax(220px,1fr)_160px] gap-3 sm:grid bg-[#f2f5f3] px-4 py-3 text-[10.5px] font-bold uppercase tracking-[.07em] text-[#53665c]":"hidden grid-cols-[minmax(220px,1.4fr)_minmax(220px,1fr)_160px_150px] gap-3 sm:grid bg-[#f2f5f3] px-4 py-3 text-[10.5px] font-bold uppercase tracking-[.07em] text-[#53665c]"}>
        <span>Product</span><span>Destination Bin</span><span>Quantity</span>{!fm&&<span>Expiry Days</span>}
      </div>
      <div className="max-h-72 overflow-y-auto">
        {document.lines.map(line=><div key={line.id} className={fm?"grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(220px,1.4fr)_minmax(220px,1fr)_160px] border-t border-[#e0e5dd] bg-white px-4 py-3":"grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(220px,1.4fr)_minmax(220px,1fr)_160px_150px] border-t border-[#e0e5dd] bg-white px-4 py-3"}>
          <div className="flex min-w-0 items-center gap-2"><strong className="truncate text-sm text-[#243b30]">{line.productName}</strong>{lineComplete(line)&&<CircleCheck size={17} className="shrink-0 text-emerald-600" aria-label="Line complete" />}</div>
          <Dropdown aria-label={`Bin for ${line.productName}`} value={allocations[line.id]?.binId??''} onChange={e=>setAllocations({...allocations,[line.id]:{...allocations[line.id],binId:e.target.value}})}><option value="">Choose a bin</option>{bins.map(b=><option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}</Dropdown>
          <div className="relative"><Input aria-label={`Quantity for ${line.productName}`} className="pr-12" type="number" min="0" max={Number(line.remaining)} step="0.001" readOnly={fm} value={allocations[line.id]?.quantity??''} onChange={e=>setAllocations({...allocations,[line.id]:{...allocations[line.id],quantity:e.target.value}})} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#73877c]">{line.uomCode}</span></div>
          {!fm&&<Input aria-label={`Expiry days for ${line.productName}`} type="number" min="1" step="1" placeholder="e.g. 70" value={allocations[line.id]?.expiryDays??''} onChange={e=>setAllocations({...allocations,[line.id]:{...allocations[line.id],expiryDays:e.target.value}})} />}
        </div>)}
      </div>
    </div>
  </div> : null}
  <div className="mt-4"><FormField label="Notes"><Input value={notes} onChange={e=>setNotes(e.target.value)} /></FormField></div>
 </LoadingBoundary></Modal>;
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
 return <Modal title={fm?'Dispatch Finished Stock':'Issue Raw Material'} description={`${stock.product.name} - ${store.name} / ${stock.bin.code} - Lot ${stock.lot.code}`} onClose={()=>{if(!saving)onClose()}} footer={<><Button disabled={saving} onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving||!orderId} onClick={submit}>{saving?'Releasing...':fm?'Dispatch Stock':'Issue Stock'}</Button></>}>
<LoadingBoundary loading={loading}>
  <p className="mb-4 text-sm font-semibold">Available: {available.toLocaleString()} {stock.uom.code}</p>
  <FormField label={fm?'Sales Order':'Production Requisition'} required><Dropdown aria-label="Release order" value={orderId} onChange={e=>setOrderId(e.target.value)}><option value="">{loading?'Loading orders...':'Choose an order'}</option>{orders.map(o=><option key={o.id} value={o.id}>{o.number}</option>)}</Dropdown></FormField>
  {!loading&&!orders.length&&<p className="mb-4 text-sm text-[#73877c]">No open order requires this product.</p>}
  <FormField label={`Quantity (${stock.uom.code})`} required><Input type="number" min="0.001" step="0.001" max={available} value={quantity} onChange={e=>setQuantity(e.target.value)} /></FormField>
  {fm&&<FormField label="Vehicle Number" required><Input value={vehicle} onChange={e=>setVehicle(e.target.value)} /></FormField>}
  <FormField label="Notes"><Input value={notes} onChange={e=>setNotes(e.target.value)} /></FormField>
 </LoadingBoundary></Modal>;
}
