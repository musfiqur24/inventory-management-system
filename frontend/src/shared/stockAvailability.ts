export type AvailableStock={quantity:string|number;reservedQty:string|number;availableQty?:string|number;lot?:{qualityStatus?:string;expiryDate?:string|null};reservations?:Array<{sourceId:string;quantity:string|number}>};
export function availableForSource(stock:AvailableStock,sourceId:string){
 if((stock.lot?.qualityStatus&&stock.lot.qualityStatus!=='RELEASED')||(stock.lot?.expiryDate&&new Date(stock.lot.expiryDate).getTime()<Date.now()))return 0;
 const owned=stock.reservations?.filter(r=>r.sourceId===sourceId).reduce((sum,r)=>sum+Number(r.quantity),0)??0;
 return Math.max(0,Number(stock.quantity)-Number(stock.reservedQty)+owned);
}
