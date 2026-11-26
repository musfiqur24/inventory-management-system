import { hasPermission } from "../modules/rbac.js";
import { releaseOrderReservations } from "../services/reservations.js";
import { nextDocumentNumber } from "../services/documentNumbers.js";
import { lockDocument, StockError } from "../services/stock.js";
import { validateProductLines } from "../services/references.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus } from "../generated/prisma/client.js";

export const salesOrdersRouter = Router();

const personSelect = { id: true, fullName: true, email: true };

salesOrdersRouter.get("/assignees", async (req, res) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { organizationId: req.tenantId, isActive: true, user: { isActive: true } },
    select: { user: { select: personSelect } },
    orderBy: { user: { fullName: "asc" } },
  });
  res.json({ data: memberships.map((membership) => membership.user) });
});

salesOrdersRouter.get("/", async (req, res) => {
  const orders = await prisma.salesOrder.findMany({
    where: { organizationId: req.tenantId },
    include: {
      lines: true,
      assignedPerson: { select: personSelect },
    },
    orderBy: { orderedAt: "desc" },
  });

  const [products, uoms, partners] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.partner.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));
  const partMap = new Map(partners.map((p) => [p.id, p]));

  const enriched = orders.map((ord) => {
    const customer = partMap.get(ord.customerId);
    const lines = ord.lines.map((l) => ({
      ...l,
      product: prodMap.get(l.productId),
      uom: uomMap.get(l.uomId),
    }));

    const totalValue = lines.reduce(
      (sum, l) => sum + Number(l.quantity) * (l.unitPrice ? Number(l.unitPrice) : 0),
      0
    );

    return {
      ...ord,
      customer,
      lines,
      totalValue,
    };
  });

  res.json({ data: enriched });
});

