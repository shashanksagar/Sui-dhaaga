import { describe, expect, it } from "vitest";
import { orderInput } from "./fixtures.ts";
import { orderSchema, hasExactMeasurements, measurementsSchema, signupSchema } from "../src/lib/validation.ts";
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
});
