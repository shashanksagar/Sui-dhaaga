import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/server/auth";
import { getOrder } from "@/server/orders";
import { messages } from "@/server/chat";
import { AppError } from "@/server/errors";
import { Chat } from "@/components/chat";
export default async function ChatPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await pageUser(), { orderId } = await params;
  try {
    const order = await getOrder(orderId, user);
    return <div className="container"><div className="narrow" style={{ maxWidth: 850 }}><div className="section-head"><div><h2>Your masked design room.</h2><p>{order.customerMaskedCode} / {order.tailorMaskedCode}</p></div><Link className="btn outline" href={`/orders/${orderId}`}>Back to order</Link></div><Chat conversationId={order.conversationId} initial={await messages(order.conversationId, user)} /></div></div>;
  } catch (error) { if (error instanceof AppError && [403, 404].includes(error.status)) notFound(); throw error; }
}
