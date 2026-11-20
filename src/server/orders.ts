import { Prisma } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { db } from "./db.ts";
import { AppError } from "./errors.ts";
import { requireRole } from "./auth.ts";
import type { Actor } from "./auth.ts";
import { economics, splitPayment } from "../lib/money.ts";
import { hasExactMeasurements, orderSchema } from "../lib/validation.ts";
import { contactError } from "../lib/privacy.ts";
import { asAddress, asList, identityDTO } from "./dto.ts";
import type { OrderDTO, ShipmentDTO, AlterationDTO } from "../lib/contracts.ts";
import { z } from "zod";
import { maskedAlias } from "./masked-code.ts";
import { assertAlterationQuote, assertAlterationRequest, validateAlterationNotes } from "./order-guards.ts";

const details = { customer: { select: { id: true, maskedCode: true, name: true, email: true, phone: true } }, tailor: { select: { id: true, maskedCode: true, name: true, email: true, phone: true } }, shipments: { orderBy: [{ cycle: "asc" as const }, { leg: "asc" as const }] }, payments: { orderBy: { createdAt: "asc" as const } }, alterations: { orderBy: { cycle: "asc" as const } }, conversation: true, uploads: { select: { id: true, approved: true } } } satisfies Prisma.OrderInclude;
type FullOrder = Prisma.OrderGetPayload<{ include: typeof details }>;
function asJsonObject(value: unknown): Record<string, number|string> { return value && typeof value === "object" ? value as Record<string, number|string> : {}; }

export function orderDTO(order: FullOrder, user: Actor): OrderDTO {
  const admin = user.role === "ADMIN", mine = user.id === order.customerId;
  const paidDesign = order.payments.filter(p => p.status === "SUCCEEDED" && p.installment === "DESIGN").reduce((sum, p) => sum + p.amount, 0);
  const specVisible = admin || mine;
  const measureVisible = admin || (mine && order.measurementStatus !== "APPROVED") || order.measurementStatus === "APPROVED";
  const ids = asList(order.referenceUploadIds) as string[];
  const visibleImages = ids.filter(id => {
    const upload = order.uploads.find(file => file.id === id);
    return admin || (mine && !upload?.approved) || upload?.approved;
  });
  const shipments: ShipmentDTO[] = order.shipments.map(s => ({ id: s.id, leg: s.leg, cycle: s.cycle, status: s.status, ...(admin ? { courier: s.courier, contact: s.contact, tracking: s.tracking } : {}) }));
  const alterations: AlterationDTO[] = order.alterations.map(a => ({ id: a.id, cycle: a.cycle, alterationType: a.alterationType as "FITTING_FREE"|"DESIGN_PAID", notes: admin || a.authorId === user.id ? a.notes : a.contentStatus === "APPROVED" ? a.publishedNotes : "", contentStatus: a.contentStatus, amount: a.amount, quoteVersion: a.quoteVersion, paid: a.paid, completed: a.completed }));
  return {
    id: order.id, customerMaskedCode: maskedAlias("CUSTOMER", order.customer.maskedCode), tailorMaskedCode: maskedAlias("TAILOR", order.tailor.maskedCode), garmentType: order.garmentType,
    designSpecifications: specVisible ? order.designSpecifications : order.publishedDesignSpecifications, contentStatus: order.contentStatus,
    measurementMode: order.measurementMode, measurements: measureVisible ? asJsonObject(order.measurements) : {}, requiredMeasurements: asList(order.requiredMeasurements) as string[],
    hasReferenceCloth: order.hasReferenceCloth, agreedCompletionDays: order.agreedCompletionDays, proposedCompletionDays: order.proposedCompletionDays,
    customerAgreedToTimeline: order.customerAgreedToTimeline, timelineConfirmed: order.timelineConfirmed, version: order.version,
    totalAmount: order.totalAmount, commissionAmount: order.platformFeeAmount, tailorNetPayout: order.tailorPayout + paidDesign, currency: "INR",
    paid50Pickup: order.pickupPaid, paid25Delivery: order.deliveryPaid, paid25Approval: order.approvalPaid, status: order.status,
    alterationType: order.alterations.at(-1)?.alterationType ?? "", alterationExtraCharge: order.alterations.filter(a => a.paid).reduce((n,a) => n + (a.amount ?? 0), 0),
    customerRating: admin || mine || order.reviewStatus === "APPROVED" ? order.customerRating : null,
    customerReview: admin || (mine && order.reviewStatus !== "APPROVED") ? order.customerReview : order.publishedReview,
    reviewStatus: order.reviewStatus,
    referenceImages: visibleImages.map(id => `/api/uploads/${id}`), conversationId: order.conversationId ?? "", createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString(), shipments, alterations,
    payments: order.payments.map(p => ({ id: p.id, installment: p.installment, amount: p.amount, status: p.status })),
    ...(admin ? { customerIdentity: identityDTO(order.customer), tailorIdentity: identityDTO(order.tailor), pickupAddress: asAddress(order.pickupAddress), deliveryAddress: asAddress(order.deliveryAddress), tailorAddress: asAddress(order.tailorAddress) } : {}),
  };
}
async function loaded(id: string) { return db.order.findUnique({ where: { id }, include: details }); }
export async function getOrder(id: string, user: Actor): Promise<OrderDTO> {
  const order = await loaded(id);
  if (!order) throw new AppError("Order not found.", 404);
  if (user.role !== "ADMIN" && order.customerId !== user.id && order.tailorId !== user.id) throw new AppError("Order not available.", 403);
  return orderDTO(order, user);
}
export async function listOrders(user: Actor): Promise<OrderDTO[]> {
  const rows = await db.order.findMany({ where: user.role === "ADMIN" ? {} : user.role === "TAILOR" ? { tailorId: user.id } : { customerId: user.id }, include: { ...details, uploads: { select: { id: true, approved: true } } }, orderBy: { createdAt: "desc" } });
  return rows.map(order => orderDTO(order, user));
}

