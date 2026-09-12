import { StockError } from "../services/stock.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus } from "../generated/prisma/client.js";

export const purchaseRequisitionsRouter = Router();
const managerWhere = (organizationId: string, userId?: string) => ({organizationId, ...(userId ? {userId} : {}), isActive:true, user:{isActive:true}, organization:{isActive:true}, role:{code:'MANAGER'}});
const managerSelect = {id:true,fullName:true,email:true};
purchaseRequisitionsRouter.get('/managers',async(req,res)=>{
 const memberships=await prisma.organizationMember.findMany({where:managerWhere(req.tenantId!),select:{user:{select:managerSelect}},orderBy:{user:{fullName:'asc'}}});
 res.json({data:memberships.map(m=>m.user)});
});

purchaseRequisitionsRouter.get("/", async (req, res) => {
  const requisitions = await prisma.purchaseRequisition.findMany({
    where: { organizationId: req.tenantId, deletedAt:null },
    include: {
      assignedManager: {select:managerSelect},
      lines: {
        include: {
          requisition: false,
        },
      },
    },
    orderBy: { requestedOn: "desc" },
  });

  // Enrich with product, uom, supplier details
  const [products, uoms, partners] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.partner.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));
  const partMap = new Map(partners.map((p) => [p.id, p]));

  const enriched = requisitions.map((reqItem) => {
    const supplier = reqItem.supplierId ? partMap.get(reqItem.supplierId) : null;
    const lines = reqItem.lines.map((l) => ({
      ...l,
      product: prodMap.get(l.productId),
      uom: uomMap.get(l.uomId),
    }));

    const totalEstimatedCost = lines.reduce(
      (sum, l) => sum + Number(l.requestedQty) * (l.unitPrice ? Number(l.unitPrice) : 0),
      0
    );

    return {
      ...reqItem,
      supplier,
      lines,
      totalEstimatedCost,
    };
  });

  res.json({ data: enriched });
});

