import type { RequestHandler } from 'express';
const totals=new Map<string,{requests:number;errors:number;milliseconds:number}>();
export const measureRequests:RequestHandler=(req,res,next)=>{
 const started=performance.now();
 res.once('finish',()=>{const key=req.method;const row=totals.get(key)??{requests:0,errors:0,milliseconds:0};row.requests++;if(res.statusCode>=500)row.errors++;row.milliseconds+=performance.now()-started;totals.set(key,row);});next();
};
export const requestMetrics=()=>Object.fromEntries(totals);
