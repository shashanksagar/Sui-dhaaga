export type Role = "CUSTOMER" | "TAILOR" | "ADMIN";
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type Address = { name: string; line1: string; city: string; postalCode: string; country: string; phone: string };
export type Garment = {
  garmentType: string; basePrice: number; platformCommission: number; commissionPercent: number;
  finalDisplayPrice: number; estimatedDays: number; requiredMeasurements: string[];
};
export type TailorCard = {
  id: string; maskedCode: string; city: string; expertise: string[]; bio: string;
  garmentCatalog: Garment[]; rating: number; portfolioImages: string[];
};
export type Identity = { name: string; email: string; phone: string };
export type ProfileDTO = TailorCard & {
  subscriptionStatus: "ACTIVE" | "PENDING" | "EXPIRED"; monthlyFeeAmount: number;
  nextBillingDate: string | null; approvalStatus: ReviewStatus; commissionPercent: number;
  workshopAddress: Address; portfolioUploadIds: string[]; identity?: Identity;
};
export const orderStatuses = [
  "PENDING_TIMELINE_APPROVAL", "PICKUP_SCHEDULED", "IN_TRANSIT_TO_TAILOR",
  "STITCHING", "READY_FOR_DELIVERY", "DELIVERED_PENDING_APPROVAL",
  "ALTERATION_REQUESTED", "ALTERATION_IN_TRANSIT", "COMPLETED",
] as const;
export type OrderStatus = typeof orderStatuses[number];
export type ShipmentDTO = {
  id: string; leg: string; cycle: number; status: string;
  courier?: string; contact?: string; tracking?: string;
};
export type AlterationDTO = {
  id: string; cycle: number; alterationType: "FITTING_FREE" | "DESIGN_PAID";
  notes: string; contentStatus: ReviewStatus; amount: number | null;
  quoteVersion: number; paid: boolean; completed: boolean;
};
export type OrderDTO = {
  id: string; customerMaskedCode: string; tailorMaskedCode: string; garmentType: string;
  designSpecifications: string; contentStatus: ReviewStatus; measurementMode: string;
  measurements: Record<string, number | string>; requiredMeasurements: string[];
  hasReferenceCloth: boolean; agreedCompletionDays: number; proposedCompletionDays: number | null;
  customerAgreedToTimeline: boolean; timelineConfirmed: boolean; version: number;
  totalAmount: number; commissionAmount: number; tailorNetPayout: number; currency: "INR";
  paid50Pickup: boolean; paid25Delivery: boolean; paid25Approval: boolean; status: OrderStatus;
  alterationType: string; alterationExtraCharge: number; customerRating: number | null;
  customerReview: string | null; reviewStatus: ReviewStatus | null;
  referenceImages: string[]; conversationId: string; createdAt: string; updatedAt: string;
  shipments: ShipmentDTO[]; alterations: AlterationDTO[];
  payments: { id: string; installment: string; amount: number; status: string }[];
  customerIdentity?: Identity; tailorIdentity?: Identity;
  pickupAddress?: Address; deliveryAddress?: Address; tailorAddress?: Address;
};
export type MessageDTO = {
  id: string; alias: string; mine: boolean; content: string; imageUrl: string | null;
  moderationStatus: ReviewStatus; createdAt: string;
};
export type ConversationDTO = {
  id: string; orderId: string | null; customerMaskedCode: string; tailorMaskedCode: string; createdAt: string;
};
export type ModerationDTO = {
  id: string; kind: string; targetId: string; authorAlias: string;
  originalText: string; imageUrl: string | null; createdAt: string;
};
export type Ledger = {
  gross: number; collected: number; unpaid: number; held: number;
  expectedFee: number; recognizedFee: number; payoutOwed: number;
  subscriptionCollected: number; designCollected: number;
};
export type AdminDTO = {
  orders: OrderDTO[]; profiles: ProfileDTO[]; moderation: ModerationDTO[];
  ledger: Ledger; commissionPercent: number;
};
