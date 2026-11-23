// Persist only a request fingerprint and key, never business payloads or tokens.
const storageKey='inventory.pendingStockRequests';
type Pending={fingerprint:string;requestId:string;createdAt:number};
function read():Pending[]{try{const value:unknown=JSON.parse(localStorage.getItem(storageKey)??'[]');return Array.isArray(value)?value.filter((row):row is Pending=>typeof row?.fingerprint==='string'&&typeof row?.requestId==='string'&&typeof row?.createdAt==='number'):[];}catch{return [];}}
function write(rows:Pending[]){localStorage.setItem(storageKey,JSON.stringify(rows.slice(-100)));}
function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
 return value;
}
export async function preparePendingStockRequest(path:string,body:string,actor:string,organization:string){
 if(!['/rm-store/receive','/material-issues','/dispatches'].includes(path))return {body};
 const payload=JSON.parse(body) as Record<string,unknown>;
 if(typeof payload.requestId!=='string')return {body};
 const {requestId,...values}=payload;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical({path,actor,organization,values}))));
 const fingerprint=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 const rows=read().filter(row=>row.createdAt>Date.now()-30*86400000);
 const existing=rows.find(row=>row.fingerprint===fingerprint);
 const key=existing?.requestId??requestId;
 if(!existing){rows.push({fingerprint,requestId:key,createdAt:Date.now()});write(rows);}
 return {body:JSON.stringify({...payload,requestId:key}),fingerprint};
}
export function finishPendingStockRequest(fingerprint:string,status:number){
 // Network errors and server failures leave the identity available after restart.
 if((status>=200&&status<300)||(status>=400&&status<500&&![401,408,429].includes(status)))write(read().filter(row=>row.fingerprint!==fingerprint));
}
