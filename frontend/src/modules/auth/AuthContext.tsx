/* oxlint-disable react/only-export-components */
import { createContext,useCallback,useContext,useEffect,useMemo,useReducer,useState,type ReactNode } from "react";
import { api,clearSession,selectedOrg,session,syncAssignedOrganization } from "../../shared/api/http";

type AuthOrganization={id:string;name:string;code:string;permissions:string[];role:{id:string;code:string;name:string}};
export type AuthUser={id:string;email:string;fullName:string;avatarUrl:string|null;phone:string|null;presentAddress:string|null;permanentAddress:string|null;permissions:string[];isSuperAdmin:boolean;organizations:AuthOrganization[]};
export type ProfileUpdate={fullName:string;avatarUrl:string|null;phone:string|null;presentAddress:string|null;permanentAddress:string|null};
type Auth={user:AuthUser|null;loading:boolean;login:(email:string,password:string)=>Promise<void>;logout:()=>Promise<void>;updateProfile:(data:ProfileUpdate)=>Promise<void>;can:(permission:string)=>boolean};
const Context=createContext<Auth|null>(null);

export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<AuthUser|null>(null);
  const [loading,setLoading]=useState(()=>Boolean(session.accessToken));
  const [,organizationRevision]=useReducer(value=>value+1,0);
  const applyUser=useCallback((next:AuthUser)=>{syncAssignedOrganization(next.organizations);setUser(next);},[]);

  useEffect(()=>{
    const expire=()=>setUser(null);
    const organizationChanged=()=>organizationRevision();
    window.addEventListener("authExpired",expire);
    window.addEventListener("organizationChanged",organizationChanged);
    if(session.accessToken)api<{data:AuthUser}>("/auth/me").then(result=>applyUser(result.data)).catch(()=>{clearSession();setUser(null);}).finally(()=>setLoading(false));
    return()=>{window.removeEventListener("authExpired",expire);window.removeEventListener("organizationChanged",organizationChanged);};
  },[applyUser]);

  const value=useMemo<Auth>(()=>({
    user,
    loading,
    login:async(email,password)=>{const result=await api<{data:{accessToken:string;refreshToken:string;user:AuthUser}}>("/auth/login",{method:"POST",body:JSON.stringify({email,password})});session.set(result.data.accessToken,result.data.refreshToken);applyUser(result.data.user);},
    logout:async()=>{try{await api("/auth/logout",{method:"POST",body:JSON.stringify({refreshToken:session.refreshToken})});}finally{clearSession();setUser(null);}},
    updateProfile:async data=>{const result=await api<{data:AuthUser}>("/auth/profile",{method:"PATCH",body:JSON.stringify(data)});applyUser(result.data);},
    can:permission=>Boolean(user&&(user.isSuperAdmin||user.organizations.find(organization=>organization.id===selectedOrg())?.permissions.includes(permission))),
  }),[applyUser,loading,user]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAuth=()=>{const value=useContext(Context);if(!value)throw new Error("useAuth must be used inside AuthProvider");return value;};
