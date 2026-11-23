import { preparePendingStockRequest, finishPendingStockRequest } from './pendingStockRequests';
const API_URL=import.meta.env.VITE_API_URL??"/api/v1";
const keys={access:"inventory.accessToken",refresh:"inventory.refreshToken",organizationId:"inventory.organizationId",organizationName:"inventory.organizationName",organizationCode:"inventory.organizationCode"} as const;

export class ApiError extends Error{
  readonly status:number;
  readonly code:string;
  readonly details?:unknown;
  constructor(message:string,status:number,code:string,details?:unknown){super(message);this.name="ApiError";this.status=status;this.code=code;this.details=details;}
}

let accessTokenMemory='';
// Remove credentials left by earlier releases; only workspace selection persists.
localStorage.removeItem(keys.access);localStorage.removeItem(keys.refresh);
export const session={
  get accessToken(){return accessTokenMemory;},
  set(accessToken:string){accessTokenMemory=accessToken;},
};
export const clearSession=()=>{accessTokenMemory='';Object.values(keys).forEach(key=>localStorage.removeItem(key));};
export const selectedOrg=()=>localStorage.getItem(keys.organizationId)??"";
export const selectedOrgName=()=>localStorage.getItem(keys.organizationName)??"";
export const selectedOrgCode=()=>localStorage.getItem(keys.organizationCode)??"";
export const setOrganizationDetails=(organization:{id:string;name:string;code?:string})=>{
  localStorage.setItem(keys.organizationId,organization.id);
  localStorage.setItem(keys.organizationName,organization.name);
  if(organization.code)localStorage.setItem(keys.organizationCode,organization.code);else localStorage.removeItem(keys.organizationCode);
  window.dispatchEvent(new CustomEvent("organizationChanged",{detail:organization}));
};
export const syncAssignedOrganization=(organizations:Array<{id:string;name:string;code:string}>)=>{
  const organization=organizations.find(item=>item.id===selectedOrg())??organizations[0];
  if(organization)setOrganizationDetails(organization);
  else{localStorage.removeItem(keys.organizationId);localStorage.removeItem(keys.organizationName);localStorage.removeItem(keys.organizationCode);window.dispatchEvent(new Event("organizationChanged"));}
  return organization;
};
export const ensureOrgDetails=async()=>selectedOrgName();

type ErrorDetails={issues?:Array<{path?:string;message?:string}>;fieldErrors?:Record<string,string[]>;formErrors?:string[]};
type ErrorPayload={error?:string|{message?:string;code?:string;details?:ErrorDetails|unknown};message?:string};
function errorInfo(payload:ErrorPayload,fallback:string){
  if(typeof payload.error==="string")return{message:payload.error,code:"REQUEST_FAILED",details:undefined};
  const details=payload.error?.details as ErrorDetails|undefined;
  const issue=details?.issues?.find(item=>item.message);
  const field=details?.fieldErrors&&Object.entries(details.fieldErrors).find(([,messages])=>messages?.length);
  const detailMessage=issue?.message?(issue.path?issue.path+": ":"")+issue.message:field?field[0]+": "+field[1][0]:details?.formErrors?.[0];
  return{message:payload.error?.message?.trim()||detailMessage||payload.message?.trim()||fallback,code:payload.error?.code??"REQUEST_FAILED",details};
}
type RefreshPayload={data:{accessToken:string}};
let refreshRequest:Promise<RefreshPayload>|null=null;

async function parseResponse(response:Response):Promise<unknown>{
  const text=await response.text();
  if(!text)return {};
  try{return JSON.parse(text);}catch{return {error:{message:text}};}
}
async function refreshSession(){
  if(!refreshRequest){
    const request=()=>fetch(API_URL+"/auth/refresh",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:"{}"});
    refreshRequest=(navigator.locks?navigator.locks.request("inventory-refresh",request):request())
      .then(async response=>{
        const payload=await parseResponse(response) as RefreshPayload&ErrorPayload;
        if(!response.ok){const info=errorInfo(payload,"Session expired");throw new ApiError(info.message,response.status,info.code==="REQUEST_FAILED"?"REFRESH_FAILED":info.code,info.details);}
        session.set(payload.data.accessToken);
        return payload;
      })
      .finally(()=>{refreshRequest=null;});
  }
  return refreshRequest;
}

export async function api<T=unknown>(path:string,init:RequestInit={},retried=false):Promise<T>{
  let pendingFingerprint:string|undefined;
  if((init.method??'GET').toUpperCase()==='POST'&&typeof init.body==='string'){
    let actor='';
    try{actor=String(JSON.parse(atob(session.accessToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub??'');}catch{/* Cookie restoration may not yet have issued an access token. */}
    const pending=await preparePendingStockRequest(path,init.body,actor,selectedOrg());
    init={...init,body:pending.body};pendingFingerprint=pending.fingerprint;
  }
  const headers=new Headers(init.headers);
  headers.set("Accept","application/json");
  if(init.body&&!headers.has("Content-Type"))headers.set("Content-Type","application/json");
  if(session.accessToken)headers.set("Authorization","Bearer "+session.accessToken);
  if(selectedOrg())headers.set("x-organization-id",selectedOrg());

  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),30000);
  let response:Response;
  try{response=await fetch(API_URL+path,{...init,headers,credentials:"same-origin",signal:init.signal??controller.signal});}finally{window.clearTimeout(timer);}
  if(response.status===401&&!retried&&(!path.startsWith("/auth/")||path==="/auth/me"||path==="/auth/profile")){
    try{await refreshSession();return api<T>(path,init,true);}
    catch{clearSession();window.dispatchEvent(new Event("authExpired"));}
  }
  const payload=await parseResponse(response) as T&ErrorPayload;
  if(pendingFingerprint)finishPendingStockRequest(pendingFingerprint,response.status);
  if(!response.ok){const info=errorInfo(payload,"Request failed");throw new ApiError(info.message,response.status,info.code,info.details);}

  const method=(init.method??"GET").toUpperCase();
  if(["POST","PUT","PATCH","DELETE"].includes(method)&&!path.startsWith("/auth/")&&!path.startsWith("/users")&&!path.startsWith("/notifications")&&path!=="/organizations"){
    const message=method==="DELETE"?"Removed successfully.":path.endsWith("/approve")?"Approved successfully.":method==="POST"?"Saved successfully.":"Updated successfully.";
    window.dispatchEvent(new CustomEvent("apiMutationSuccess",{detail:{message}}));
  }
  return payload;
}
