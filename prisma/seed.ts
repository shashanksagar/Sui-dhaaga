import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { catalogFor, tailors, workshopAddress } from "../src/lib/demo-data.ts";
import { createNeonAdapter } from "../src/server/neon-adapter.ts";
import { addCalendarMonthClamped } from "../src/server/subscription-domain.ts";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required. Configure the new project's pooled Neon URL before seeding.");
const db = new PrismaClient({ adapter: createNeonAdapter(connectionString) });
try {
  if (process.env.DEMO_MODE !== "true" || !process.env.DEMO_PASSWORD) throw new Error("Seeding requires DEMO_MODE=true and a local DEMO_PASSWORD.");
  const passwordHash = await hash(process.env.DEMO_PASSWORD, 12);
  const users = [
    { id: "customer-demo", maskedCode: "#C-892", name: "Demo Customer", email: "customer@sui.local", role: "CUSTOMER" as const, location: "Mumbai", phone: "0000000000" },
    { id: "admin-demo", maskedCode: "#A-001", name: "Sui-dhaaga Admin", email: "admin@sui.local", role: "ADMIN" as const, location: "Mumbai", phone: "0000000000" },
    ...tailors.map((t, i) => ({ id: t.id, maskedCode: `#SD-${101 + i}`, name: `Tailor ${i + 1}`, email: `tailor${i + 1}@sui.local`, role: "TAILOR" as const, location: t.city, phone: "0000000000" })),
  ];
  for (const user of users) await db.user.upsert({ where: { id: user.id }, update: { maskedCode: user.maskedCode, phone: user.phone }, create: { ...user, passwordHash } });
  const expires = addCalendarMonthClamped(new Date());
  for (const [index, t] of tailors.entries()) {
    const catalog = catalogFor(t);
    const imageId = `seed-portfolio-${index + 1}`;
    const bytes = await readFile(resolve("public", "images", `atelier-${index + 1}.svg`));
    await db.upload.upsert({ where: { id: imageId }, update: {}, create: {
      id: imageId, ownerId: t.id, key: `${imageId}.svg`, mime: "image/svg+xml", size: bytes.length,
      approved: true, publicUse: true, data: { create: { bytes } },
    } });
    const profileData = { bio: t.bio, publishedBio: t.bio, expertise: t.expertise, publishedExpertise: t.expertise, garmentCatalog: catalog, publishedGarmentCatalog: catalog, workshopAddress: workshopAddress(t), publishedWorkshopAddress: workshopAddress(t), portfolioUploadIds: [imageId], publishedPortfolioUploadIds: [imageId], profileVersion: 1, approvalStatus: "APPROVED" as const, subscriptionStatus: "ACTIVE" as const, subscriptionPaid: true, monthlyFeeAmount: 49900, nextBillingDate: expires };
    await db.tailorProfile.upsert({ where: { userId: t.id }, update: profileData, create: { userId: t.id, ...profileData } });
    await db.subscriptionPayment.upsert({ where: { idempotencyKey: `seed-subscription-${index + 1}` }, update: {}, create: { userId: t.id, amount: 49900, status: "SUCCEEDED", idempotencyKey: `seed-subscription-${index + 1}` } });
  }
  await db.appSetting.upsert({ where: { id: "global" }, update: {}, create: { id: "global", commissionPercent: 10 } });
  const demoAddress = { name: "Demo Customer", line1: "18 Sample Road", city: "Mumbai", postalCode: "400001", country: "India", phone: "0000000000" };
  for (const [index, t] of tailors.slice(0, 2).entries()) {
    const orderId = `order-demo-${index + 1}`;
    if (await db.order.findUnique({ where: { id: orderId }, select: { id: true } })) continue;
    const item = catalogFor(t)[0];
    const conversation = await db.conversation.create({ data: { customerId: "customer-demo", tailorId: t.id } });
    const measurements = Object.fromEntries([...item.requiredMeasurements.map((field, i) => [field, 80 + i * 3]), ["unit", "cm"]]);
    const total = item.basePrice + Math.round(item.basePrice / 10);
    const order = await db.order.create({ data: {
      id: orderId, customerId: "customer-demo", tailorId: t.id, conversationId: conversation.id,
      garmentType: item.garmentType, measurementMode: "CUSTOM_MEASUREMENTS", measurements,
      requiredMeasurements: item.requiredMeasurements, measurementStatus: "PENDING", hasReferenceCloth: false,
      designSpecifications: "A classic, comfortable fit with simple finishing.", publishedDesignSpecifications: "",
      contentStatus: "PENDING", referenceUploadIds: [], basePrice: item.basePrice, totalAmount: total,
      platformFeePercent: 10, platformFeeAmount: total - item.basePrice, tailorPayout: item.basePrice,
      pickupAddress: demoAddress, deliveryAddress: demoAddress, tailorAddress: workshopAddress(t),
      agreedCompletionDays: item.estimatedDays, customerAgreedToTimeline: true, timelineConfirmed: false,
      checkoutKey: `seed-checkout-${index + 1}`, status: "PENDING_TIMELINE_APPROVAL",
      shipments: { create: [{ leg: "FABRIC_PICKUP", cycle: 0 }, { leg: "FINAL_DELIVERY", cycle: 0 }] },
    } });
    await db.moderationItem.create({ data: { kind: "ORDER_SPECIFICATION", targetId: order.id, orderId: order.id, authorId: "customer-demo", contentVersion: 1, originalText: JSON.stringify({ designSpecifications: order.designSpecifications, measurements }) } });
  }
  console.log("Sui-dhaaga seed complete: five approved demo tailors and demo customer/admin accounts.");
} finally { await db.$disconnect(); }
