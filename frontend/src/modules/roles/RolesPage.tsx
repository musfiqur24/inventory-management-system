import { useCallback,useEffect,useState } from 'react';
import { api } from '../../shared/api/http';
import { useAuth } from '../auth/AuthContext';
import { PageContainer } from '../../components/ui/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/ui/FormField';
import { Checkbox } from '../../components/ui/Checkbox';
import { Modal } from '../../components/ui/Modal';
import { appToast } from '../../components/ui/ToastMessages';
type Permission={id:string;key:string;name:string;moduleCode:string|null;resource:string|null;action:string|null};
type Role={id:string;code:string;name:string;description:string|null;isSystem:boolean;organizationId:string|null;permissions:{permission:Permission}[]};
export function RolesPage(){
 const {user,refreshUser}=useAuth();
 const [roles,setRoles]=useState<Role[]>([]);const [permissions,setPermissions]=useState<Permission[]>([]);const [modules,setModules]=useState<{code:string;name:string}[]>([]);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [open,setOpen]=useState(false);const [editing,setEditing]=useState<Role|null>(null);
 const [form,setForm]=useState({name:'',description:'',permissionIds:[] as string[]});
 const load=useCallback(async()=>{try{const [r,p,m]=await Promise.all([api<{data:Role[]}>('/roles'),api<{data:Permission[]}>('/roles/permissions'),api<{data:{code:string;name:string}[]}>('/modules')]);setRoles(r.data);setPermissions(p.data);setModules(m.data);}catch(e){appToast.error(e instanceof Error?e.message:'Could not load roles')}finally{setLoading(false)}},[]);
 useEffect(()=>{queueMicrotask(()=>{void load()})},[load]);
 const toggle=(permission:Permission,checked:boolean)=>setForm(current=>{
  const ids=new Set(current.permissionIds);if(checked)ids.add(permission.id);else ids.delete(permission.id);
  const pair=permissions.find(p=>p.moduleCode===permission.moduleCode&&p.resource===permission.resource&&p.action===(permission.action==='write'?'read':'write'));
  if(pair&&permission.moduleCode){if(checked&&permission.action==='write')ids.add(pair.id);if(!checked&&permission.action==='read')ids.delete(pair.id);}
  return {...current,permissionIds:[...ids]};
 });
 const edit=(role:Role|null)=>{setEditing(role);setForm({name:role?.name??'',description:role?.description??'',permissionIds:role?.permissions.map(p=>p.permission.id)??[]});setOpen(true)};
 const save=async()=>{setSaving(true);try{await api(editing?'/roles/'+editing.id:'/roles',{method:editing?'PUT':'POST',body:JSON.stringify(form)});setOpen(false);await load();await refreshUser();appToast.success('Role saved')}catch(e){appToast.error(e instanceof Error?e.message:'Could not save role')}finally{setSaving(false)}};
 return <PageContainer loading={loading} cap="ACCESS CONTROL" title="Roles" description="Create roles, assign permissions, and use them when creating users.">
  <div><Button variant="primary" onClick={()=>edit(null)}>Create role</Button></div>
  <div className="grid gap-3">{roles.map(role=><Card key={role.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{role.name}</h2><p className="text-sm text-[#7a9185]">{role.description||role.code} / {role.permissions.filter(p=>p.permission.moduleCode||p.permission.key.endsWith('.manage')).length} permissions</p></div><Button disabled={role.code==='SUPER_ADMIN'||(!user?.isSuperAdmin&&role.isSystem)} onClick={()=>edit(role)}>Edit role</Button></div></Card>)}</div>
  {open&&<Modal title={editing?'Edit role':'Create role'} description="Write access includes read access for the same area." onClose={()=>setOpen(false)} footer={<><Button onClick={()=>setOpen(false)}>Cancel</Button><Button variant="primary" disabled={saving||form.name.trim().length<2} onClick={()=>void save()}>{saving?'Saving...':'Save role'}</Button></>}>
   <div className="mx-auto grid w-full max-w-5xl gap-6">
    <div className="grid gap-4 sm:grid-cols-2">
     <FormField label="Role name"><Input aria-label="Role name" placeholder="e.g. Store Manager" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></FormField>
     <FormField label="Description"><Input aria-label="Description" placeholder="What this role is responsible for" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></FormField>
    </div>
    <div className="grid gap-4">
     <div><h3 className="font-semibold text-[#193b2d]">Assigned permissions</h3><p className="mt-1 text-sm text-[#7a9185]">Choose the areas this role can view or change.</p></div>
     {modules.map(module=><section key={module.code} className="overflow-hidden rounded-xl border border-[#e0e5dd] bg-white">
      <h4 className="border-b border-[#e0e5dd] bg-[#f4f7f1] px-5 py-3 text-sm font-semibold text-[#193b2d]">{module.name}</h4>
      <div className="overflow-x-auto"><table className="w-full min-w-96 table-fixed text-sm">
       <colgroup><col className="w-3/5"/><col className="w-1/5"/><col className="w-1/5"/></colgroup>
       <thead><tr className="border-b border-[#e0e5dd] text-xs text-[#7a9185]"><th className="px-5 py-3 text-left font-semibold">Permission area</th><th className="px-2 py-3 text-center font-semibold">Read</th><th className="px-2 py-3 text-center font-semibold">Write</th></tr></thead>
       <tbody>{[...new Set(permissions.filter(p=>p.moduleCode===module.code).map(p=>p.resource))].map(resource=>{
        const ps=permissions.filter(p=>p.moduleCode===module.code&&p.resource===resource);
        return <tr key={resource} className="border-b border-[#edf0e9] last:border-0 hover:bg-[#fafcf8]"><td className="px-5 py-3 font-medium text-[#31483d]">{ps[0]?.name}</td>
         {['read','write'].map(action=>{const p=ps.find(p=>p.action===action);return <td key={action} className="px-2 py-2 text-center align-middle">{p&&<Checkbox className="size-10 min-h-10 justify-center p-0 [&>span:last-child]:sr-only" label={module.name+' '+p.name+' '+action} checked={form.permissionIds.includes(p.id)} onChange={e=>toggle(p,e.target.checked)}/>}</td>})}
        </tr>;
       })}</tbody>
      </table></div>
     </section>)}
     <section className="rounded-xl border border-[#e0e5dd] bg-white"><h4 className="border-b border-[#e0e5dd] bg-[#f4f7f1] px-5 py-3 text-sm font-semibold text-[#193b2d]">Administration</h4><div className="flex flex-wrap gap-3 p-4">{permissions.filter(p=>!p.moduleCode).map(p=><Checkbox key={p.id} label={p.key.replace('.manage',' management')} checked={form.permissionIds.includes(p.id)} onChange={e=>toggle(p,e.target.checked)}/>)}</div></section>
    </div>
   </div>
  </Modal>}
 </PageContainer>;
}
