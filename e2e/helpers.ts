import { expect, type BrowserContext } from "@playwright/test";
import type { ModerationDTO, OrderDTO, TailorCard } from "../src/lib/contracts";
export const origin = "http://127.0.0.1:3100";
export async function login(context: BrowserContext, email: string) {
  const csrf = await (await context.request.get("/api/auth/csrf")).json();
  await context.request.post("/api/auth/callback/credentials", { form: { csrfToken: csrf.csrfToken, email, password: process.env.DEMO_PASSWORD!, callbackUrl: `${origin}/orders`, json: "true" } });
  const session = await (await context.request.get("/api/auth/session")).json();
  expect(session.user?.email).toBe(email);
}
export async function mutate(context: BrowserContext, path: string, data: unknown, method: "POST" | "PATCH" = "POST") {
  return context.request.fetch(path, { method, data, headers: { Origin: origin } });
}
export const address = { name: "Browser Customer", line1: "18 Demo Lane", city: "Jaipur", postalCode: "302001", country: "India", phone: "+91 9000012345" };
export const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
export async function createOrder(context: BrowserContext) {
  const tailors: TailorCard[] = await (await context.request.get("/api/tailors")).json();
  const tailor = tailors.find(t => t.id === "tailor-amara")!;
  expect(tailor).toBeDefined();
  const garment = tailor.garmentCatalog[0];
  const response = await mutate(context, "/api/orders", { tailorId: tailor.id, garmentType: garment.garmentType,
    designSpecifications: "A rounded collar with simple finishing.", measurementMode: "CUSTOM_MEASUREMENTS",
    measurements: { ...Object.fromEntries(garment.requiredMeasurements.map(key => [key, 90])), unit: "cm" },
    hasReferenceCloth: false, pickupAddress: address, deliveryAddress: address, uploadIds: [],
    customerAgreedToTimeline: true, agreedCompletionDays: garment.estimatedDays,
    checkoutKey: crypto.randomUUID(), quotedAmount: garment.finalDisplayPrice,
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).id as string;
}
export async function readOrder(context: BrowserContext, id: string): Promise<OrderDTO> {
  const response = await context.request.get(`/api/orders/${id}`);
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
export async function act(context: BrowserContext, id: string, data: Record<string, unknown>, payment = false): Promise<OrderDTO> {
  const order = await readOrder(context, id);
  const response = await mutate(context, `/api/orders/${id}${payment ? "/payments" : ""}`, { ...data, version: order.version }, payment ? "POST" : "PATCH");
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
export async function approvePending(admin: BrowserContext, targetId?: string) {
  const response = await admin.request.get("/api/moderation");
  expect(response.ok()).toBe(true);
  const items: ModerationDTO[] = await response.json();
  for (const item of items.filter(item => !targetId || item.targetId === targetId)) {
    const reviewed = await mutate(admin, `/api/moderation/${item.id}`, { status: "APPROVED", publishedText: item.originalText }, "PATCH");
    expect(reviewed.ok(), await reviewed.text()).toBe(true);
  }
}
export const courier = { courier: "Demo Courier", contact: "+91 9000099999", tracking: "DEMO-CONSIGNMENT" };
