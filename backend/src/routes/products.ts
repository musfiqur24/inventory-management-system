import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, ProductType } from "../generated/prisma/client.js";

export const productsRouter = Router();

productsRouter.get("/", async (req, res) => {
  const typeFilter = req.query.type as ProductType | undefined;
  const products = await prisma.product.findMany({
    where: {
      organizationId: req.tenantId,
      isActive: true,
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    include: {
      category: {
        include: {
          parent: {
            include: {
              parent: { include: { parent: true } },
            },
          },
        },
      },
      baseUom: true,
      currency: true,
      balances: {
        include: {
          bin: true,
          lot: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Calculate total in-stock balance for each product
  const enriched = products.map((prod) => {
    const totalQty = prod.balances.reduce(
      (sum, b) => sum + Number(b.quantity),
      0
    );
    const isBelowReorder =
      prod.reorderLevel !== null && totalQty <= Number(prod.reorderLevel);

    return {
      ...prod,
      totalQty,
      isBelowReorder,
    };
  });

  res.json({ data: enriched });
});

const createProductSchema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  type: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "PACKAGING", "BY_PRODUCT"]),
  categoryId: z.string().uuid(),
  baseUomId: z.string().uuid(),
  shelfLifeDays: z.coerce.number().int().positive().optional(),
  reorderLevel: z.coerce.number().positive().optional(),
  amount: z.coerce.number().nonnegative().optional(),
  currencyId: z.string().uuid().nullable().optional(),
});

productsRouter.post("/", async (req, res) => {
  const parsed = createProductSchema.parse(req.body);
  const [category, uom, currency] = await Promise.all([
    prisma.subSubLayer.findFirst({ where: { id: parsed.categoryId, organizationId: req.tenantId! } }),
    prisma.unitOfMeasure.findFirst({ where: { id: parsed.baseUomId, organizationId: req.tenantId! } }),
    parsed.currencyId ? prisma.currency.findFirst({ where: { id: parsed.currencyId, organizationId: req.tenantId!, isActive: true } }) : null,
  ]);
  if (!category || !uom || (parsed.currencyId && !currency)) return res.status(422).json({ error: { code: 'INVALID_REFERENCE', message: 'Select a Sub- Sub Layer and UOM in this organization.' } });
  const product = await prisma.product.create({
    data: {
      organizationId: req.tenantId!,
      sku: parsed.sku.toUpperCase().trim(),
      name: parsed.name.trim(),
      type: parsed.type,
      categoryId: parsed.categoryId,
      baseUomId: parsed.baseUomId,
      shelfLifeDays: parsed.shelfLifeDays,
      reorderLevel: parsed.reorderLevel ? new Prisma.Decimal(parsed.reorderLevel) : null,
      amount: parsed.amount !== undefined ? new Prisma.Decimal(parsed.amount) : null,
      currencyId: parsed.currencyId ?? null,
    },
    include: {
      category: true,
      baseUom: true,
      currency: true,
    },
  });
  res.status(201).json({ data: product });
});
productsRouter.put("/:id", async (req, res) => {
  const x=createProductSchema.parse(req.body), organizationId=req.tenantId!;
  const old=await prisma.product.findFirst({where:{id:String(req.params.id),organizationId,isActive:true}});
  if(!old)return res.status(404).json({error:{code:"NOT_FOUND",message:"Product not found."}});
  const [category,uom,currency]=await Promise.all([prisma.subSubLayer.findFirst({where:{id:x.categoryId,organizationId}}),prisma.unitOfMeasure.findFirst({where:{id:x.baseUomId,organizationId,isActive:true}}),x.currencyId?prisma.currency.findFirst({where:{id:x.currencyId,organizationId,isActive:true}}):null]);
  if(!category||!uom||(x.currencyId&&!currency))return res.status(422).json({error:{code:"INVALID_REFERENCE",message:"Select a Sub- Sub Layer and UOM in this organization."}});
  const data=await prisma.product.update({where:{id:old.id},data:{sku:x.sku.toUpperCase().trim(),name:x.name.trim(),type:x.type,categoryId:x.categoryId,baseUomId:x.baseUomId,shelfLifeDays:x.shelfLifeDays,reorderLevel:x.reorderLevel?new Prisma.Decimal(x.reorderLevel):null,amount:x.amount!==undefined?new Prisma.Decimal(x.amount):null,currencyId:x.currencyId??null},include:{category:true,baseUom:true,currency:true}});
  res.json({data});
});
productsRouter.delete("/:id",async(req,res)=>{
  const old=await prisma.product.findFirst({where:{id:String(req.params.id),organizationId:req.tenantId!,isActive:true}});
  if(!old)return res.status(404).json({error:{code:"NOT_FOUND",message:"Product not found."}});
  await prisma.product.update({where:{id:old.id},data:{isActive:false}});res.status(204).send();
});
