import { describe, expect, it } from "vitest";
import { assertImageReplacementKind, publishedModerationText, resolvePortfolioIds } from "../src/server/moderation-publication.ts";
import { assertAlterationQuote, assertAlterationRequest, validateAlterationNotes } from "../src/server/order-guards.ts";
import { approvedSubscriptionStatus, renewalDate } from "../src/server/subscription-domain.ts";
import { admin, customer, tailor, stranger } from "./fixtures.ts";

describe("backend integration regressions", () => {
  it("filters actual profile and order publication fields, not private structured metadata", () => {
    const profile = JSON.stringify({ bio: "Call +91 98765 43210", workshopAddress: { phone: "+91 98765 43210" } });
    expect(() => publishedModerationText("PROFILE", profile, profile, null)).toThrow(/contact/i);
    const safeProfile = JSON.stringify({ bio: "Hand-finished garments with careful fitting.", workshopAddress: { phone: "+91 98765 43210" } });
    expect(publishedModerationText("PROFILE", safeProfile, safeProfile, null)).toBe("Hand-finished garments with careful fitting.");

    const order = JSON.stringify({ designSpecifications: "A simple neckline", measurements: { bust: 9876543210, unit: "cm" } });
    expect(publishedModerationText("ORDER_SPECIFICATION", order, order, null)).toBe("A simple neckline");
    const unsafeOrder = JSON.stringify({ designSpecifications: "Message me at atelier@example.com", measurements: { bust: 90, unit: "cm" } });
    expect(() => publishedModerationText("ORDER_SPECIFICATION", unsafeOrder, unsafeOrder, null)).toThrow(/contact/i);
  });

  it("never falls back from an empty redaction to original message text", () => {
    expect(publishedModerationText("MESSAGE", "remove identifying details", "", "upload-1")).toBe("");
    expect(() => publishedModerationText("MESSAGE", "original message", "", null)).toThrow(/empty/i);
    expect(() => publishedModerationText("REVIEW", "original review", "", null)).toThrow(/empty/i);
    expect(() => publishedModerationText("PROFILE", "original profile", "", null)).toThrow(/empty/i);
    expect(() => assertImageReplacementKind("PROFILE", "admin-upload")).toThrow(/image reviews/i);
    expect(() => assertImageReplacementKind("IMAGE", "admin-upload")).not.toThrow();
  });

  it("limits alteration requests to the customer, quotes to Admin or the owning tailor, and filters notes", () => {
    expect(() => assertAlterationRequest(tailor, customer.id)).toThrow(/role/i);
    expect(() => assertAlterationRequest(stranger, customer.id)).toThrow(/order/i);
    expect(() => assertAlterationRequest(customer, customer.id)).not.toThrow();
    expect(() => assertAlterationQuote(admin, tailor.id)).not.toThrow();
    expect(() => assertAlterationQuote(tailor, tailor.id)).not.toThrow();
    expect(() => assertAlterationQuote(stranger, tailor.id)).toThrow(/role/i);
    expect(() => validateAlterationNotes("Call +91 98765 43210 for the fitting")).toThrow(/contact/i);
  });

  it("retains paid expiry while approval is pending and never grants free time on expired approval", () => {
    const now = new Date("2026-01-31T12:00:00.000Z");
    const future = new Date("2026-02-28T12:00:00.000Z");
    const extended = renewalDate(future, now);
    expect(extended.toISOString()).toBe("2026-03-28T12:00:00.000Z");
    expect(approvedSubscriptionStatus(true, "PENDING", extended, now)).toBe("PENDING");
    expect(approvedSubscriptionStatus(true, "APPROVED", extended, now)).toBe("ACTIVE");
    expect(approvedSubscriptionStatus(true, "APPROVED", new Date("2026-01-01T00:00:00.000Z"), now)).toBe("EXPIRED");
    expect(approvedSubscriptionStatus(true, "APPROVED", null, now)).toBe("PENDING");
  });

  it("publishes portfolio images whichever review completes first and resolves approved replacements", () => {
    expect(resolvePortfolioIds(["new-image"], new Set(), new Map())).toEqual([]);
    expect(resolvePortfolioIds(["new-image"], new Set(["new-image"]), new Map())).toEqual(["new-image"]);
    expect(resolvePortfolioIds(["new-image"], new Set(["replacement"]), new Map([["new-image", "replacement"]]))).toEqual(["replacement"]);
  });
});
