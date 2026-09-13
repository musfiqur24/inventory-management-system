import { LoadingBoundary } from "../ui/Skeleton";
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { Modal } from '../ui/Modal';
import { appToast } from '../ui/Toast';
type Notification={id:string;title:string;message:string;requisitionId:string|null;deliveryId:string|null;createdAt:string;readAt:string|null};
export function NotificationBell(){
 const [items,setItems]=useState<Notification[]>([]),[count,setCount]=useState(0),[open,setOpen]=useState(false),[error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const navigate=useNavigate();
 useEffect(()=>{
  let active=true;
  const load=()=>api<{data:Notification[];unreadCount:number}>('/notifications').then(r=>{if(active){setItems(r.data);setCount(r.unreadCount);setError('')}}).catch(()=>{if(active)setError('Unable to load notifications.');}).finally(()=>{if(active)setLoading(false)});
  void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},15000);
  const refresh=()=>void load();window.addEventListener('focus',refresh);window.addEventListener('notificationsChanged',refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('notificationsChanged',refresh)};
 },[open]);
 const view=async(item:Notification)=>{
  try{await api('/notifications/'+item.id+'/read',{method:'PATCH'});setItems(items.map(n=>n.id===item.id?{...n,readAt:new Date().toISOString()}:n));if(!item.readAt)setCount(c=>Math.max(0,c-1));setOpen(false);navigate(item.deliveryId?'/supplier-challans?challan='+encodeURIComponent(item.deliveryId):'/purchase-requisitions?requisition='+encodeURIComponent(item.requisitionId!));}catch(e){appToast.error(e instanceof Error?e.message:'Unable to open notification.')}
 };
 return <><button type="button" onClick={()=>setOpen(true)} aria-label={`Notifications, ${count} unread`} className="relative grid size-9 shrink-0 place-items-center rounded-xl border border-[#e0e5dd] text-[#315747] hover:bg-[#f8faf7]"><Bell size={18}/>{count>0&&<span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">{count>99?'99+':count}</span>}</button>
 {open&&<Modal title="Notifications" description="Approvals assigned to you in this organization." onClose={()=>setOpen(false)} fixedHeight><LoadingBoundary loading={loading}><div className="space-y-2">{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{!error&&!items.length&&<p className="py-8 text-center text-sm text-[#73877c]">No notifications yet.</p>}{items.map(item=><button key={item.id} type="button" onClick={()=>void view(item)} className={`block w-full rounded-lg border p-4 text-left hover:border-[#1a5c45] ${item.readAt?'border-[#e0e5dd] bg-white':'border-[#cbdcc6] bg-[#f0f7ec]'}`}><p className="text-sm font-semibold">{item.title}{!item.readAt&&<span className="ml-2 text-xs text-[#1a5c45]">New</span>}</p><p className="mt-1 text-sm">{item.message}</p><p className="mt-2 text-xs text-[#73877c]">{new Date(item.createdAt).toLocaleString()}</p></button>)}</div></LoadingBoundary></Modal>}</>;
}
