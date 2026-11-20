import { describe, expect, it } from "vitest";
import { orderDTO } from "../src/server/orders.ts";
import { maskedAlias } from "../src/server/masked-code.ts";
const customer = { id: "customer-id-1234", role: "CUSTOMER" as const };
const tailor = { id: "tailor-id-1234", role: "TAILOR" as const };
const admin = { id: "admin-demo", role: "ADMIN" as const };
function record(): Parameters<typeof orderDTO>[0] {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "order-1", customerId: customer.id, tailorId: tailor.id, customer: { id: customer.id, maskedCode: "C-5A9D", name: "Private customer", email: "customer@example.test", phone: "1234567890" },
    tailor: { id: tailor.id, maskedCode: "T-5A9D", name: "Private tailor", email: "tailor@example.test", phone: "0987654321" }, conversationId: "conversation-1", garmentType: "Dress",
    measurementMode: "CUSTOM_MEASUREMENTS", measurements: { bust: 90, unit: "cm" }, requiredMeasurements: ["bust"], measurementStatus: "PENDING", hasReferenceCloth: false,
    designSpecifications: "Owner-only original", publishedDesignSpecifications: "", contentStatus: "PENDING", contentVersion: 1, referenceUploadIds: ["private-image"], basePrice: 10000,
    totalAmount: 11000, platformFeePercent: 10, platformFeeAmount: 1000, tailorPayout: 10000, currency: "INR", pickupPaid: false, deliveryPaid: false,
    approvalPaid: false, status: "PENDING_TIMELINE_APPROVAL", pickupAddress: { name: "Private customer", line1: "Private address", city: "Mumbai", postalCode: "400001", country: "India", phone: "1234567890" },
    deliveryAddress: { name: "Private customer", line1: "Private address", city: "Mumbai", postalCode: "400001", country: "India", phone: "1234567890" },
    tailorAddress: { name: "Private tailor", line1: "Private workshop", city: "Mumbai", postalCode: "400001", country: "India", phone: "0987654321" },
    agreedCompletionDays: 12, proposedCompletionDays: null, customerAgreedToTimeline: true, timelineConfirmed: false, checkoutKey: "checkout", version: 1,
    customerRating: null, customerReview: null, publishedReview: null, reviewStatus: null, createdAt: now, updatedAt: now, shipments: [{ id: "shipment-1", orderId: "order-1", leg: "FABRIC_PICKUP", cycle: 0, status: "UNASSIGNED", courier: "Private Courier", contact: "Private courier phone", tracking: "Private tracking", dispatchedAt: null, deliveredAt: null, updatedAt: now }],
    payments: [], alterations: [], conversation: null, uploads: [{ id: "private-image", approved: false }],
  };
}
describe("order DTO privacy projections", () => {
  it("keeps counterpart identity, addresses, logistics contacts, pending specs and images out of tailor responses", () => {
    const dto = orderDTO(record(), tailor);
    expect(dto.customerMaskedCode).toBe("Customer C-5A9D");
    expect(dto.tailorMaskedCode).toBe("Tailor T-5A9D");
    expect(dto.designSpecifications).toBe("");
    expect(dto.measurements).toEqual({});
    expect(dto.referenceImages).toEqual([]);
    expect(dto).not.toHaveProperty("customerIdentity");
    expect(dto).not.toHaveProperty("pickupAddress");
    expect(dto).not.toHaveProperty("deliveryAddress");
    expect(dto).not.toHaveProperty("tailorAddress");
    expect(dto.shipments[0]).not.toHaveProperty("contact");
    expect(dto.shipments[0]).not.toHaveProperty("courier");
    expect(dto.shipments[0]).not.toHaveProperty("tracking");
  });
  it("allows an author to read their own private address and original content while Admin can mediate", () => {
    const own = orderDTO(record(), customer);
    expect(own.designSpecifications).toBe("Owner-only original");
    expect(own).not.toHaveProperty("pickupAddress");
    expect(own).not.toHaveProperty("deliveryAddress");
    const oversight = orderDTO(record(), admin);
    expect(oversight.pickupAddress?.name).toBe("Private customer");
    expect(oversight.deliveryAddress?.name).toBe("Private customer");
    expect(oversight.customerIdentity?.email).toBe("customer@example.test");
    expect(oversight.tailorIdentity?.phone).toBe("0987654321");
    expect(oversight.shipments[0].contact).toBe("Private courier phone");
  });
  it("uses persisted aliases rather than colliding user-ID suffixes", () => {
    expect(maskedAlias("CUSTOMER", "C-5A9D")).toBe("Customer C-5A9D");
    expect(maskedAlias("TAILOR", "T-5A9D")).toBe("Tailor T-5A9D");
  });
  it("includes paid design extras in net payout but keeps pending feedback private to author and Admin", () => {
    const order = record();
    order.payments.push({ id: "design", orderId: order.id, installment: "DESIGN", cycle: 1, amount: 2500, status: "SUCCEEDED", idempotencyKey: "design-payment", eventId: null, approved: false, contentVersion: 1, createdAt: order.createdAt, updatedAt: order.updatedAt });
    order.customerRating = 4; order.reviewStatus = "PENDING";
    expect(orderDTO(order, customer)).toMatchObject({ tailorNetPayout: 12500, customerRating: 4 });
    expect(orderDTO(order, admin).customerRating).toBe(4);
    expect(orderDTO(order, tailor).customerRating).toBeNull();
  });
});
