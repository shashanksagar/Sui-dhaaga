import type { Actor } from "./auth.ts";
import { AppError } from "./errors.ts";
import { contactError } from "../lib/privacy.ts";

export function assertAlterationRequest(actor: Actor, customerId: string) {
  if (actor.role !== "CUSTOMER") throw new AppError("This action is not available for your role.", 403);
  if (actor.id !== customerId) throw new AppError("This is not your order.", 403);
}

export function assertAlterationQuote(actor: Actor, tailorId: string) {
  if (actor.role === "ADMIN") return;
  if (actor.role !== "TAILOR") throw new AppError("This action is not available for your role.", 403);
  if (actor.id !== tailorId) throw new AppError("This is not your order.", 403);
}

export function validateAlterationNotes(notes: string) {
  if (contactError(notes)) throw new AppError("Contact details are not allowed in alteration requests.");
}
