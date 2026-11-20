import { notFound } from "next/navigation";
import Link from "next/link";
import { pageUser } from "@/server/auth";
import { conversation, messages } from "@/server/chat";
import { AppError } from "@/server/errors";
import { Chat } from "@/components/chat";
export default async function InquiryPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const user = await pageUser(), { conversationId } = await params;
  try {
    const room = await conversation(conversationId, user);
    return <div className="container"><div className="narrow" style={{ maxWidth: 850 }}><h2>Discuss the design, not the identity.</h2><p>{room.customerMaskedCode} / {room.tailorMaskedCode}</p><Link className="btn outline" href={room.orderId ? `/orders/${room.orderId}` : "/orders"}>Back to workspace</Link><Chat conversationId={room.id} initial={await messages(room.id, user)} /></div></div>;
  } catch (error) { if (error instanceof AppError && [403, 404].includes(error.status)) notFound(); throw error; }
}
