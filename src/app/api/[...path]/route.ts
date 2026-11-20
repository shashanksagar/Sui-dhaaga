import { hash } from "bcryptjs";
import { z } from "zod";
import { actor } from "@/server/auth";
import { db } from "@/server/db";
import { AppError, errorResponse, rateLimit, sameOrigin } from "@/server/errors";
import { signupSchema } from "@/lib/validation";
import { catalogue, ownProfile, subscribeTailor, updateProfile } from "@/server/catalogue";
import { adminState, updateCommission } from "@/server/admin";
import { moderationQueue, reviewModeration } from "@/server/moderation";
import { createOrder, getOrder, listOrders, transitionOrder } from "@/server/orders";
import { simulatePayment } from "@/server/payments";
import { boundedBody, deleteUpload, readUpload, saveUpload } from "@/server/uploads";
import { conversation, conversations, createConversation, messages, sendMessage } from "@/server/chat";
import { newMaskedCode } from "@/server/masked-code";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    if (path.length > 4) throw new AppError("Endpoint not found.", 404);
    const [resource, id, action] = path;
    const method = request.method;
    const readJSON = async () => JSON.parse((await boundedBody(request, 65536)).toString("utf8"));
    if (resource === "health" && method === "GET") { await db.$queryRaw`SELECT 1`; return Response.json({ status: "ok" }); }
    if (method !== "GET") sameOrigin(request);
    if (resource === "signup" && method === "POST") {
      rateLimit("signup", 20);
      const input = signupSchema.parse(await readJSON());
      const { password, ...userData } = input;
      const created = await db.$transaction(async tx => {
        const user = await tx.user.create({ data: { ...userData, maskedCode: newMaskedCode(), passwordHash: await hash(password, 12) } });
        if (input.role === "TAILOR") await tx.tailorProfile.create({ data: { userId: user.id, bio: "", publishedBio: "", expertise: [], garmentCatalog: [], workshopAddress: { name: "Workshop", line1: "", city: input.location, postalCode: "", country: "India", phone: "" }, approvalStatus: "PENDING", subscriptionStatus: "PENDING", monthlyFeeAmount: 49900 } });
        return { id: user.id };
      });
      return Response.json(created, { status: 201 });
    }
    if (resource === "tailors" && method === "GET" && path.length === 1) return Response.json(await catalogue());
    if (resource === "uploads" && id && method === "GET" && path.length === 2) {
      let user: Awaited<ReturnType<typeof actor>> | null = null;
      try { user = await actor(); } catch (error) { if (error instanceof AppError && error.status === 401) user = null; else throw error; }
      return await readUpload(id, user);
    }
    const user = await actor();
    if (method !== "GET") rateLimit(`mutation:${user.id}`, 60);
    if (resource === "profile") {
      if (!id && method === "GET") return Response.json(await ownProfile(user));
      if (!id && method === "PATCH") return Response.json(await updateProfile(await readJSON(), user));
    }
    if (resource === "subscription" && method === "POST" && !id) return Response.json(await subscribeTailor(await readJSON(), user));
    if (resource === "admin" && method === "GET" && !id) return Response.json(await adminState(user));
    if (resource === "settings" && method === "PATCH" && !id) return Response.json(await updateCommission(await readJSON(), user));
    if (resource === "moderation") {
      if (!id && method === "GET") return Response.json(await moderationQueue(user));
      if (id && method === "PATCH") return Response.json(await reviewModeration(id, await readJSON(), user));
    }
    if (resource === "uploads") {
      if (!id && method === "POST") { const file = await saveUpload(request, user); return Response.json({ id: file.id, url: `/api/uploads/${file.id}` }, { status: 201 }); }
      if (id && method === "DELETE") { await deleteUpload(id, user); return Response.json({ ok: true }); }
    }
    if (resource === "orders") {
      if (!id && method === "GET") return Response.json(await listOrders(user));
      if (!id && method === "POST") return Response.json(await createOrder(await readJSON(), user), { status: 201 });
      if (id && !action && method === "GET") return Response.json(await getOrder(id, user));
      if (id && !action && method === "PATCH") return Response.json(await transitionOrder(id, await readJSON(), user));
      if (id && action === "payments" && method === "POST") return Response.json(await simulatePayment(id, await readJSON(), user));
    }
    if (resource === "conversations") {
      if (!id && method === "GET") return Response.json(await conversations(user));
      if (!id && method === "POST") { const body = z.object({ tailorId: z.string().min(1) }).strict().parse(await readJSON()); return Response.json(await createConversation(body.tailorId, user), { status: 201 }); }
      if (id && !action && method === "GET") return Response.json(await conversation(id, user));
      if (id && action === "messages" && method === "GET") return Response.json(await messages(id, user));
      if (id && action === "messages" && method === "POST") return Response.json(await sendMessage(id, await readJSON(), user), { status: 201 });
    }
    throw new AppError("Endpoint not found.", 404);
  } catch (error) { return errorResponse(error); }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
