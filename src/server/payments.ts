import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db.ts";
import { AppError } from "./errors.ts";
import { requireRole } from "./auth.ts";
import type { Actor } from "./auth.ts";
import { getOrder } from "./orders.ts";
import { splitPayment } from "../lib/money.ts";
const inputSchema = z.object({ version: z.number().int().positive(), installment: z.enum(["APPROVAL", "DESIGN"]), outcome: z.enum(["success", "failure"]), approved: z.literal(true).optional(), alterationId: z.string().optional(), quoteVersion: z.number().int().positive().optional(), quotedAmount: z.number().int().positive().optional(), acceptQuote: z.literal(true).optional() }).strict();
export async function simulatePayment(orderId: string, raw: unknown, user: Actor) {
  requireRole(user, "CUSTOMER");
  const input = inputSchema.parse(raw);
  await db.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== user.id) throw new AppError("Order not available.", 403);
    const earlyCycle = input.alterationId ? (await tx.alteration.findUnique({ where: { id: input.alterationId }, select: { cycle: true, quoteVersion: true } })) : null;
    const earlyKey = input.installment === "APPROVAL" ? `customer-${orderId}-APPROVAL-0-0-${input.version}` : `customer-${orderId}-DESIGN-${earlyCycle?.cycle ?? 0}-${input.quoteVersion ?? 0}-${input.version}`;
    const prior = await tx.payment.findUnique({ where: { idempotencyKey: earlyKey } });
    if (prior?.status === "SUCCEEDED") return;
    if (order.version !== input.version) throw new AppError("Order changed. Refresh and retry.", 409);
    let amount: number, cycle = 0, quoteVersion = 0, alterationId = "";
    if (input.installment === "APPROVAL") {
      if (input.approved !== true || order.status !== "DELIVERED_PENDING_APPROVAL" || !order.deliveryPaid || order.approvalPaid) throw new AppError("Explicit approval is required after delivery.", 409);
      amount = splitPayment(order.totalAmount).approval;
    } else {
      if (input.acceptQuote !== true || !input.alterationId || !input.quoteVersion || !input.quotedAmount) throw new AppError("Accept the current alteration quote before payment.", 400);
      const alteration = await tx.alteration.findUnique({ where: { id: input.alterationId } });
      if (!alteration || alteration.orderId !== orderId || order.status !== "ALTERATION_REQUESTED" || alteration.alterationType !== "DESIGN_PAID" || alteration.contentStatus !== "APPROVED" || alteration.paid || alteration.amount !== input.quotedAmount || alteration.quoteVersion !== input.quoteVersion) throw new AppError("This alteration quote changed or is no longer available.", 409);
      amount = alteration.amount; cycle = alteration.cycle; quoteVersion = alteration.quoteVersion; alterationId = alteration.id;
    }
    const attemptKey = `customer-${orderId}-${input.installment}-${cycle}-${quoteVersion}-${input.version}`;
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: attemptKey } });
    if (existing?.status === "SUCCEEDED") return;
    if (input.outcome === "failure") {
      if (existing) await tx.payment.update({ where: { id: existing.id }, data: { status: "FAILED" } });
      else await tx.payment.create({ data: { orderId, installment: input.installment, cycle, amount, status: "FAILED", idempotencyKey: attemptKey } });
      return;
    }
    const idempotencyKey = existing?.idempotencyKey ?? attemptKey;
    if (existing) await tx.payment.update({ where: { id: existing.id }, data: { status: "SUCCEEDED", approved: input.installment === "APPROVAL" && input.approved === true } });
    else await tx.payment.create({ data: { orderId, installment: input.installment, cycle, amount, status: "SUCCEEDED", idempotencyKey, approved: input.installment === "APPROVAL" && input.approved === true } });
    if (input.installment === "APPROVAL") {
      const changed = await tx.order.updateMany({ where: { id: orderId, version: input.version, status: "DELIVERED_PENDING_APPROVAL", approvalPaid: false }, data: { approvalPaid: true, status: "COMPLETED", version: { increment: 1 } } });
      if (changed.count !== 1) throw new AppError("Order changed during payment. Refresh and retry.", 409);
    } else {
      await tx.alteration.update({ where: { id: alterationId }, data: { paid: true } });
      const changed = await tx.order.updateMany({ where: { id: orderId, version: input.version }, data: { version: { increment: 1 } } });
      if (changed.count !== 1) throw new AppError("Order changed during payment. Refresh and retry.", 409);
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return getOrder(orderId, user);
}
