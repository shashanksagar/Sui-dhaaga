import { describe, expect, it } from "vitest";
import { economics, money, splitPayment } from "../src/lib/money.ts";
import { addCalendarMonthClamped } from "../src/server/catalogue.ts";
import { ledger } from "../src/server/orders.ts";
describe("paise and exact installments", () => {
  it("adds the Admin commission to base paise and allocates the exact total", () => {
    expect(economics(120000, 10)).toEqual({ fee: 12000, net: 120000, total: 132000, pickup: 66000, delivery: 33000, approval: 33000 });
    expect(money(1050)).toContain("10.50");
  });
  it("clamps monthly renewal to the target calendar month", () => {
    expect(addCalendarMonthClamped(new Date("2025-01-31T12:00:00.000Z")).toISOString()).toBe("2025-02-28T12:00:00.000Z");
  });
  it("uses ceil half, floor quarter, and remainder for odd paise", () => {
    const parts = splitPayment(10001);
    expect(parts).toEqual({ pickup: 5001, delivery: 2500, approval: 2500 });
    expect(parts.pickup + parts.delivery + parts.approval).toBe(10001);
    expect(() => economics(1.5)).toThrow();
  });
  it("holds paid design extras until completion and includes them in payout exactly once", () => {
    const order = {
      totalAmount: 11000, commissionAmount: 1000, tailorNetPayout: 12500,
      status: "DELIVERED_PENDING_APPROVAL" as const,
      payments: [
        { id: "pickup", installment: "PICKUP", amount: 5500, status: "SUCCEEDED" },
        { id: "delivery", installment: "DELIVERY", amount: 2750, status: "SUCCEEDED" },
        { id: "design", installment: "DESIGN", amount: 2500, status: "SUCCEEDED" },
        { id: "failed", installment: "APPROVAL", amount: 2750, status: "FAILED" },
      ],
    };
    expect(ledger([order])).toMatchObject({ gross: 13500, collected: 10750, held: 10750, unpaid: 2750, payoutOwed: 0, recognizedFee: 0, designCollected: 2500 });
    const complete = { ...order, status: "COMPLETED" as const, payments: [...order.payments, { id: "approval", installment: "APPROVAL", amount: 2750, status: "SUCCEEDED" }] };
    expect(ledger([complete])).toMatchObject({ collected: 13500, held: 0, unpaid: 0, payoutOwed: 12500, recognizedFee: 1000 });
  });
});
