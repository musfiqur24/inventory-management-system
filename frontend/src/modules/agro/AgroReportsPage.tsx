import { useEffect,useState } from "react";
import { appToast } from "../../components/ui/ToastMessages";
import { api } from "../../shared/api/http";
import { PageContainer } from "../../components/ui/PageContainer";
import { Card } from "../../components/ui/Card";
export type ModuleReport={id:string;moduleCode:string;title:string;reportingDate:string;metrics:Record<string,number>};
export function ReportCards({reports}:{reports:ModuleReport[]}){
 return <div className="grid gap-4">{reports.length?reports.map(r=><Card key={r.id}><h2 className="font-semibold">{r.title}</h2><p>{new Date(r.reportingDate).toLocaleDateString()}</p><dl className="mt-3 grid gap-2 sm:grid-cols-3">{Object.entries(r.metrics).map(([key,value])=><div key={key}><dt>{key}</dt><dd className="text-xl font-semibold">{value.toLocaleString()}</dd></div>)}</dl></Card>):<Card>No Agro reports have been recorded yet.</Card>}</div>;
}
export function AgroReportsPage(){
 const [reports,setReports]=useState<ModuleReport[]>([]);const [loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;api<{data:ModuleReport[]}>("/module-reports/agro").then(r=>{if(active)setReports(r.data)}).catch(e=>{if(active)appToast.error(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return <PageContainer loading={loading} cap="AGRO" title="Agro Reports" description="Reports and metrics for your organization's Agro module.">{<ReportCards reports={reports}/>}</PageContainer>;
}
