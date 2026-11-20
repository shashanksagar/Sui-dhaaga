import { randomUUID } from "node:crypto";
export const customer = { id: "customer-demo", role: "CUSTOMER" as const };
export const tailor = { id: "tailor-amara", role: "TAILOR" as const };
export const admin = { id: "admin-demo", role: "ADMIN" as const };
export const stranger = { id: "unrelated-user", role: "CUSTOMER" as const };
export const address = { name: "Demo Customer", line1: "18 Test Street", city: "Mumbai", postalCode: "400001", country: "India", phone: "0000000000" };
export function orderInput() {
  return { tailorId: tailor.id, garmentType: "Dress", quotedAmount: 132000, measurementMode: "CUSTOM_MEASUREMENTS" as const,
    measurements: { bust: 92, waist: 74, hip: 98, shoulder: 38, length: 110, unit: "cm" as const }, hasReferenceCloth: false,
    designSpecifications: "A simple rounded neckline with short sleeves.", pickupAddress: address, deliveryAddress: address,
    uploadIds: [], customerAgreedToTimeline: true as const, agreedCompletionDays: 12, checkoutKey: randomUUID() };
}
export const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
