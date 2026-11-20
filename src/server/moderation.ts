import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db.ts";
import { AppError } from "./errors.ts";
import { requireRole } from "./auth.ts";
import type { Actor } from "./auth.ts";
import type { ModerationDTO } from "../lib/contracts.ts";
import { asList } from "./dto.ts";
import { assertImageReplacementKind, publishedModerationText, resolvePortfolioIds } from "./moderation-publication.ts";
import { maskedAlias } from "./masked-code.ts";
import { approvedSubscriptionStatus } from "./subscription-domain.ts";

const inputSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]), publishedText: z.string().max(4000), replacementUploadId: z.string().optional() }).strict();

function currentVersion(item: { kind: string; contentVersion: number; targetId: string }, source: { profileVersion?: number; contentVersion?: number; cycle?: number; version?: number } | null) {
  if (!source) throw new AppError("Content was removed before review.", 409);
  const actual = item.kind === "PROFILE" ? source.profileVersion : item.kind === "ORDER_SPECIFICATION" || item.kind === "MESSAGE" || item.kind === "IMAGE" ? source.contentVersion : item.kind === "ALTERATION" ? source.cycle : source.version;
  if (actual !== item.contentVersion) throw new AppError("This review is stale. Review the latest submitted version.", 409);
}

async function syncPublishedPortfolio(tx: Prisma.TransactionClient, userId: string) {
  const profile = await tx.tailorProfile.findUnique({ where: { userId } });
  if (!profile || profile.approvalStatus !== "APPROVED") return;
  const sourceIds = asList(profile.portfolioUploadIds) as string[];
  const approvedImages = await tx.moderationItem.findMany({
    where: { kind: "IMAGE", targetId: { in: sourceIds }, status: "APPROVED" },
    select: { targetId: true, replacementUploadId: true },
  });
  const replacements = new Map(approvedImages.flatMap(item => item.replacementUploadId ? [[item.targetId, item.replacementUploadId] as const] : []));
  const candidates = [...new Set([...sourceIds, ...replacements.values()])];
  const approvedIds = new Set((await tx.upload.findMany({ where: { id: { in: candidates }, approved: true }, select: { id: true } })).map(image => image.id));
  const publishedIds = resolvePortfolioIds(sourceIds, approvedIds, replacements);
  const previousIds = asList(profile.publishedPortfolioUploadIds) as string[];
  const revokeIds = previousIds.filter(id => !publishedIds.includes(id));
  if (revokeIds.length) await tx.upload.updateMany({ where: { id: { in: revokeIds }, ownerId: userId }, data: { publicUse: false } });
  if (publishedIds.length) await tx.upload.updateMany({ where: { id: { in: publishedIds }, approved: true }, data: { publicUse: true } });
  await tx.tailorProfile.update({ where: { userId }, data: { publishedPortfolioUploadIds: publishedIds } });
}

