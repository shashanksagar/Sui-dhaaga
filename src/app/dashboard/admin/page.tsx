import { pageUser } from "@/server/auth";
import { adminState } from "@/server/admin";
import { conversations } from "@/server/chat";
import Link from "next/link";
import { AdminDashboard } from "@/components/dashboards";
export default async function AdminPage() {
  const user = await pageUser("ADMIN");
  const [state, rooms] = await Promise.all([adminState(user), conversations(user)]);
  return <div className="container"><div className="eyebrow">Central operations hub</div><h2>Keep every thread connected.</h2><p className="muted">Private identity mediation, review, doorstep logistics and transparent accounting.</p><AdminDashboard state={state} /><h3>Monitor masked design rooms</h3>{rooms.map(c => <p key={c.id}><Link className="btn outline" href={`/inquiries/${c.id}`}>{c.customerMaskedCode} / {c.tailorMaskedCode}</Link></p>)}</div>;
}
