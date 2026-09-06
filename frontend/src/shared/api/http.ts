const API_URL=import.meta.env.VITE_API_URL??"/api/v1";
const keys={access:"inventory.accessToken",refresh:"inventory.refreshToken",organizationId:"inventory.organizationId",organizationName:"inventory.organizationName",organizationCode:"inventory.organizationCode"} as const;

export class ApiError extends Error{
  readonly status:number;
  readonly code:string;
  readonly details?:unknown;
  constructor(message:string,status:number,code:string,details?:unknown){super(message);this.name="ApiError";this.status=status;this.code=code;this.details=details;}
}

export const session={
  get accessToken(){return localStorage.getItem(keys.access)??"";},
  get refreshToken(){return localStorage.getItem(keys.refresh)??"";},
  set(accessToken:string,refreshToken:string){localStorage.setItem(keys.access,accessToken);localStorage.setItem(keys.refresh,refreshToken);},
};
export const clearSession=()=>{Object.values(keys).forEach(key=>localStorage.removeItem(key));};
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

type ErrorPayload={error?:{message?:string;code?:string;details?:unknown}};
type RefreshPayload={data:{accessToken:string;refreshToken:string}};
let refreshRequest:Promise<RefreshPayload>|null=null;

async function parseResponse(response:Response):Promise<unknown>{
  const text=await response.text();
  if(!text)return {};
  try{return JSON.parse(text);}catch{return {error:{message:text}};}
}
async function refreshSession(){
  if(!refreshRequest){
    refreshRequest=fetch(API_URL+"/auth/refresh",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({refreshToken:session.refreshToken})})
      .then(async response=>{
        const payload=await parseResponse(response) as RefreshPayload&ErrorPayload;
        if(!response.ok)throw new ApiError(payload.error?.message??"Session expired",response.status,payload.error?.code??"REFRESH_FAILED",payload.error?.details);
        session.set(payload.data.accessToken,payload.data.refreshToken);
        return payload;
      })
      .finally(()=>{refreshRequest=null;});
  }
  return refreshRequest;
}

export async function api<T=unknown>(path:string,init:RequestInit={},retried=false):Promise<T>{
  const headers=new Headers(init.headers);
  headers.set("Accept","application/json");
  if(init.body&&!headers.has("Content-Type"))headers.set("Content-Type","application/json");
  if(session.accessToken)headers.set("Authorization","Bearer "+session.accessToken);
  if(selectedOrg())headers.set("x-organization-id",selectedOrg());

  let response=await fetch(API_URL+path,{...init,headers});
  if(response.status===401&&!retried&&session.refreshToken&&path!=="/auth/refresh"){
    try{await refreshSession();return api<T>(path,init,true);}
    catch{clearSession();window.dispatchEvent(new Event("authExpired"));}
  }
  const payload=await parseResponse(response) as T&ErrorPayload;
  if(!response.ok)throw new ApiError(payload.error?.message??"Request failed",response.status,payload.error?.code??"REQUEST_FAILED",payload.error?.details);

  const method=(init.method??"GET").toUpperCase();
  if(["POST","PUT","PATCH","DELETE"].includes(method)&&!path.startsWith("/auth/")&&!path.startsWith("/users")&&path!=="/organizations"){
    const message=method==="DELETE"?"Removed successfully.":path.endsWith("/approve")?"Approved successfully.":method==="POST"?"Saved successfully.":"Updated successfully.";
    window.dispatchEvent(new CustomEvent("apiMutationSuccess",{detail:{message}}));
  }
  return payload;
}
