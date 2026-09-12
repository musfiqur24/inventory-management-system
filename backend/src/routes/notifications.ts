import { Router } from "express";
import { prisma } from "../prisma.js";
export const notificationsRouter = Router();
notificationsRouter.get("/", async (req, res) => {
  const where = { organizationId: req.tenantId!, recipientId: req.auth!.id };
  const [data, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);
  res.json({ data, unreadCount });
});
notificationsRouter.patch("/:id/read", async (req, res) => {
  const where = {
    id: String(req.params.id),
    organizationId: req.tenantId!,
    recipientId: req.auth!.id,
  };
  const notification = await prisma.notification.findFirst({ where });
  if (!notification)
    return res
      .status(404)
      .json({
        error: { code: "NOT_FOUND", message: "Notification not found." },
      });
  await prisma.notification.updateMany({
    where: { ...where, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ data: { id: notification.id } });
});
