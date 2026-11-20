import { db } from "./db.ts";
import { z } from "zod";
import { requireRole } from "./auth.ts";
import type { Actor } from "./auth.ts";
import { listOrders, ledger } from "./orders.ts";
import { moderationQueue } from "./moderation.ts";
import { profileDTO } from "./dto.ts";
import type { AdminDTO } from "../lib/contracts.ts";
export async function adminState(user: Actor): Promise<AdminDTO> {
  requireRole(user, "ADMIN");
  const [orders, rows, moderation, setting, subscriptions] = await Promise.all([
    listOrders(user), db.tailorProfile.findMany({ include: { user: { select: { id: true, maskedCode: true, name: true, email: true, phone: true, location: true } } } }), moderationQueue(user),
    db.appSetting.findUnique({ where: { id: "global" } }), db.subscriptionPayment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true } }),
  ]);
  const percent = setting?.commissionPercent ?? 10;
  const profiles = await Promise.all(rows.map(async p => {
    const rating = await db.review.aggregate({ where: { order: { tailorId: p.userId }, status: "APPROVED" }, _avg: { rating: true } });
    return profileDTO(p, p.user, percent, rating._avg.rating ?? 0, true);
  }));
  return { orders, profiles, moderation, ledger: { ...ledger(orders), subscriptionCollected: subscriptions._sum.amount ?? 0 }, commissionPercent: percent };
}
export async function updateCommission(raw: unknown, user: Actor) {
  requireRole(user, "ADMIN");
  const { commissionPercent } = z.object({ commissionPercent: z.number().int().min(0).max(100) }).strict().parse(raw);
  await db.appSetting.upsert({ where: { id: "global" }, update: { commissionPercent }, create: { id: "global", commissionPercent } });
  return { ok: true };
}
