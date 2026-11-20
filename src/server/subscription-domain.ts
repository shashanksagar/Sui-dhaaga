export function addCalendarMonthClamped(from: Date) {
  const result = new Date(from);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function renewalDate(currentExpiry: Date | null, now: Date) {
  return addCalendarMonthClamped(currentExpiry && currentExpiry > now ? currentExpiry : now);
}

export function approvedSubscriptionStatus(
  subscriptionPaid: boolean,
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED",
  nextBillingDate: Date | null,
  now: Date,
) {
  if (nextBillingDate && nextBillingDate <= now) return "EXPIRED" as const;
  if (!subscriptionPaid || approvalStatus !== "APPROVED" || !nextBillingDate) return "PENDING" as const;
  return "ACTIVE" as const;
}
