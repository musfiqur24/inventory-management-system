import { StockError } from './stock.js';
import type { Prisma, ProductType } from '../generated/prisma/client.js';
type Database = Pick<Prisma.TransactionClient,'product'|'unitOfMeasure'>;
export async function validateProductLines(db: Database, organizationId: string, lines: Array<{productId:string;uomId:string}>, types?: ProductType[]) {
  const productIds=[...new Set(lines.map(l=>l.productId))], unitIds=[...new Set(lines.map(l=>l.uomId))];
  const [products,units]=await Promise.all([
    db.product.findMany({where:{organizationId,id:{in:productIds},isActive:true,...(types?{type:{in:types}}:{})},include:{baseUom:true}}),
    db.unitOfMeasure.findMany({where:{organizationId,id:{in:unitIds},isActive:true}}),
  ]);
  if(products.length!==productIds.length||units.length!==unitIds.length)throw new StockError('INVALID_REFERENCE','Select active products and units from this organization.',422);
  for(const line of lines)if(products.find(p=>p.id===line.productId)!.baseUom.dimension!==units.find(u=>u.id===line.uomId)!.dimension)throw new StockError('INVALID_UOM','Unit dimension must match the product.',422);
}
