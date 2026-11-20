import { pageUser } from "@/server/auth";
import { listOrders } from "@/server/orders";
import { ownProfile } from "@/server/catalogue";
import { conversations } from "@/server/chat";
import Link from "next/link";
import { TailorDashboard } from "@/components/dashboards";
export default async function TailorPage() {
  const user = await pageUser("TAILOR");
  const [profile, orders, inquiries] = await Promise.all([ownProfile(user), listOrders(user), conversations(user)]);
  return <div className="container"><div className="eyebrow">Your atelier, connected</div><h2>A good day to create.</h2><p className="muted">{profile.maskedCode} / every commission is someone&apos;s next favorite piece.</p><TailorDashboard profile={profile} orders={orders} /><h3>Masked design inquiries</h3>{inquiries.filter(c => c.orderId === null).map(c => <p key={c.id}><Link className="btn outline" href={`/inquiries/${c.id}`}>Inquiry from {c.customerMaskedCode}</Link></p>)}</div>;
}
