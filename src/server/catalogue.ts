import { db } from "./db.ts";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AppError } from "./errors.ts";
import type { Actor } from "./auth.ts";
import { requireRole } from "./auth.ts";
import { economics } from "../lib/money.ts";
import { profileSchema } from "../lib/validation.ts";
import type { ProfileDTO, TailorCard } from "../lib/contracts.ts";
import { asList, profileDTO } from "./dto.ts";
import { renewalDate } from "./subscription-domain.ts";
export { addCalendarMonthClamped } from "./subscription-domain.ts";

export async function catalogue(): Promise<TailorCard[]> {
  const now = new Date();
  const profiles = await db.tailorProfile.findMany({ where: { approvalStatus: "APPROVED", subscriptionStatus: "ACTIVE", subscriptionPaid: true, nextBillingDate: { gt: now } }, include: { user: { select: { id: true, maskedCode: true, location: true } } } });
  const percent = (await db.appSetting.findUnique({ where: { id: "global" } }))?.commissionPercent ?? 10;
  return Promise.all(profiles.map(async profile => {
    const catalog = asList(profile.publishedGarmentCatalog) as Array<{garmentType:string;basePrice:number;estimatedDays:number;requiredMeasurements:string[]}>;
    const reviews = await db.review.aggregate({ where: { order: { tailorId: profile.userId }, status: "APPROVED" }, _avg: { rating: true } });
    const requestedIds = asList(profile.publishedPortfolioUploadIds) as string[];
    const approvedUploads = await db.upload.findMany({ where: { id: { in: requestedIds }, approved: true, publicUse: true }, select: { id: true } });
    const ids = approvedUploads.map(image => image.id);
    return {
      id: profile.userId, maskedCode: `Tailor ${profile.user.maskedCode}`, city: profile.user.location,
      expertise: asList(profile.publishedExpertise) as string[], bio: profile.publishedBio,
      garmentCatalog: catalog.map(item => ({ ...item, platformCommission: economics(item.basePrice, percent).fee, commissionPercent: percent, finalDisplayPrice: economics(item.basePrice, percent).total })),
      rating: reviews._avg.rating ?? 0, portfolioImages: ids.map(id => `/api/uploads/${id}`),
    };
  }));
}

export async function ownProfile(user: Actor): Promise<ProfileDTO> {
  requireRole(user, "TAILOR");
  const profile = await db.tailorProfile.findUnique({ where: { userId: user.id }, include: { user: { select: { id: true, maskedCode: true, name: true, email: true, phone: true, location: true } } } });
  if (!profile) throw new AppError("Tailor profile not found.", 404);
  const percent = (await db.appSetting.findUnique({ where: { id: "global" } }))?.commissionPercent ?? 10;
  const rating = await db.review.aggregate({ where: { order: { tailorId: user.id }, status: "APPROVED" }, _avg: { rating: true } });
  return profileDTO(profile, profile.user, percent, rating._avg.rating ?? 0, true);
}

export async function updateProfile(raw: unknown, user: Actor): Promise<ProfileDTO> {
  requireRole(user, "TAILOR");
  const input = profileSchema.parse(raw);
  const ids = [...new Set(input.portfolioUploadIds)];
  await db.$transaction(async tx => {
    const files = await tx.upload.findMany({ where: { id: { in: ids }, ownerId: user.id, orderId: null } });
    const usedInMessages = await tx.message.count({ where: { uploadId: { in: ids } } });
    if (files.length !== ids.length || usedInMessages) throw new AppError("One or more portfolio images are unavailable.", 409);
    const current = await tx.tailorProfile.findUnique({ where: { userId: user.id } });
    if (!current) throw new AppError("Tailor profile not found.", 404);
    const version = current.profileVersion + 1;
    const data = { ...input, portfolioUploadIds: ids, profileVersion: version, approvalStatus: "PENDING" as const };
    await tx.user.update({ where: { id: user.id }, data: { location: input.city } });
    await tx.tailorProfile.update({ where: { userId: user.id }, data });
    await tx.moderationItem.create({ data: { kind: "PROFILE", targetId: user.id, authorId: user.id, contentVersion: version, originalText: JSON.stringify(data) } });
    for (const file of files) if (!file.approved) await tx.moderationItem.create({ data: { kind: "IMAGE", targetId: file.id, authorId: user.id, contentVersion: file.contentVersion, uploadId: file.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return ownProfile(user);
}

export async function subscribeTailor(raw: unknown, user: Actor): Promise<ProfileDTO> {
  requireRole(user, "TAILOR");
  const input = z.object({ outcome: z.enum(["success", "failure"]), idempotencyKey: z.uuid() }).strict().parse(raw);
  await db.$transaction(async tx => {
    const profile = await tx.tailorProfile.findUnique({ where: { userId: user.id } });
    if (!profile) throw new AppError("Tailor profile not found.", 404);
    const prior = await tx.subscriptionPayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (prior) {
      if (prior.userId !== user.id || prior.amount !== 49900) throw new AppError("Subscription key already used.", 409);
      if (prior.status === "SUCCEEDED") return;
      if (prior.status === "FAILED") return;
    }
    await tx.subscriptionPayment.create({ data: { userId: user.id, amount: 49900, status: input.outcome === "success" ? "SUCCEEDED" : "FAILED", idempotencyKey: input.idempotencyKey } });
    if (input.outcome === "success") {
      const now = new Date();
      const nextBillingDate = renewalDate(profile.nextBillingDate, now);
      const active = profile.approvalStatus === "APPROVED";
      await tx.tailorProfile.update({ where: { userId: user.id }, data: { subscriptionPaid: true, subscriptionStatus: active ? "ACTIVE" : "PENDING", nextBillingDate } });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return ownProfile(user);
}
