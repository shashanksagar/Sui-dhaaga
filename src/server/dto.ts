import type { ProfileDTO, Identity, Address } from "../lib/contracts.ts";
import type { TailorProfile, User } from "@prisma/client";
import { approvedSubscriptionStatus } from "./subscription-domain.ts";
export const asList = (value: unknown) => Array.isArray(value) ? value : [];
export const asAddress = (value: unknown) => value && typeof value === "object" ? value as Address : { name: "", line1: "", city: "", postalCode: "", country: "India", phone: "" };
export const identityDTO = (user: Pick<User,"name"|"email"|"phone">): Identity => ({ name: user.name, email: user.email, phone: user.phone });
export function profileDTO(profile: TailorProfile, user: Pick<User, "id"|"maskedCode"|"name"|"email"|"phone"|"location">, percent: number, rating: number, own = false): ProfileDTO {
  const catalog = asList(own ? profile.garmentCatalog : profile.publishedGarmentCatalog) as Array<{garmentType:string;basePrice:number;estimatedDays:number;requiredMeasurements:string[]}>;
  const bio = own ? profile.bio : profile.publishedBio;
  const expertise = asList(own ? profile.expertise : profile.publishedExpertise) as string[];
  const uploadIds = asList(own ? profile.portfolioUploadIds : profile.publishedPortfolioUploadIds) as string[];
  const subscriptionStatus = approvedSubscriptionStatus(profile.subscriptionPaid, profile.approvalStatus, profile.nextBillingDate, new Date());
  return {
    id: user.id, maskedCode: `Tailor ${user.maskedCode}`, city: user.location,
    expertise, bio, garmentCatalog: catalog.map(item => ({ ...item, platformCommission: Math.round(item.basePrice * percent / 100), commissionPercent: percent, finalDisplayPrice: item.basePrice + Math.round(item.basePrice * percent / 100) })),
    rating, portfolioImages: uploadIds.map(id => `/api/uploads/${id}`), subscriptionStatus,
    monthlyFeeAmount: profile.monthlyFeeAmount, nextBillingDate: profile.nextBillingDate?.toISOString() ?? null, approvalStatus: profile.approvalStatus, commissionPercent: percent,
    workshopAddress: asAddress(own ? profile.workshopAddress : profile.publishedWorkshopAddress), portfolioUploadIds: uploadIds,
    ...(own ? { identity: identityDTO(user) } : {}),
  };
}
