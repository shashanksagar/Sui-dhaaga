import { randomBytes } from "node:crypto";

export function newMaskedCode() {
  return randomBytes(10).toString("hex").toUpperCase();
}

export function maskedAlias(role: "CUSTOMER" | "TAILOR" | "ADMIN", maskedCode: string) {
  return role === "ADMIN" ? "Sui-dhaaga Admin" : `${role === "TAILOR" ? "Tailor" : "Customer"} ${maskedCode}`;
}