export async function moderationQueue(user: Actor): Promise<ModerationDTO[]> {
  requireRole(user, "ADMIN");
  const items = await db.moderationItem.findMany({ where: { status: "PENDING" }, include: { author: { select: { maskedCode: true, role: true } }, upload: true }, orderBy: { createdAt: "asc" } });
  return items.map(item => ({
    id: item.id,
    kind: item.kind,
    targetId: item.targetId,
    authorAlias: item.author.role === "ADMIN" ? "Sui-dhaaga Admin" : maskedAlias(item.author.role, item.author.maskedCode),
    originalText: item.originalText,
    imageUrl: item.uploadId ? `/api/uploads/${item.uploadId}` : null,
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function reviewModeration(id: string, raw: unknown, user: Actor) {
  requireRole(user, "ADMIN");
  const input = inputSchema.parse(raw);
  await db.$transaction(async tx => {
    const item = await tx.moderationItem.findUnique({ where: { id }, include: { upload: true } });
    if (!item || item.status !== "PENDING") throw new AppError("Moderation item is no longer pending.", 409);
    const approved = input.status === "APPROVED";
    assertImageReplacementKind(item.kind, input.replacementUploadId);
    if (input.replacementUploadId && !approved) throw new AppError("Replacement images can only be used when approving an image.", 400);
    const publication = approved ? publishedModerationText(item.kind, item.originalText, input.publishedText, item.uploadId) : "";

    let source: { profileVersion?: number; contentVersion?: number; cycle?: number; version?: number } | null;
    if (item.kind === "PROFILE") source = await tx.tailorProfile.findUnique({ where: { userId: item.targetId } });
    else if (item.kind === "ORDER_SPECIFICATION") source = await tx.order.findUnique({ where: { id: item.targetId } });
    else if (item.kind === "MESSAGE") source = await tx.message.findUnique({ where: { id: item.targetId } });
    else if (item.kind === "ALTERATION") source = await tx.alteration.findFirst({ where: { orderId: item.orderId ?? undefined, cycle: item.contentVersion } });
    else if (item.kind === "REVIEW") source = await tx.review.findUnique({ where: { orderId: item.targetId } });
    else source = item.upload;
    currentVersion(item, source);

    if (input.replacementUploadId) {
      if (item.uploadId === input.replacementUploadId) throw new AppError("Choose a different replacement image.", 409);
      const replacement = await tx.upload.findUnique({ where: { id: input.replacementUploadId } });
      const replacementMessage = replacement ? await tx.message.findUnique({ where: { uploadId: replacement.id }, select: { id: true } }) : null;
      const priorReview = replacement ? await tx.moderationItem.findFirst({ where: { uploadId: replacement.id }, select: { id: true } }) : null;
      if (!replacement || replacement.ownerId !== user.id || replacement.orderId || replacement.approved || replacement.publicUse || replacement.claimedForModerationId || replacementMessage || priorReview) {
        throw new AppError("Replacement image must be an unattached Admin-owned upload.", 409);
      }
      const claimed = await tx.upload.updateMany({
        where: { id: replacement.id, ownerId: user.id, orderId: null, approved: false, publicUse: false, claimedForModerationId: null },
        data: { claimedForModerationId: item.id },
      });
      if (claimed.count !== 1) throw new AppError("Replacement image was already claimed. Choose another image.", 409);
    }

    if (item.kind === "PROFILE") {
      const candidate = JSON.parse(item.originalText) as { expertise: string[]; garmentCatalog: unknown; portfolioUploadIds: string[]; workshopAddress: unknown };
      const profile = await tx.tailorProfile.findUniqueOrThrow({ where: { userId: item.targetId } });
      const now = new Date();
      const status = approvedSubscriptionStatus(profile.subscriptionPaid, approved ? "APPROVED" : "REJECTED", profile.nextBillingDate, now);
      if (approved) {
        await tx.tailorProfile.update({
          where: { userId: item.targetId },
          data: {
            publishedBio: publication,
            publishedExpertise: candidate.expertise,
            publishedGarmentCatalog: candidate.garmentCatalog as Prisma.InputJsonValue,
            publishedWorkshopAddress: candidate.workshopAddress as Prisma.InputJsonValue,
            approvalStatus: "APPROVED",
            subscriptionStatus: status,
          },
        });
        await syncPublishedPortfolio(tx, item.targetId);
      } else {
        await tx.tailorProfile.update({ where: { userId: item.targetId }, data: { approvalStatus: "REJECTED", subscriptionStatus: status } });
      }
    } else if (item.kind === "ORDER_SPECIFICATION") {
      const order = await tx.order.findUniqueOrThrow({ where: { id: item.targetId } });
      if (approved) {
        const original = JSON.parse(item.originalText) as { measurements: unknown };
        await tx.order.update({ where: { id: order.id }, data: { publishedDesignSpecifications: publication, measurements: original.measurements as Prisma.InputJsonValue, contentStatus: "APPROVED", measurementStatus: "APPROVED", version: { increment: 1 } } });
      } else {
        await tx.order.update({ where: { id: order.id }, data: { contentStatus: "REJECTED", measurementStatus: "REJECTED", version: { increment: 1 } } });
      }
    } else if (item.kind === "MESSAGE") {
      await tx.message.update({ where: { id: item.targetId }, data: { contentStatus: input.status, publishedContent: publication } });
    } else if (item.kind === "ALTERATION") {
      const alteration = await tx.alteration.findFirstOrThrow({ where: { orderId: item.orderId ?? undefined, cycle: item.contentVersion } });
      await tx.alteration.update({ where: { id: alteration.id }, data: { contentStatus: input.status, publishedNotes: publication } });
      await tx.order.update({ where: { id: alteration.orderId }, data: { version: { increment: 1 } } });
    } else if (item.kind === "REVIEW") {
      const review = await tx.review.findUniqueOrThrow({ where: { orderId: item.targetId } });
      await tx.review.update({ where: { id: review.id }, data: { status: input.status, publishedText: publication } });
      await tx.order.update({ where: { id: item.targetId }, data: { reviewStatus: input.status, publishedReview: approved ? publication : null, version: { increment: 1 } } });
    } else {
      const upload = await tx.upload.findUniqueOrThrow({ where: { id: item.targetId } });
      const profile = await tx.tailorProfile.findUnique({ where: { userId: item.authorId } });
      const isPortfolio = !!profile && (asList(profile.portfolioUploadIds) as string[]).includes(upload.id);
      const message = await tx.message.findFirst({ where: { uploadId: upload.id } });
      await tx.upload.update({ where: { id: upload.id }, data: { approved: approved && !input.replacementUploadId, publicUse: false, contentVersion: { increment: 1 } } });

      if (input.replacementUploadId) {
        if (item.orderId) {
          const order = await tx.order.findUniqueOrThrow({ where: { id: item.orderId } });
          await tx.order.update({ where: { id: order.id }, data: { referenceUploadIds: (asList(order.referenceUploadIds) as string[]).map(value => value === upload.id ? input.replacementUploadId! : value), version: { increment: 1 } } });
        }
        if (message) await tx.message.update({ where: { id: message.id }, data: { uploadId: input.replacementUploadId } });
        await tx.upload.update({
          where: { id: input.replacementUploadId },
          data: { approved: true, orderId: item.orderId, publicUse: false, contentVersion: { increment: 1 } },
        });
      } else if (item.orderId) {
        await tx.order.update({ where: { id: item.orderId }, data: { version: { increment: 1 } } });
      }

      const reviewed = await tx.moderationItem.updateMany({
        where: { id, status: "PENDING", contentVersion: item.contentVersion },
        data: { status: input.status, publishedText: "", replacementUploadId: input.replacementUploadId },
      });
      if (reviewed.count !== 1) throw new AppError("This review became stale. Refresh and retry.", 409);
      if (isPortfolio) await syncPublishedPortfolio(tx, item.authorId);
      return;
    }

    const reviewed = await tx.moderationItem.updateMany({
      where: { id, status: "PENDING", contentVersion: item.contentVersion },
      data: { status: input.status, publishedText: publication, replacementUploadId: input.replacementUploadId },
    });
    if (reviewed.count !== 1) throw new AppError("This review became stale. Refresh and retry.", 409);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { ok: true };
}
