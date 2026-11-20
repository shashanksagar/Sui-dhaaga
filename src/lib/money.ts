export function money(paise: number) {
  if (!Number.isSafeInteger(paise)) throw new Error("Amount must be an integer number of paise.");
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

export function splitPayment(total: number) {
  if (!Number.isSafeInteger(total) || total < 1 || total > 200_000_000) throw new Error("Invalid price.");
  const pickup = Math.ceil(total / 2);
  const delivery = Math.floor(total / 4);
  return { pickup, delivery, approval: total - pickup - delivery };
}

export function economics(basePrice: number, percent = 10) {
  if (!Number.isSafeInteger(basePrice) || basePrice < 1 || basePrice > 100_000_000 || !Number.isInteger(percent) || percent < 0 || percent > 100) throw new Error("Invalid price or fee.");
  const total = Math.round(basePrice * (100 + percent) / 100);
  const fee = total - basePrice;
  return { fee, net: basePrice, total, ...splitPayment(total) };
}
