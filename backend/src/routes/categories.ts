import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";

export const categoriesRouter = Router();
const names = ["Group Layer", "Control Layer", "Sub Layer", "Sub- Sub Layer"];

categoriesRouter.get("/", async (req, res) => {
  const where = { organizationId: req.tenantId! };
  const orderBy = [{ sortOrder: "asc" as const }, { name: "asc" as const }];
  const layers = await Promise.all([
    prisma.groupLayer.findMany({ where, orderBy }),
    prisma.controlLayer.findMany({ where, orderBy }),
    prisma.subLayer.findMany({ where, orderBy }),
    prisma.subSubLayer.findMany({ where, orderBy }),
  ]);
  // Keep the existing flat API shape for the setup page and product selectors.
  res.json({ data: layers.flatMap((rows, index) => rows.map(row => ({ ...row, level: index + 1, parentId: 'parentId' in row ? row.parentId : null }))) });
});

const createCategorySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  level: z.coerce.number().int().min(1).max(4),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().default(0),
}).superRefine((value, ctx) => {
  if (value.level > 1 && !value.parentId) ctx.addIssue({ code: 'custom', path: ['parentId'], message: 'Select a parent layer' });
  if (value.level === 1 && value.parentId) ctx.addIssue({ code: 'custom', path: ['parentId'], message: 'Group Layer cannot have a parent' });
});

categoriesRouter.post("/", async (req, res) => {
  const parsed = createCategorySchema.parse(req.body);
  const organizationId = req.tenantId!;
  if (parsed.level > 1) {
    const where = { id: parsed.parentId!, organizationId };
    const parent = parsed.level === 2 ? await prisma.groupLayer.findFirst({ where })
      : parsed.level === 3 ? await prisma.controlLayer.findFirst({ where })
      : await prisma.subLayer.findFirst({ where });
    if (!parent) return res.status(422).json({ error: { code: 'INVALID_PARENT', message: `Select a valid ${names[parsed.level - 2]} in this organization.` } });
  }
  const data = { organizationId, code: parsed.code.toUpperCase(), name: parsed.name, sortOrder: parsed.sortOrder };
  try {
    const category = parsed.level === 1 ? await prisma.groupLayer.create({ data })
      : parsed.level === 2 ? await prisma.controlLayer.create({ data: { ...data, parentId: parsed.parentId! } })
      : parsed.level === 3 ? await prisma.subLayer.create({ data: { ...data, parentId: parsed.parentId! } })
      : await prisma.subSubLayer.create({ data: { ...data, parentId: parsed.parentId! } });
    return res.status(201).json({ data: { ...category, level: parsed.level, parentId: parsed.parentId ?? null } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: `${names[parsed.level - 1]} code "${data.code}" already exists in this organization.` } });
    }
    throw error;
  }
});
categoriesRouter.put("/:id",async(req,res)=>{
 const x=createCategorySchema.parse(req.body),organizationId=req.tenantId!,id=String(req.params.id),where={id,organizationId};
 const old=x.level===1?await prisma.groupLayer.findFirst({where}):x.level===2?await prisma.controlLayer.findFirst({where}):x.level===3?await prisma.subLayer.findFirst({where}):await prisma.subSubLayer.findFirst({where});
 if(!old)return res.status(404).json({error:{code:"NOT_FOUND",message:names[x.level-1]+" not found."}});
 if(x.level>1){const pw={id:x.parentId!,organizationId};const parent=x.level===2?await prisma.groupLayer.findFirst({where:pw}):x.level===3?await prisma.controlLayer.findFirst({where:pw}):await prisma.subLayer.findFirst({where:pw});if(!parent)return res.status(422).json({error:{code:"INVALID_PARENT",message:"Select a valid parent layer."}})}
 const base={code:x.code.toUpperCase(),name:x.name,sortOrder:x.sortOrder};const data=x.level===1?await prisma.groupLayer.update({where:{id},data:base}):x.level===2?await prisma.controlLayer.update({where:{id},data:{...base,parentId:x.parentId!}}):x.level===3?await prisma.subLayer.update({where:{id},data:{...base,parentId:x.parentId!}}):await prisma.subSubLayer.update({where:{id},data:{...base,parentId:x.parentId!}});res.json({data:{...data,level:x.level,parentId:x.parentId??null}});
});
categoriesRouter.delete("/:id",async(req,res)=>{
 const level=z.coerce.number().int().min(1).max(4).parse(req.query.level),id=String(req.params.id),organizationId=req.tenantId!,where={id,organizationId};
 const old=level===1?await prisma.groupLayer.findFirst({where}):level===2?await prisma.controlLayer.findFirst({where}):level===3?await prisma.subLayer.findFirst({where}):await prisma.subSubLayer.findFirst({where});
 if(!old)return res.status(404).json({error:{code:"NOT_FOUND",message:names[level-1]+" not found."}});
 const used=level===1?await prisma.controlLayer.count({where:{organizationId,parentId:id}}):level===2?await prisma.subLayer.count({where:{organizationId,parentId:id}}):level===3?await prisma.subSubLayer.count({where:{organizationId,parentId:id}}):await prisma.product.count({where:{organizationId,categoryId:id,isActive:true}});
 if(used)return res.status(409).json({error:{code:"IN_USE",message:names[level-1]+" cannot be deleted while it contains "+(level===4?"products.":"child layers.")}});
 if(level===1)await prisma.groupLayer.delete({where:{id}});else if(level===2)await prisma.controlLayer.delete({where:{id}});else if(level===3)await prisma.subLayer.delete({where:{id}});else await prisma.subSubLayer.delete({where:{id}});res.status(204).send();
});
