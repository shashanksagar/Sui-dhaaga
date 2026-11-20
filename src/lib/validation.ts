import { z } from "zod";
export const cities = ["Mumbai", "Delhi", "Bengaluru", "Jaipur", "Kolkata", "Chennai", "Hyderabad", "Pune", "Ahmedabad", "Lucknow"] as const;
export const garmentTypes = ["Dress", "Suit", "Shirt", "Trousers", "Traditional wear", "Blouse", "Kurta", "Lehenga"] as const;
export const measurementFields = ["chest", "bust", "waist", "hip", "shoulder", "sleeve", "length", "inseam", "neck"] as const;
export const expertiseTags = ["Bridal", "Alterations", "Traditional wear", "Formalwear", "Casualwear", "Embroidery", "Suits", "Dresses", "Menswear", "Womenswear"] as const;
export const contactCheck = (v: string) => {
  const normalized = v.normalize("NFKC").replace(/[\u200B-\u200F\uFEFF\u2060]/g, "").toLowerCase();
  return !/[\p{L}\p{N}._%+-]+\s*(?:@|\bat\b)\s*[\p{L}\p{N}.-]+\s*\.\s*[\p{L}]{2,}/u.test(normalized) &&
    !/(?:^|[^\p{L}\p{N}])@[\p{L}\p{N}_.-]{2,}/u.test(normalized) &&
    !/(?:\+?\p{Nd}[\p{Nd}\s().-]{6,}\p{Nd})/u.test(normalized);
};
const cleanPublicText = (max: number) => z.string().trim().min(1).max(max).refine(contactCheck, "Contact details are not allowed in public text.");
export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80), email: z.email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters").max(128), role: z.enum(["CUSTOMER", "TAILOR"]),
  location: z.enum(cities), phone: z.string().trim().min(7).max(30),
}).strict();
export const addressSchema = z.object({ name: z.string().trim().min(2).max(100), line1: z.string().trim().min(5).max(200), city: z.enum(cities), postalCode: z.string().trim().min(4).max(12), country: z.literal("India"), phone: z.string().trim().min(7).max(30) }).strict();
export const measurementSchema = z.object({ key: z.enum(measurementFields), number: z.number().positive().max(500), unit: z.enum(["cm", "in"]) }).strict();
export const measurementsSchema = z.record(z.string(), z.union([z.number().positive().max(500), z.enum(["cm", "in"])] as const)).superRefine((obj, ctx) => {
  const keys = Object.keys(obj).filter(k => k !== "unit");
  for (const key of keys) if (!(measurementFields as readonly string[]).includes(key)) ctx.addIssue({ code: "custom", path: [key], message: "Unsupported measurement." });
  if (keys.length > measurementFields.length || (obj.unit !== "cm" && obj.unit !== "in")) ctx.addIssue({ code: "custom", message: "Provide valid measurements and a cm/in unit." });
});
export const garmentCatalogSchema = z.array(z.object({
  garmentType: z.enum(garmentTypes), basePrice: z.number().int().positive().max(100_000_000), estimatedDays: z.number().int().min(1).max(180),
  requiredMeasurements: z.array(z.enum(measurementFields)).min(1).max(measurementFields.length),
}).strict()).min(1).max(garmentTypes.length);
export const profileSchema = z.object({
  city: z.enum(cities), expertise: z.array(z.enum(expertiseTags)).min(1).max(10), bio: cleanPublicText(1200), garmentCatalog: garmentCatalogSchema,
  portfolioUploadIds: z.array(z.string().min(1)).max(12), workshopAddress: addressSchema,
}).strict();
export const orderSchema = z.object({
  tailorId: z.string().min(1), garmentType: z.enum(garmentTypes), quotedAmount: z.number().int().positive(),
  measurementMode: z.enum(["CUSTOM_MEASUREMENTS", "REFERENCE_CLOTH_TEMPLATE", "BOTH"]), measurements: measurementsSchema,
  hasReferenceCloth: z.boolean(), designSpecifications: cleanPublicText(2000), pickupAddress: addressSchema, deliveryAddress: addressSchema,
  uploadIds: z.array(z.string()).max(5), customerAgreedToTimeline: z.literal(true), agreedCompletionDays: z.number().int().min(1).max(180), checkoutKey: z.uuid(),
}).strict().superRefine((value, ctx) => {
  const keys = Object.keys(value.measurements).filter(key => key !== "unit");
  if (value.measurementMode === "REFERENCE_CLOTH_TEMPLATE" && keys.length) ctx.addIssue({ code: "custom", path: ["measurements"], message: "Reference-cloth mode does not accept custom measurements." });
  if (value.measurementMode !== "REFERENCE_CLOTH_TEMPLATE" && !keys.length) ctx.addIssue({ code: "custom", path: ["measurements"], message: "Provide the required custom measurements." });
});
export const messageSchema = z.object({ content: z.string().trim().max(4000).refine(contactCheck, "Contact details are not allowed in messages."), uploadId: z.string().optional(), clientKey: z.uuid() }).strict().refine(v => !!v.content || !!v.uploadId, "Write a message or attach an image.");
export function hasExactMeasurements(measurements: Record<string, unknown>, required: string[]) {
  const keys = Object.keys(measurements).filter(key => key !== "unit").sort();
  return keys.length === required.length && keys.every((key, index) => key === [...required].sort()[index]);
}