const getRequisitionDetails = async (req: any, res: any) => {
  const requisition = await prisma.purchaseRequisition.findFirst({
    where: { id: req.params.id, organizationId: req.tenantId, deletedAt:null },
    include: {
      assignedManager: {select:managerSelect},
      lines: true,
    },
  });

  if (!requisition) {
    return res.status(404).json({ error: { message: "Requisition not found" } });
  }

  const [products, uoms, supplier, organization] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    requisition.supplierId
      ? prisma.partner.findFirst({ where: { id: requisition.supplierId } })
      : null,
    prisma.organization.findUnique({ where: { id: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));

  const lines = requisition.lines.map((l) => ({
    ...l,
    product: prodMap.get(l.productId),
    uom: uomMap.get(l.uomId),
  }));

  res.json({
    data: {
      ...requisition,
      organization,
      supplier,
      lines,
    },
  });
};

purchaseRequisitionsRouter.get("/:id", getRequisitionDetails);
purchaseRequisitionsRouter.get("/:id/report", getRequisitionDetails);

const createRequisitionSchema = z.object({
  assignedManagerId: z.string().uuid(),
  salesOrderRef: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  lines: z.array(
    z.object({
      productId: z.string().uuid(),
      uomId: z.string().uuid(),
      requestedQty: z.coerce.number().positive(),
      unitPrice: z.coerce.number().positive().optional(),
    })
  ).min(1, "At least one raw material line is required"),
});

async function validateRequisition(tx:Prisma.TransactionClient,organizationId:string,parsed:z.infer<typeof createRequisitionSchema>){
    const manager=await tx.organizationMember.findFirst({where:managerWhere(organizationId,parsed.assignedManagerId)});
    if(!manager)throw new StockError('INVALID_MANAGER','Select an active Manager assigned to this organization.',422);
    const products=await tx.product.count({where:{organizationId,isActive:true,type:'RAW_MATERIAL',id:{in:[...new Set(parsed.lines.map(l=>l.productId))]}}});
    const uoms=await tx.unitOfMeasure.count({where:{organizationId,isActive:true,id:{in:[...new Set(parsed.lines.map(l=>l.uomId))]}}});
    if(products!==new Set(parsed.lines.map(l=>l.productId)).size || uoms!==new Set(parsed.lines.map(l=>l.uomId)).size)throw new StockError('INVALID_LINES','Select raw materials and units from this organization.',422);
    if(parsed.supplierId&&!await tx.partner.findFirst({where:{id:parsed.supplierId,organizationId,partnerType:'SUPPLIER'}}))throw new StockError('INVALID_SUPPLIER','Select a supplier from this organization.',422);
}

purchaseRequisitionsRouter.post("/", async (req, res) => {
  const parsed = createRequisitionSchema.parse(req.body);

  const requisition = await prisma.$transaction(async tx=>{
    const organizationId=req.tenantId!;
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;
    await validateRequisition(tx,organizationId,parsed);
    let sequence=await tx.purchaseRequisition.count({where:{organizationId}})+1;
    const prefix='RM-REQ-'+new Date().getFullYear()+'-';
    let number=prefix+String(sequence).padStart(4,'0');
    while(await tx.purchaseRequisition.findUnique({where:{organizationId_number:{organizationId,number}}}))number=prefix+String(++sequence).padStart(4,'0');
    const created=await tx.purchaseRequisition.create({data:{organizationId,number,createdById:req.auth!.id,assignedManagerId:parsed.assignedManagerId,salesOrderRef:parsed.salesOrderRef?.trim()||null,supplierId:parsed.supplierId||null,status:DocumentStatus.SUBMITTED,lines:{create:parsed.lines.map(l=>({productId:l.productId,uomId:l.uomId,requestedQty:new Prisma.Decimal(l.requestedQty),unitPrice:l.unitPrice?new Prisma.Decimal(l.unitPrice):null}))}},include:{lines:true,assignedManager:{select:managerSelect}}});
    await tx.notification.create({data:{organizationId,recipientId:parsed.assignedManagerId,requisitionId:created.id,title:'RM requisition awaiting your approval',message:created.number+' has been assigned to you for review and approval.'}});
    return created;
  });

  res.status(201).json({ data: requisition });
});

purchaseRequisitionsRouter.post('/:id/approve',async(req,res)=>{
 const data=await prisma.$transaction(async tx=>{
  const organizationId=req.tenantId!,id=String(req.params.id),userId=req.auth!.id;
  await tx.$queryRaw`SELECT id FROM "PurchaseRequisition" WHERE id=${id} AND "organizationId"=${organizationId} FOR UPDATE`;
  const requisition=await tx.purchaseRequisition.findFirst({where:{id,organizationId,deletedAt:null}});
  if(!requisition)throw new StockError('NOT_FOUND','Requisition not found.',404);
  if(requisition.assignedManagerId!==userId || !await tx.organizationMember.findFirst({where:managerWhere(organizationId,userId)}))throw new StockError('APPROVAL_FORBIDDEN','Only the assigned manager can approve this requisition.',403);
  const result=await tx.purchaseRequisition.updateMany({where:{id,organizationId,status:'SUBMITTED',assignedManagerId:userId},data:{status:'APPROVED',approvedAt:new Date(),approvedById:userId}});
  if(!result.count)throw new StockError('INVALID_STATUS','Only a submitted requisition can be approved.');
  await tx.notification.updateMany({where:{organizationId,recipientId:userId,requisitionId:id,readAt:null},data:{readAt:new Date()}});
  return tx.purchaseRequisition.findUnique({where:{id},include:{assignedManager:{select:managerSelect}}});
 });
 res.json({data});
});

purchaseRequisitionsRouter.put('/:id',async(req,res)=>{
 const parsed=createRequisitionSchema.parse(req.body);
 const data=await prisma.$transaction(async tx=>{
  const organizationId=req.tenantId!,id=String(req.params.id),userId=req.auth!.id;
  await tx.$queryRaw`SELECT id FROM "PurchaseRequisition" WHERE id=${id} AND "organizationId"=${organizationId} FOR UPDATE`;
  const current=await tx.purchaseRequisition.findFirst({where:{id,organizationId,deletedAt:null}});
  if(!current)throw new StockError('NOT_FOUND','Requisition not found.',404);
  const assignedManager=current.assignedManagerId===userId && !!await tx.organizationMember.findFirst({where:managerWhere(organizationId,userId)});
  if(current.createdById!==userId&&!assignedManager)throw new StockError('EDIT_FORBIDDEN','Only the creator or assigned manager can edit this requisition.',403);
  if(current.approvedAt || !['DRAFT','SUBMITTED'].includes(current.status))throw new StockError('REQUISITION_LOCKED','Approved requisitions cannot be edited.');
  if(await tx.supplierDelivery.count({where:{organizationId,requisitionId:id}}))throw new StockError('REQUISITION_IN_USE','A requisition linked to deliveries cannot be edited.');
  await validateRequisition(tx,organizationId,parsed);
  const updated=await tx.purchaseRequisition.update({where:{id},data:{salesOrderRef:parsed.salesOrderRef?.trim()||null,supplierId:parsed.supplierId||null,assignedManagerId:parsed.assignedManagerId,lines:{deleteMany:{},create:parsed.lines.map(l=>({productId:l.productId,uomId:l.uomId,requestedQty:new Prisma.Decimal(l.requestedQty),unitPrice:l.unitPrice?new Prisma.Decimal(l.unitPrice):null}))}},include:{lines:true,assignedManager:{select:managerSelect}}});
  await tx.notification.deleteMany({where:{organizationId,requisitionId:id}});
  await tx.notification.create({data:{organizationId,recipientId:parsed.assignedManagerId,requisitionId:id,title:'RM requisition updated',message:updated.number+' was edited and requires your review before approval.'}});
  return updated;
 });
 res.json({data});
});
purchaseRequisitionsRouter.delete('/:id',async(req,res)=>{
 await prisma.$transaction(async tx=>{
  const organizationId=req.tenantId!,id=String(req.params.id),userId=req.auth!.id;
  await tx.$queryRaw`SELECT id FROM "PurchaseRequisition" WHERE id=${id} AND "organizationId"=${organizationId} FOR UPDATE`;
  const current=await tx.purchaseRequisition.findFirst({where:{id,organizationId,deletedAt:null}});
  if(!current)throw new StockError('NOT_FOUND','Requisition not found.',404);
  if(!await tx.organizationMember.findFirst({where:managerWhere(organizationId,userId)}))throw new StockError('DELETE_FORBIDDEN','Only an active manager in this organization can delete a requisition.',403);
  if(await tx.supplierDelivery.count({where:{organizationId,requisitionId:id}}))throw new StockError('REQUISITION_IN_USE','Requisitions linked to deliveries cannot be deleted.');
  await tx.purchaseRequisition.update({where:{id},data:{deletedAt:new Date(),status:'CANCELLED'}});
  await tx.notification.deleteMany({where:{organizationId,requisitionId:id}});
 });
 res.json({data:{deleted:true}});
});
