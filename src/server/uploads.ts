import { readFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "./db.ts";
import { AppError } from "./errors.ts";
import type { Actor } from "./auth.ts";
import { IMAGE_LIMIT_LABEL, MAX_IMAGE_BYTES } from "../lib/upload-limits.ts";
const root = () => resolve(process.env.UPLOAD_DIR || "./storage/uploads");
export async function boundedBody(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Request body is required.");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > max) { await reader.cancel(); throw new AppError("Request is too large.", 413); } chunks.push(value); }
  return Buffer.concat(chunks);
}
export function imageMime(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (b.length >= 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (b.length >= 3 && b[0]===255 && b[1]===216 && b[2]===255) return "image/jpeg";
  if (b.length>=12 && b.toString("ascii",0,4)==="RIFF" && b.toString("ascii",8,12)==="WEBP") return "image/webp";
  throw new AppError("Only JPEG, PNG, and WebP image files are supported.");
}
export async function saveUpload(request: Request, user: Actor) {
  const body = await boundedBody(request, MAX_IMAGE_BYTES + 65536);
  const form = await new Request(request.url, { method:"POST", headers:{"content-type":request.headers.get("content-type")||""}, body }).formData();
  const file=form.get("file"); if (!(file instanceof File) || !file.size || file.size>MAX_IMAGE_BYTES) throw new AppError(`Choose an image up to ${IMAGE_LIMIT_LABEL}.`);
  const bytes=Buffer.from(await file.arrayBuffer()); const mime=imageMime(bytes); if(file.type!==mime) throw new AppError("Image contents do not match the file type.");
  const upload=await db.upload.create({ data:{ ownerId:user.id,key:randomUUID(),mime,size:file.size,data:{create:{bytes}} }, select:{id:true} });
  return upload;
}
export async function readUpload(id: string, user: Actor|null) {
  const upload=await db.upload.findUnique({where:{id},include:{order:{select:{customerId:true,tailorId:true}},message:{include:{conversation:{select:{customerId:true,tailorId:true}}}}}});
  if(!upload) throw new AppError("Image not found.",404);
  const participant=!!user && ((upload.order && (upload.order.customerId===user.id || upload.order.tailorId===user.id)) || (upload.message && (upload.message.conversation.customerId===user.id || upload.message.conversation.tailorId===user.id)));
  const authorized=!!user && (user.role==="ADMIN" || upload.ownerId===user.id || (upload.approved && participant));
  if (!(upload.approved && upload.publicUse) && !authorized) throw new AppError("Image not available.", user ? 403 : 401);
  const stored=await db.uploadData.findUnique({where:{uploadId:id}});
  if(!stored && process.env.VERCEL) throw new AppError("This legacy image is only available on the original local server.",404);
  const bytes=stored?Buffer.from(stored.bytes):await readFile(join(root(),upload.key));
  return new Response(bytes,{headers:{"Content-Type":upload.mime,"X-Content-Type-Options":"nosniff","Cache-Control":upload.publicUse?"public, max-age=300":"private, no-store","Content-Disposition":"inline"}});
}
export async function deleteUpload(id:string,user:Actor){
  await db.$transaction(async tx=>{
    const upload=await tx.upload.findUnique({where:{id}});
    const message=await tx.message.findUnique({where:{uploadId:id},select:{id:true}});
    const profiles=await tx.tailorProfile.findMany({select:{portfolioUploadIds:true}});
    const profileAttached=profiles.some(p=>Array.isArray(p.portfolioUploadIds)&&(p.portfolioUploadIds as string[]).includes(id));
    const reviewed=await tx.moderationItem.findFirst({where:{OR:[{uploadId:id},{targetId:id}]},select:{id:true}});
    if(!upload||upload.ownerId!==user.id||upload.orderId||message||profileAttached||reviewed) throw new AppError("Only your unattached images can be removed.",403);
    const stored=await tx.uploadData.findUnique({where:{uploadId:id},select:{uploadId:true}});
    if(!stored&&process.env.VERCEL) throw new AppError("This legacy image must be removed on the original local server.",409);
    const deleted=await tx.upload.deleteMany({where:{id,ownerId:user.id,orderId:null}});
    if(deleted.count!==1) throw new AppError("The attachment changed. Refresh and retry.",409);
    if(!stored) await unlink(join(root(),upload.key));
  });
}
