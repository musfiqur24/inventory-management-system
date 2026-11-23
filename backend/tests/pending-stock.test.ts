import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePendingStockRequest,finishPendingStockRequest} from '../../frontend/src/shared/api/pendingStockRequests.js';
test('uncertain stock requests survive a form restart without storing payloads',async()=>{
 const values=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
 const body={requestId:'first-key',salesOrderId:'order',notes:'sensitive business note',lines:[{quantity:5}]};
 const first=await preparePendingStockRequest('/dispatches',JSON.stringify(body),'user','org');
 finishPendingStockRequest(first.fingerprint!,503);
 const retry=await preparePendingStockRequest('/dispatches',JSON.stringify({...body,requestId:'new-form-key'}),'user','org');
 assert.equal(JSON.parse(retry.body).requestId,'first-key');
 assert.ok(![...values.values()].join('').includes(body.notes));
 const other=await preparePendingStockRequest('/dispatches',JSON.stringify({...body,requestId:'other-user'}),'different-user','org');
 assert.equal(JSON.parse(other.body).requestId,'other-user');
 finishPendingStockRequest(first.fingerprint!,201);
 const fresh=await preparePendingStockRequest('/dispatches',JSON.stringify({...body,requestId:'new-intent'}),'user','org');
 assert.equal(JSON.parse(fresh.body).requestId,'new-intent');
});
