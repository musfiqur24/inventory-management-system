export type StoreType = 'RM_STORE' | 'FM_STORE';
export interface Store { id: string; code: string; name: string; storeType: StoreType; address?: string | null; _count?: { bins: number }; }
export interface Bin { id: string; storeId: string; code: string; name: string; zone?: string | null; capacity?: string | number | null; stockPositions?: number; }
export interface StockBalance { id: string; productId: string; lotId: string; binId: string; uomId: string; quantity: string | number; reservedQty: string | number; updatedAt: string; product: {name:string;sku:string}; lot: {code:string;expiryDate?:string;qualityStatus:string}; bin: Bin; uom: {code:string}; }
export interface Activity { id:string;occurredAt:string;direction:'IN'|'OUT';quantity:string;balanceAfter?:string|null;documentType:string;documentId:string;referenceNumber?:string|null;note?:string|null;product?:{name:string;sku:string};lot?:{code:string};bin?:Bin;uom?:{code:string};performedBy?:{fullName:string}; }
export interface ReceiptLine { id:string;productId:string;productName:string;uomId:string;uomCode:string;remaining:string|number; }
export interface ReceiptDocument { id:string;number:string;referenceNumber?:string;lines:ReceiptLine[]; }
export const storeTypeLabel = (type: StoreType) => type === 'RM_STORE' ? 'RM Store' : 'FM Store';
