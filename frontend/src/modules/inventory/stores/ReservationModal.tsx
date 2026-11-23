import { useEffect, useState } from 'react';
import { api } from '../../../shared/api/http';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { FormField } from '../../../components/ui/FormField';
import { appToast } from '../../../components/ui/ToastMessages';
import type { StockBalance, Store } from './store.types';
export function ReservationModal({stock,store,onClose,onSaved}:{stock:StockBalance;store:Store;onClose:()=>void;onSaved:()=>void}){
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [orders,setOrders]=useState<Array<{id:string;number:string}>>([]),[rows,setRows]=useState<Array<{id:string;sourceId:string;quantity:string}>>([]),[sourceId,setSource]=useState(''),[quantity,setQuantity]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;void Promise.all([api<{data:Array<{id:string;number:string}>}>(`/stores/${store.id}/release-options?productId=${stock.productId}`),api<{data:Array<{id:string;balanceId:string;sourceId:string;quantity:string}>;nextCursor:string|null}>(`/reservations?balanceId=${stock.id}`)]).then(([o,r])=>{if(active){setOrders(o.data);setRows(r.data);setNextCursor(r.nextCursor);}}).catch(e=>appToast.error(e.message));return()=>{active=false;};},[stock.id,stock.productId,store.id,revision]);
  return <Modal title="Reserve stock" description={stock.product.name+' - '+stock.bin.code} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
    <p className="mb-4 text-sm">Reservations set stock aside for an approved order. Issuing to that order consumes its reservation automatically.</p>
    <FormField label={store.storeType==='RM_STORE'?'Production requisition':'Sales order'}><Dropdown value={sourceId} onChange={e=>setSource(e.target.value)}><option value="">Select order</option>{orders.map(order=><option key={order.id} value={order.id}>{order.number}</option>)}</Dropdown></FormField>
    <FormField label={'Quantity ('+stock.uom.code+')'}><Input type="number" min="0.001" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></FormField>
    <Button variant="primary" disabled={busy||!sourceId||Number(quantity)<=0} onClick={async()=>{setBusy(true);try{await api('/reservations',{method:'POST',body:JSON.stringify({balanceId:stock.id,sourceType:store.storeType==='RM_STORE'?'PRODUCTION_REQUISITION':'SALES_ORDER',sourceId,quantity:Number(quantity)})});setQuantity('');setRevision(v=>v+1);onSaved();}catch(e){appToast.error(e instanceof Error?e.message:'Unable to reserve stock');}finally{setBusy(false);}}}>Reserve</Button>
    <div className="mt-5 space-y-2">{rows.map(row=><div className="flex items-center justify-between gap-3 rounded border p-3" key={row.id}><span>{orders.find(o=>o.id===row.sourceId)?.number??'Order'}: {Number(row.quantity).toLocaleString()} {stock.uom.code}</span><Button disabled={busy} onClick={async()=>{setBusy(true);try{await api('/reservations/'+row.id,{method:'DELETE'});setRevision(v=>v+1);onSaved();}catch(e){appToast.error(e instanceof Error?e.message:'Unable to release reservation');}finally{setBusy(false);}}}>Release reservation</Button></div>)}</div>
    {nextCursor&&<Button disabled={busy} onClick={async()=>{setBusy(true);try{const result=await api<{data:Array<{id:string;sourceId:string;quantity:string}>;nextCursor:string|null}>(`/reservations?balanceId=${stock.id}&cursor=${nextCursor}`);setRows(current=>[...current,...result.data]);setNextCursor(result.nextCursor);}catch(error){appToast.error(error instanceof Error?error.message:'Unable to load reservations');}finally{setBusy(false);}}}>Load more reservations</Button>}
  </Modal>;
}
