import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
export function ResetPasswordPage(){
  const [params]=useSearchParams();const token=new URLSearchParams(window.location.hash.slice(1)).get('token')??params.get('token')??'';
  const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
  return <main className="grid min-h-dvh place-items-center bg-[#f3f5f2] p-5"><form className="w-full max-w-md space-y-5 rounded-xl bg-white p-8 shadow" onSubmit={async e=>{e.preventDefault();if(password!==confirm){setError('Passwords do not match');return;}setBusy(true);setError('');try{await api('/auth/reset-password',{method:'POST',body:JSON.stringify({token,password})});setDone(true);window.history.replaceState(null,'','/reset-password');}catch(cause){setError(cause instanceof Error?cause.message:'Unable to reset password');}finally{setBusy(false);}}}>
    <h1 className="text-2xl font-bold">Reset password</h1>
    {done?<><p>Your password has changed. Sign in again on your devices.</p><Link to="/login">Return to sign in</Link></>:<>
    {!token&&<p role="alert">This reset link is incomplete. Request a new one.</p>}
    <label className="block">New password<Input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label className="block">Confirm password<Input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
    <p className="text-sm">Use 12-72 characters.</p>{error&&<p role="alert" className="text-red-700">{error}</p>}
    <Button type="submit" variant="primary" disabled={busy||!token}>{busy?'Saving-':'Save password'}</Button></>}
  </form></main>;
}
