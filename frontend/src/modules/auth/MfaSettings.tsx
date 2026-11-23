import { useState } from 'react';
import { api, session, clearSession } from '../../shared/api/http';
import { useAuth } from './AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/ui/FormField';
export function MfaSettings(){
 const {user,refreshUser}=useAuth();const [password,setPassword]=useState(''),[code,setCode]=useState(''),[secret,setSecret]=useState(''),[codes,setCodes]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const run=async(work:()=>Promise<void>)=>{setBusy(true);setError('');try{await work();}catch(cause){setError(cause instanceof Error?cause.message:'Unable to update two-factor authentication');}finally{setBusy(false);}};
 return <Card><h2 className="mb-3 font-bold">Two-factor authentication</h2><p className="mb-4">{user?.mfaEnabled?'Enabled. Keep your recovery codes somewhere safe.':'Use an authenticator app. Production administrators and managers must enable this before changing business data.'}</p>
 {error&&<p role="alert" className="mb-3 text-red-700">{error}</p>}
 {codes.length>0?<><p>Save these one-use recovery codes offline. They are shown only once.</p><pre className="my-4 select-all whitespace-pre-wrap rounded bg-slate-100 p-4">{codes.join('\n')}</pre><Button onClick={()=>setCodes([])}>I have saved my recovery codes</Button></>:<>
 <FormField label="Current password"><Input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></FormField>
 {secret&&<p className="mb-4 break-all">Add an account in your authenticator using this setup key: <strong className="select-all">{secret}</strong></p>}
 {(secret||user?.mfaEnabled)&&<FormField label="Six-digit authenticator code"><Input autoComplete="one-time-code" inputMode="numeric" value={code} onChange={e=>setCode(e.target.value)}/></FormField>}
 {user?.mfaEnabled?<Button disabled={busy||!password||code.length!==6} onClick={()=>run(async()=>{await api('/auth/mfa/disable',{method:'POST',body:JSON.stringify({currentPassword:password,code})});clearSession();window.location.assign('/login');})}>Disable and sign out</Button>:secret?<Button disabled={busy||code.length!==6} onClick={()=>run(async()=>{const r=await api<{data:{recoveryCodes:string[];accessToken:string}}>('/auth/mfa/enable',{method:'POST',body:JSON.stringify({code})});session.set(r.data.accessToken);setSecret('');setPassword('');setCode('');setCodes(r.data.recoveryCodes);await refreshUser();})}>Verify and enable</Button>:<Button disabled={busy||!password} onClick={()=>run(async()=>{const r=await api<{data:{secret:string}}>('/auth/mfa/setup',{method:'POST',body:JSON.stringify({currentPassword:password})});setSecret(r.data.secret);})}>Set up authenticator</Button>}
 </>}
 </Card>;
}