salesOrdersRouter.get("/:id", async (req, res) => {
  const order = await prisma.salesOrder.findFirst({
    where: { id: req.params.id, organizationId: req.tenantId },
    include: { lines: true, assignedPerson: { select: personSelect } },
  });
  if (!order) return res.status(404).json({ error: { message: "Sales order not found" } });

  const [products, uoms, customer] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.partner.findUnique({ where: { id: order.customerId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));

  const lines = order.lines.map((l) => ({
    ...l,
    product: prodMap.get(l.productId),
    uom: uomMap.get(l.uomId),
  }));

  const totalValue = lines.reduce(
    (sum, l) => sum + Number(l.quantity) * (l.unitPrice ? Number(l.unitPrice) : 0),
    0
  );

  res.json({
    data: {
      ...order,
      customer,
      lines,
      totalValue,
    },
  });
});

const createSalesOrderSchema = z.object({
  customerId: z.string().uuid("Please select a customer"),
  assignedPersonId: z.string().uuid("Please select an assigned person"),
  lines: z.array(
    z.object({
      productId: z.string().uuid("Please select a product"),
      uomId: z.string().uuid("Please select a unit of measure"),
      quantity: z.coerce.number().positive("Quantity must be greater than 0"),
      unitPrice: z.coerce.number().positive("Unit price must be positive").optional(),
    })
  ).min(1, "At least one sales line is required"),
});

salesOrdersRouter.post("/", async (req, res) => {
  const parsed = createSalesOrderSchema.parse(req.body);
  await validateProductLines(prisma, req.tenantId!, parsed.lines, ["FINISHED_GOOD", "BY_PRODUCT"]);
  const [customer, assignee] = await Promise.all([
    prisma.partner.findFirst({ where: { id: parsed.customerId, organizationId: req.tenantId, partnerType: "CUSTOMER" } }),
    prisma.organizationMember.findFirst({ where: { organizationId: req.tenantId, userId: parsed.assignedPersonId, isActive: true, user: { isActive: true } } }),
  ]);
  if (!customer) return res.status(422).json({ error: { message: "Select an active customer from this organization." } });
  if (!assignee) return res.status(422).json({ error: { message: "Select an active assigned person from this organization." } });

  const order = await prisma.$transaction(async tx=>{
  const number=await nextDocumentNumber(tx,req.tenantId!,"SalesOrder",`SO-${new Date().getFullYear()}-`);
  return tx.salesOrder.create({
    data: {
      organizationId: req.tenantId!,
      number,
      customerId: parsed.customerId,
      assignedPersonId: parsed.assignedPersonId,
      status: DocumentStatus.SUBMITTED,
      lines: {
        create: parsed.lines.map((l) => ({
          productId: l.productId,
          uomId: l.uomId,
          quantity: new Prisma.Decimal(l.quantity),
          dispatchedQty: new Prisma.Decimal(0),
          unitPrice: l.unitPrice ? new Prisma.Decimal(l.unitPrice) : null,
        })),
      },
    },
    include: {
      lines: true,
      assignedPerson: { select: personSelect },
    },
  });

  });
  res.status(201).json({ data: order });
});

salesOrdersRouter.post("/:id/approve", async (req,res)=>{
  const role=req.auth!.organizations.find(o=>o.id===req.tenantId)?.role.code;
  if(!hasPermission(req.auth,req.tenantId,"feed.sales_approval.write")) return res.status(403).json({error:{message:"Only an administrator or manager can approve sales orders."}});
  const data=await prisma.$transaction(async tx=>{
    await lockDocument(tx,"SalesOrder",String(req.params.id),req.tenantId!);
    const order=await tx.salesOrder.findFirst({where:{id:String(req.params.id),organizationId:req.tenantId!}});
    if(!order)throw new StockError("NOT_FOUND","Sales order not found",404);
    if(order.status!=="SUBMITTED")throw new StockError("INVALID_STATUS","Only submitted orders can be approved");
    return tx.salesOrder.update({where:{id:order.id},data:{status:DocumentStatus.APPROVED}});
  });res.json({data});
});

salesOrdersRouter.post("/:id/cancel",async(req,res)=>{
 const {reason}=z.object({reason:z.string().trim().min(10).max(1000)}).parse(req.body);
 const org=req.tenantId!,role=req.auth!.organizations.find(o=>o.id===org)?.role.code;
 if(!hasPermission(req.auth,req.tenantId,"feed.sales_approval.write"))return res.status(403).json({error:{message:"Only a manager or administrator can cancel an order"}});
 const data=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${org} FOR UPDATE`;
  await lockDocument(tx,"SalesOrder",String(req.params.id),org);
  const order=await tx.salesOrder.findFirst({where:{id:String(req.params.id),organizationId:org}});
  if(!order)throw new StockError("NOT_FOUND","Order not found",404);
  if(!["SUBMITTED","APPROVED","PARTIALLY_RECEIVED"].includes(order.status))throw new StockError("INVALID_STATUS","Only an open order can be cancelled. Shipped goods require a return.");
  await releaseOrderReservations(tx,org,order.id);
  const cancelled=await tx.salesOrder.update({where:{id:order.id},data:{status:"CANCELLED"}});
  await tx.auditEvent.create({data:{organizationId:org,actorId:req.auth!.id,action:"SALES_ORDER_CANCELLED",resourceId:order.id,details:{reason}}});return cancelled;
 });res.json({data});
});

salesOrdersRouter.delete("/:id", async (req,res)=>{
  const organizationId=req.tenantId!;
  await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;
    await lockDocument(tx,"SalesOrder",String(req.params.id),organizationId);
    const order=await tx.salesOrder.findFirst({where:{id:String(req.params.id),organizationId}});
    if(!order)throw new StockError("NOT_FOUND","Sales order not found",404);
    if(!["DRAFT","SUBMITTED"].includes(order.status)||await tx.dispatch.count({where:{organizationId,salesOrderId:order.id}}))throw new StockError("ORDER_LOCKED","Only unapproved, undispatched orders can be removed. Use order cancellation for approved demand.");
    await tx.salesOrder.update({where:{id:order.id},data:{status:DocumentStatus.CANCELLED}});
  });
  res.json({data:{message:"Sales order cancelled; history retained"}});
});