export async function createOrder(raw: unknown, user: Actor): Promise<OrderDTO> {
  requireRole(user, "CUSTOMER");
  const input = orderSchema.parse(raw);
  const result = await db.$transaction(async tx => {
    const existing = await tx.order.findUnique({ where: { checkoutKey: input.checkoutKey } });
    const ids = [...new Set(input.uploadIds)];
    if (existing) {
      if (existing.customerId !== user.id) throw new AppError("Checkout key already used.", 409);
      if (existing.tailorId !== input.tailorId || existing.garmentType !== input.garmentType || !isDeepStrictEqual(existing.measurements, input.measurements) || !isDeepStrictEqual(existing.pickupAddress, input.pickupAddress) || !isDeepStrictEqual(existing.deliveryAddress, input.deliveryAddress) || !isDeepStrictEqual(existing.referenceUploadIds, ids)) throw new AppError("This checkout already created an order with different details.", 409);
      return existing;
    }
    const profile = await tx.tailorProfile.findUnique({ where: { userId: input.tailorId } });
    if (!profile || profile.approvalStatus !== "APPROVED" || profile.subscriptionStatus !== "ACTIVE" || !profile.subscriptionPaid || !profile.nextBillingDate || profile.nextBillingDate <= new Date()) throw new AppError("This tailor is not currently accepting new orders.", 409);
    const catalog = asList(profile.publishedGarmentCatalog) as Array<{garmentType:string;basePrice:number;estimatedDays:number;requiredMeasurements:string[]}>;
    const item = catalog.find(g => g.garmentType === input.garmentType);
    if (!item) throw new AppError("This garment is not available from this tailor.", 409);
    const hasCustomMeasurements = input.measurementMode !== "REFERENCE_CLOTH_TEMPLATE";
    if (hasCustomMeasurements && !hasExactMeasurements(input.measurements, item.requiredMeasurements)) throw new AppError("Measurements must match the tailor's exact current requirements.", 400);
    if (!hasCustomMeasurements && Object.keys(input.measurements).some(key => key !== "unit")) throw new AppError("Reference-cloth mode does not accept custom measurements.", 400);
    if (input.agreedCompletionDays !== item.estimatedDays) throw new AppError("The advertised completion time changed. Refresh and review it.", 409);
    const percent = (await tx.appSetting.findUnique({ where: { id: "global" } }))?.commissionPercent ?? 10;
    const amounts = economics(item.basePrice, percent);
    if (input.quotedAmount !== amounts.total) throw new AppError("The quote changed. Refresh and review the current price.", 409);
    if ((input.measurementMode === "REFERENCE_CLOTH_TEMPLATE" || input.measurementMode === "BOTH") !== input.hasReferenceCloth) throw new AppError("Reference-cloth selection does not match the selected measurement mode.");
    const files = await tx.upload.findMany({ where: { id: { in: ids }, ownerId: user.id, orderId: null } });
    if (files.length !== ids.length) throw new AppError("One or more reference images are unavailable.", 409);
    const conversation = await tx.conversation.create({ data: { customerId: user.id, tailorId: input.tailorId } });
    const order = await tx.order.create({ data: {
      customerId: user.id, tailorId: input.tailorId, conversationId: conversation.id, garmentType: input.garmentType,
      measurementMode: input.measurementMode, measurements: input.measurements, requiredMeasurements: item.requiredMeasurements,
      measurementStatus: "PENDING", hasReferenceCloth: input.hasReferenceCloth, designSpecifications: input.designSpecifications,
      publishedDesignSpecifications: "", contentStatus: "PENDING", referenceUploadIds: ids,
      basePrice: item.basePrice, totalAmount: amounts.total, platformFeePercent: percent, platformFeeAmount: amounts.fee, tailorPayout: amounts.net,
      pickupAddress: input.pickupAddress, deliveryAddress: input.deliveryAddress, tailorAddress: profile.publishedWorkshopAddress as Prisma.InputJsonValue,
      agreedCompletionDays: input.agreedCompletionDays, customerAgreedToTimeline: true, timelineConfirmed: false,
      checkoutKey: input.checkoutKey, shipments: { create: [{ leg: "FABRIC_PICKUP", cycle: 0 }, { leg: "FINAL_DELIVERY", cycle: 0 }] },
    } });
    await tx.moderationItem.create({ data: { kind: "ORDER_SPECIFICATION", targetId: order.id, orderId: order.id, authorId: user.id, contentVersion: 1, originalText: JSON.stringify({ designSpecifications: input.designSpecifications, measurements: input.measurements }) } });
    for (const id of ids) await tx.moderationItem.create({ data: { kind: "IMAGE", targetId: id, orderId: order.id, authorId: user.id, contentVersion: 1, uploadId: id } });
    if (ids.length) {
      const claimed = await tx.upload.updateMany({ where: { id: { in: ids }, ownerId: user.id, orderId: null }, data: { orderId: order.id } });
      if (claimed.count !== ids.length) throw new AppError("Images were already attached. Please retry.", 409);
    }
    return order;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return getOrder(result.id, user);
}

const schema = z.discriminatedUnion("kind", [
  z.object({ version: z.number().int().positive(), kind: z.literal("timeline-confirm") }), z.object({ version: z.number().int().positive(), kind: z.literal("timeline-propose"), days: z.number().int().min(1).max(180) }),
  z.object({ version: z.number().int().positive(), kind: z.literal("timeline-accept") }), z.object({ version: z.number().int().positive(), kind: z.literal("production"), status: z.enum(["STITCHING", "READY_FOR_DELIVERY"]) }),
  z.object({ version: z.number().int().positive(), kind: z.literal("logistics"), action: z.enum(["schedule", "collect-pickup", "arrive-tailor", "dispatch-final", "deliver", "reverse-pickup", "reverse-arrive", "return-dispatch", "return-deliver"]), courier: z.string().trim().max(120).optional(), contact: z.string().trim().max(120).optional(), tracking: z.string().trim().max(200).optional() }),
  z.object({ version: z.number().int().positive(), kind: z.literal("alteration"), alterationType: z.enum(["FITTING_FREE", "DESIGN_PAID"]), notes: z.string().trim().min(1).max(1200) }),
  z.object({ version: z.number().int().positive(), kind: z.literal("alteration-quote"), alterationId: z.string(), amount: z.number().int().positive().max(100_000_000) }),
  z.object({ version: z.number().int().positive(), kind: z.literal("feedback"), rating: z.number().int().min(1).max(5), review: z.string().trim().min(1).max(1000) }),
]);
function versionWhere(order: {id:string;version:number}, expected: number) { if (order.version !== expected) throw new AppError("Order changed. Refresh and try again.", 409); return { id: order.id, version: expected }; }
function hasApprovedImages(files: Array<{id:string;approved:boolean}>, ids: string[]) { return ids.every(id => files.some(f => f.id === id && f.approved)); }
export async function transitionOrder(id: string, raw: unknown, user: Actor): Promise<OrderDTO> {
  const input = schema.parse(raw);
  await db.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id }, include: { shipments: true, alterations: { orderBy: { cycle: "desc" } }, uploads: { select: { id: true, approved: true } } } });
    if (!order) throw new AppError("Order not found.", 404);
    versionWhere(order, input.version);
    const bump = async (data: Prisma.OrderUpdateManyMutationInput) => { const changed = await tx.order.updateMany({ where: { id, version: input.version }, data: { ...data, version: { increment: 1 } } }); if (changed.count !== 1) throw new AppError("Order changed. Refresh and try again.", 409); };
    if (input.kind === "timeline-confirm" || input.kind === "timeline-propose") {
      requireRole(user, "TAILOR"); if (order.tailorId !== user.id || order.status !== "PENDING_TIMELINE_APPROVAL") throw new AppError("Timeline confirmation is not available.", 409);
      if (input.kind === "timeline-propose") await bump({ proposedCompletionDays: input.days, timelineConfirmed: false }); else await bump({ timelineConfirmed: true, proposedCompletionDays: null });
    } else if (input.kind === "timeline-accept") {
      requireRole(user, "CUSTOMER"); if (order.customerId !== user.id || order.status !== "PENDING_TIMELINE_APPROVAL" || !order.proposedCompletionDays) throw new AppError("There is no proposed timeline to accept.", 409);
      await bump({ agreedCompletionDays: order.proposedCompletionDays, proposedCompletionDays: null, timelineConfirmed: true });
    } else if (input.kind === "production") {
      requireRole(user, "TAILOR"); if (order.tailorId !== user.id) throw new AppError("This is not your order.", 403);
      if (input.status === "STITCHING") {
        const allowed = ["IN_TRANSIT_TO_TAILOR", "ALTERATION_IN_TRANSIT"].includes(order.status) && order.shipments.some(s => s.cycle === (order.alterations[0]?.cycle ?? 0) && ["FABRIC_PICKUP", "ALTERATION_PICKUP"].includes(s.leg) && s.status === "DELIVERED");
        if (!allowed) throw new AppError("The fabric must arrive before stitching begins.", 409);
      } else if (order.status !== "STITCHING") throw new AppError("This production step is not available yet.", 409);
      await bump({ status: input.status });
    } else if (input.kind === "alteration" || input.kind === "alteration-quote") {
      if (input.kind === "alteration-quote") {
        assertAlterationQuote(user, order.tailorId);
      } else {
        assertAlterationRequest(user, order.customerId);
      }
      if (input.kind === "alteration") {
        validateAlterationNotes(input.notes);
        if (order.status !== "DELIVERED_PENDING_APPROVAL") throw new AppError("Alterations can only be requested after delivery.", 409);
        const cycle = Math.max(0, ...order.alterations.map(a => a.cycle)) + 1;
        await tx.alteration.create({ data: { orderId: id, authorId: user.id, cycle, alterationType: input.alterationType, notes: input.notes, amount: input.alterationType === "FITTING_FREE" ? 0 : null } });
        await tx.shipment.createMany({ data: [{ orderId: id, leg: "ALTERATION_PICKUP", cycle }, { orderId: id, leg: "ALTERATION_RETURN", cycle }] });
        await tx.moderationItem.create({ data: { kind: "ALTERATION", targetId: id, orderId: id, authorId: user.id, contentVersion: cycle, originalText: input.notes } });
        await bump({ status: "ALTERATION_REQUESTED" });
      } else {
        const alteration = await tx.alteration.findUnique({ where: { id: input.alterationId } });
        if (!alteration || alteration.orderId !== id || order.status !== "ALTERATION_REQUESTED" || alteration.contentStatus !== "APPROVED" || alteration.paid || alteration.alterationType !== "DESIGN_PAID") throw new AppError("This alteration quote is not available.", 409);
        await tx.alteration.update({ where: { id: alteration.id }, data: { amount: input.amount, quoteVersion: { increment: 1 }, paid: false } }); await bump({});
      }
    } else if (input.kind === "feedback") {
      requireRole(user, "CUSTOMER"); if (order.customerId !== user.id || order.status !== "COMPLETED") throw new AppError("A review is available only after the order is completed.", 409);
      const review = input.review;
      if (contactError(review)) throw new AppError("Contact details are not allowed in reviews.");
      const old = await tx.review.findUnique({ where: { orderId: id } });
      if (old) { await tx.review.update({ where: { id: old.id }, data: { rating: input.rating, originalText: review, publishedText: "", status: "PENDING", version: { increment: 1 } } }); }
      else await tx.review.create({ data: { orderId: id, customerId: user.id, rating: input.rating, originalText: review } });
      await tx.moderationItem.create({ data: { kind: "REVIEW", targetId: id, orderId: id, authorId: user.id, contentVersion: (old?.version ?? 0) + 1, originalText: review } });
      const changed = await tx.order.updateMany({ where: { id, version: input.version }, data: { customerRating: input.rating, customerReview: review, publishedReview: null, reviewStatus: "PENDING", version: { increment: 1 } } });
      if (changed.count !== 1) throw new AppError("Order changed. Refresh and retry.", 409);
    } else if (input.kind === "logistics") {
      requireRole(user, "ADMIN");
      const action = input.action;
      const cycle = action.startsWith("reverse") || action.startsWith("return") ? Math.max(0, ...order.alterations.map(a => a.cycle)) : 0;
      const leg = action === "schedule" || action === "collect-pickup" || action === "arrive-tailor" ? "FABRIC_PICKUP" : action === "dispatch-final" || action === "deliver" ? "FINAL_DELIVERY" : action === "reverse-pickup" || action === "reverse-arrive" ? "ALTERATION_PICKUP" : "ALTERATION_RETURN";
      let shipment = order.shipments.find(s => s.leg === leg && s.cycle === cycle);
      if (!shipment && action.startsWith("reverse")) shipment = await tx.shipment.create({ data: { orderId: id, leg, cycle } });
      if (!shipment) throw new AppError("Shipment not found.", 404);
      const logisticsText = [input.courier ?? "", input.contact ?? "", input.tracking ?? ""].join(" ");
      if (/(?:[a-z0-9._%+-]+\s*(?:@|\bat\b)\s*[a-z0-9.-]+\s*\.\s*[a-z]{2,})/iu.test(logisticsText.normalize("NFKC"))) throw new AppError("Invalid courier details.");
      if (action === "schedule") {
        if (order.status !== "PENDING_TIMELINE_APPROVAL" || !order.timelineConfirmed || order.contentStatus !== "APPROVED" || order.measurementStatus !== "APPROVED" || !hasApprovedImages(order.uploads, asList(order.referenceUploadIds) as string[])) throw new AppError("Timeline, specifications, and all images must be approved before pickup.", 409);
        if (!input.courier || !input.contact || !input.tracking) throw new AppError("Courier, contact, and tracking are required before dispatch.");
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: "ASSIGNED", courier: input.courier, contact: input.contact, tracking: input.tracking } }); await bump({ status: "PICKUP_SCHEDULED" });
      } else if (action === "collect-pickup") {
        if (order.status !== "PICKUP_SCHEDULED" || shipment.status !== "ASSIGNED") throw new AppError("Pickup must be scheduled first.", 409);
        const amount = splitPayment(order.totalAmount).pickup;
        await tx.payment.create({ data: { orderId: id, installment: "PICKUP", cycle: 0, amount, status: "SUCCEEDED", idempotencyKey: `admin-pickup-${id}` } });
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: "IN_TRANSIT", dispatchedAt: new Date() } }); await bump({ pickupPaid: true, status: "IN_TRANSIT_TO_TAILOR" });
      } else if (action === "arrive-tailor" || action === "reverse-arrive") {
        if (shipment.status !== "IN_TRANSIT") throw new AppError("Only dispatched shipments can arrive.", 409);
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: "DELIVERED", deliveredAt: new Date() } }); await bump({ status: action === "arrive-tailor" ? "IN_TRANSIT_TO_TAILOR" : "ALTERATION_IN_TRANSIT" });
      } else if (action === "dispatch-final" || action === "return-dispatch") {
        if (order.status !== "READY_FOR_DELIVERY" || (action === "dispatch-final" && shipment.status !== "UNASSIGNED")) throw new AppError("This delivery step is not available.", 409);
        if (!input.courier || !input.contact || !input.tracking) throw new AppError("Courier, contact, and tracking are required before dispatch.");
        if (action === "dispatch-final") await tx.shipment.update({ where: { id: shipment.id }, data: { status: "IN_TRANSIT", courier: input.courier, contact: input.contact, tracking: input.tracking, dispatchedAt: new Date() } });
        else {
          if (shipment.status !== "UNASSIGNED" && shipment.status !== "ASSIGNED") throw new AppError("Return shipment cannot be dispatched now.", 409);
          await tx.shipment.update({ where: { id: shipment.id }, data: { status: "IN_TRANSIT", courier: input.courier, contact: input.contact, tracking: input.tracking, dispatchedAt: new Date() } });
        }
        await bump({});
      } else if (action === "deliver" || action === "return-deliver") {
        if (shipment.status !== "IN_TRANSIT") throw new AppError("Only dispatched shipments can be delivered.", 409);
        if (action === "deliver") {
          const amount = splitPayment(order.totalAmount).delivery;
          await tx.payment.create({ data: { orderId: id, installment: "DELIVERY", cycle: 0, amount, status: "SUCCEEDED", idempotencyKey: `admin-delivery-${id}` } });
          await tx.shipment.update({ where: { id: shipment.id }, data: { status: "DELIVERED", deliveredAt: new Date() } }); await bump({ deliveryPaid: true, status: "DELIVERED_PENDING_APPROVAL" });
        } else { if (order.status !== "READY_FOR_DELIVERY") throw new AppError("Return delivery is not available.", 409); await tx.shipment.update({ where: { id: shipment.id }, data: { status: "DELIVERED", deliveredAt: new Date() } }); await tx.alteration.updateMany({ where: { orderId: id, cycle }, data: { completed: true } }); await bump({ status: "DELIVERED_PENDING_APPROVAL" }); }
      } else if (action === "reverse-pickup") {
        const alt = order.alterations.find(a => a.cycle === cycle);
        if (order.status !== "ALTERATION_REQUESTED" || !alt || alt.contentStatus !== "APPROVED" || (alt.alterationType === "DESIGN_PAID" && (!alt.paid || !alt.amount))) throw new AppError("Approved alteration notes and any design payment are required before pickup.", 409);
        if (!input.courier || !input.contact || !input.tracking) throw new AppError("Courier, contact, and tracking are required before dispatch.");
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: "IN_TRANSIT", courier: input.courier, contact: input.contact, tracking: input.tracking, dispatchedAt: new Date() } }); await bump({ status: "ALTERATION_IN_TRANSIT" });
      }
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return getOrder(id, user);
}

export function ledger(orders: Pick<OrderDTO, "totalAmount" | "payments" | "status" | "commissionAmount" | "tailorNetPayout">[]) {
  return orders.reduce((sum, o) => {
    const paid = o.payments.filter(p => p.status === "SUCCEEDED");
    const collected = paid.reduce((n, p) => n + p.amount, 0);
    const design = paid.filter(p => p.installment === "DESIGN").reduce((n, p) => n + p.amount, 0);
    const completed = o.status === "COMPLETED";
    return { gross: sum.gross + o.totalAmount + design, collected: sum.collected + collected, unpaid: sum.unpaid + o.totalAmount + design - collected, held: sum.held + (completed ? 0 : collected), expectedFee: sum.expectedFee + o.commissionAmount, recognizedFee: sum.recognizedFee + (completed ? o.commissionAmount : 0), payoutOwed: sum.payoutOwed + (completed ? o.tailorNetPayout : 0), subscriptionCollected: sum.subscriptionCollected, designCollected: sum.designCollected + design };
  }, { gross: 0, collected: 0, unpaid: 0, held: 0, expectedFee: 0, recognizedFee: 0, payoutOwed: 0, subscriptionCollected: 0, designCollected: 0 });
}
