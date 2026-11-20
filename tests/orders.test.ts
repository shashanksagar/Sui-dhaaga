import { describe, expect, it } from "vitest";
import { orderInput } from "./fixtures.ts";
import { orderSchema, hasExactMeasurements, measurementsSchema, signupSchema } from "../src/lib/validation.ts";
import { db } from "../src/server/db.ts";
import { transitionOrder } from "../src/server/orders.ts";
describe("order and registration validation", () => {
  it("accepts only current safe-order DTO shape and validates dynamic measurement subsets", () => {
    const input = orderSchema.parse(orderInput());
    expect(hasExactMeasurements(input.measurements, ["bust", "waist", "hip", "shoulder", "length"])).toBe(true);
    expect(orderSchema.parse({ ...orderInput(), measurementMode: "REFERENCE_CLOTH_TEMPLATE", hasReferenceCloth: true, measurements: { unit: "cm" } }).measurements).toEqual({ unit: "cm" });
    expect(hasExactMeasurements({ ...input.measurements, sleeve: 24 }, ["bust", "waist", "hip", "shoulder", "length"])).toBe(false);
    expect(() => measurementsSchema.parse({ bust: 92, waist: 74, unit: "cm", phone: "0000000000" })).toThrow();
  });
  it("never permits an Admin public signup or accepts an unapproved timeline claim", () => {
    expect(() => signupSchema.parse({ name: "A Customer", email: "customer@sui.local", password: "a-valid-password", role: "ADMIN", location: "Mumbai", phone: "0000000000" })).toThrow();
    expect(() => orderSchema.parse({ ...orderInput(), customerAgreedToTimeline: false })).toThrow();
  });
  it("marks fitting corrections zero-cost while design corrections await a quote", async () => {
    const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema");
    if (!schema || !/^stitch_test_[a-f0-9]{20}$/.test(schema)) throw new Error("This integration test requires an isolated test schema.");
    try {
      for (const [index, alterationType] of ["FITTING_FREE", "DESIGN_PAID"].entries()) {
        const order = await db.order.update({ where: { id: `order-demo-${index + 1}` }, data: { status: "DELIVERED_PENDING_APPROVAL", pickupPaid: true, deliveryPaid: true } });
        const result = await transitionOrder(order.id, { version: order.version, kind: "alteration", alterationType, notes: "Please adjust the sleeve finishing." }, { id: "customer-demo", role: "CUSTOMER" });
        expect(result.status).toBe("ALTERATION_REQUESTED");
        expect(result.alterations.at(-1)?.amount).toBe(alterationType === "FITTING_FREE" ? 0 : null);
        expect(result.alterationExtraCharge).toBe(0);
        expect(result.totalAmount).toBe(order.totalAmount);
        expect(result.paid25Approval).toBe(false);
        expect(result.payments).toHaveLength(0);
      }
    } finally { await db.$disconnect(); }
  }, 30000);
});
