import { contactCheck } from "./validation.ts";
export function contactError(text: string): string | null {
  return contactCheck(text) ? null : "Please remove phone numbers, email addresses, and social handles from this public text.";
}
