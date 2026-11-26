import { useCallback,useEffect,useState } from 'react';
import { api } from '../../shared/api/http';
import { useAuth } from '../auth/AuthContext';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dropdown } from '../../components/ui/Dropdown';
import { FormField } from '../../components/ui/FormField';
import { Badge } from '../../components/ui/Badge';
import { appToast } from '../../components/ui/ToastMessages';
type Permission={id:string;key:string;name:string;moduleCode:string|null;resource:string|null;action:string|null};
type Module={code:string;name:string};
export function PermissionsPage(){
 const {user}=useAuth();
 const [permissions,setPermissions]=useState<Permission[]>([]);const [modules,setModules]=useState<Module[]>([]);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
 const [area,setArea]=useState({moduleCode:'feed',resource:'',name:''});
 const load=useCallback(async()=>{try{const [p,m]=await Promise.all([api<{data:Permission[]}>('/roles/permissions'),api<{data:Module[]}>('/modules')]);setPermissions(p.data);setModules(m.data);}catch(e){appToast.error(e instanceof Error?e.message:'Could not load permissions')}finally{setLoading(false)}},[]);
 useEffect(()=>{queueMicrotask(()=>{void load()})},[load]);
 const create=async(event:React.FormEvent)=>{event.preventDefault();setSaving(true);try{await api('/roles/permissions',{method:'POST',body:JSON.stringify(area)});setArea(current=>({...current,resource:'',name:''}));await load();appToast.success('Read and write permissions created')}catch(e){appToast.error(e instanceof Error?e.message:'Could not create permissions')}finally{setSaving(false)}};
 return <PageContainer loading={loading} cap="ACCESS CONTROL" title="Permissions" description="Manage the permission catalog for Feed and Agro. Assign these permissions to roles from the Roles page.">
  {user?.isSuperAdmin&&<Card><h2 className="mb-4 font-semibold text-[#193b2d]">Create permission area</h2><form onSubmit={create} className="grid gap-4 sm:grid-cols-3">
   <FormField label="Module"><Dropdown value={area.moduleCode} onChange={e=>setArea({...area,moduleCode:e.target.value})}>{modules.map(m=><option key={m.code} value={m.code}>{m.name}</option>)}</Dropdown></FormField>
   <FormField label="Area name"><Input required placeholder="e.g. Crop Store" value={area.name} onChange={e=>setArea({...area,name:e.target.value})}/></FormField>
   <FormField label="Area code"><Input required pattern="[a-z][a-z0-9_]*" placeholder="e.g. crop_store" value={area.resource} onChange={e=>setArea({...area,resource:e.target.value})}/></FormField>
   <div className="sm:col-span-3"><Button variant="primary" disabled={saving}>{saving?'Creating...':'Create read/write permissions'}</Button></div>
  </form></Card>}
  {modules.map(module=><Card key={module.code} padding="none"><h2 className="border-b border-[#e0e5dd] px-5 py-4 font-semibold text-[#193b2d]">{module.name}</h2><div className="overflow-x-auto"><table className="w-full min-w-120 table-fixed text-sm"><colgroup><col className="w-2/5"/><col className="w-3/10"/><col className="w-3/10"/></colgroup><thead><tr className="border-b border-[#e0e5dd] bg-[#f7f9f5] text-xs text-[#7a9185]"><th className="px-5 py-3 text-left">Permission area</th><th className="px-5 py-3 text-left">Read permission</th><th className="px-5 py-3 text-left">Write permission</th></tr></thead><tbody>
   {[...new Set(permissions.filter(p=>p.moduleCode===module.code).map(p=>p.resource))].map(resource=>{const ps=permissions.filter(p=>p.moduleCode===module.code&&p.resource===resource);return <tr key={resource} className="border-b border-[#edf0e9] last:border-0"><td className="px-5 py-4 font-medium text-[#31483d]">{ps[0]?.name}</td>{['read','write'].map(action=><td key={action} className="break-all px-5 py-4 text-xs text-[#64796e]">{ps.find(p=>p.action===action)?.key??'-'}</td>)}</tr>})}
  </tbody></table></div></Card>)}
  <Card><h2 className="mb-3 font-semibold text-[#193b2d]">Administration</h2><div className="flex flex-wrap gap-3">{permissions.filter(p=>!p.moduleCode).map(p=><Badge key={p.id} variant="brand">{p.key}</Badge>)}</div></Card>
 </PageContainer>;
}
