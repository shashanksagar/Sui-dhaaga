import { db } from "./db.ts";
import type { Prisma } from "@prisma/client";
import { AppError } from "./errors.ts";
import type { Actor } from "./auth.ts";
import { requireRole } from "./auth.ts";
import { messageSchema } from "../lib/validation.ts";
import type { ConversationDTO, MessageDTO } from "../lib/contracts.ts";
import type { Server } from "socket.io";
import { maskedAlias } from "./masked-code.ts";
const realtime = globalThis as typeof globalThis & { stitchIO?: Server };
export function attachRealtime(io: Server) { realtime.stitchIO = io; }
const conversationIncludes = { order: true, customer: { select: { maskedCode: true } }, tailor: { select: { maskedCode: true } } } satisfies Prisma.ConversationInclude;
function conversationDTO(c: Prisma.ConversationGetPayload<{ include: typeof conversationIncludes }>): ConversationDTO { return { id: c.id, orderId: c.order?.id ?? null, customerMaskedCode: maskedAlias("CUSTOMER", c.customer.maskedCode), tailorMaskedCode: maskedAlias("TAILOR", c.tailor.maskedCode), createdAt: c.createdAt.toISOString() }; }
export async function conversations(user: Actor): Promise<ConversationDTO[]> {
  const rows = await db.conversation.findMany({ where: user.role === "ADMIN" ? {} : { OR: [{ customerId: user.id }, { tailorId: user.id }] }, include: conversationIncludes, orderBy: { createdAt: "desc" } });
  return rows.map(conversationDTO);
}
export async function conversation(id: string, user: Actor): Promise<ConversationDTO> {
  const row = await db.conversation.findUnique({ where: { id }, include: conversationIncludes });
  if (!row || (user.role !== "ADMIN" && row.customerId !== user.id && row.tailorId !== user.id)) throw new AppError("Conversation not available.", 403);
  return conversationDTO(row);
}
export async function createConversation(tailorId: string, user: Actor): Promise<ConversationDTO> {
  requireRole(user, "CUSTOMER");
  const profile = await db.tailorProfile.findUnique({ where: { userId: tailorId } });
  if (!profile || profile.approvalStatus !== "APPROVED" || profile.subscriptionStatus !== "ACTIVE" || !profile.subscriptionPaid || !profile.nextBillingDate || profile.nextBillingDate <= new Date()) throw new AppError("This tailor is not currently accepting inquiries.", 409);
  let row = await db.conversation.findFirst({ where: { customerId: user.id, tailorId, order: null }, include: conversationIncludes });
  if (!row) row = await db.conversation.create({ data: { customerId: user.id, tailorId }, include: conversationIncludes });
  return conversationDTO(row);
}
async function loadConversation(id: string, user: Actor) {
  const row = await db.conversation.findUnique({ where: { id }, include: { order: { select: { id: true } } } });
  if (!row || (user.role !== "ADMIN" && row.customerId !== user.id && row.tailorId !== user.id)) throw new AppError("Conversation not available.", 403);
  return row;
}
export async function messages(conversationId: string, user: Actor): Promise<MessageDTO[]> {
  await loadConversation(conversationId, user);
  const rows = await db.message.findMany({ where: { conversationId }, include: { sender: { select: { id: true, role: true, maskedCode: true } }, upload: { select: { id: true, approved: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  return rows.flatMap(message => {
    const mine = message.senderId === user.id;
    const visible = user.role === "ADMIN" || mine || (message.contentStatus === "APPROVED" && (!message.uploadId || message.upload?.approved));
    if (!visible) return [];
    const published = user.role === "ADMIN" || mine ? message.content : message.publishedContent;
    const imageVisible = !!message.uploadId && (user.role === "ADMIN" || mine || message.upload?.approved);
    return [{ id: message.id, alias: maskedAlias(message.sender.role, message.sender.maskedCode), mine, content: published, imageUrl: imageVisible ? `/api/uploads/${message.uploadId}` : null,
      moderationStatus: message.uploadId && !message.upload?.approved ? "PENDING" : message.contentStatus, createdAt: message.createdAt.toISOString() }];
  });
}
export async function sendMessage(conversationId: string, raw: unknown, user: Actor): Promise<MessageDTO> {
  const room = await loadConversation(conversationId, user);
  const input = messageSchema.parse(raw);
  const saved = await db.$transaction(async tx => {
    const old = await tx.message.findUnique({ where: { clientKey: input.clientKey } });
    if (old) { if (old.senderId !== user.id || old.conversationId !== conversationId) throw new AppError("Message key already in use.", 409); return old; }
    let uploadId: string|undefined;
    if (input.uploadId) {
      const upload = await tx.upload.findUnique({ where: { id: input.uploadId } });
      if (!upload || upload.ownerId !== user.id || upload.orderId || await tx.message.findUnique({ where: { uploadId: input.uploadId } })) throw new AppError("Attachment is unavailable.", 409);
      uploadId = upload.id;
    }
    const message = await tx.message.create({ data: { conversationId, orderId: room.order?.id ?? null, senderId: user.id, content: input.content, contentStatus: "PENDING", clientKey: input.clientKey, uploadId } });
    await tx.moderationItem.create({ data: { kind: "MESSAGE", targetId: message.id, orderId: room.order?.id, authorId: user.id, contentVersion: 1, originalText: input.content, uploadId: uploadId ?? null } });
    if (uploadId && room.order?.id) await tx.upload.update({ where: { id: uploadId }, data: { orderId: room.order.id } });
    if (uploadId) await tx.moderationItem.create({ data: { kind: "IMAGE", targetId: uploadId, orderId: room.order?.id, authorId: user.id, contentVersion: 1, uploadId } });
    return message;
  });
  realtime.stitchIO?.to(`conversation:${conversationId}`).emit("invalidate", { conversationId });
  realtime.stitchIO?.to(`order:${conversationId}`).emit("invalidate", { conversationId });
  if (room.order?.id) realtime.stitchIO?.to(`order:${room.order.id}`).emit("invalidate", { conversationId });
  const sender = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { maskedCode: true } });
  return { id: saved.id, alias: maskedAlias(user.role, sender.maskedCode), mine: true, content: saved.content, imageUrl: saved.uploadId ? `/api/uploads/${saved.uploadId}` : null, moderationStatus: saved.contentStatus, createdAt: saved.createdAt.toISOString() };
}
export async function chatMember(orderOrConversationId: string, user: Actor) {
  const order = await db.order.findUnique({ where: { id: orderOrConversationId } });
  const conversationId = order?.conversationId ?? orderOrConversationId;
  const convo = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!convo || (user.role !== "ADMIN" && convo.customerId !== user.id && convo.tailorId !== user.id)) throw new AppError("This conversation is not available.", 403);
  return convo;
}
