import Link from "next/link";
import { redirect } from "next/navigation";
import { pageUser } from "@/server/auth";
import { listOrders } from "@/server/orders";
import { money } from "@/lib/money";
import { conversations } from "@/server/chat";
export default async function Orders() {
  const user = await pageUser();
  if (user.role === "ADMIN") redirect("/dashboard/admin");
  if (user.role === "TAILOR") redirect("/dashboard/tailor");
  const orders = await listOrders(user);
  const inquiries = (await conversations(user)).filter(c => c.orderId === null);
  return <div className="container"><div className="section-head"><div><div className="eyebrow">Your personal collection</div><h2>Good things take shape.</h2><p className="muted">Follow every stitch and every step of the journey.</p></div><Link href="/explore" className="btn rust">Start something new</Link></div>
    {orders.length ? <div className="grid">{orders.map(o => <article className="panel" key={o.id}><span className="badge">{o.status.replaceAll("_", " ")}</span><h3 style={{ marginTop: 20 }}>{o.garmentType}</h3><p className="muted">With {o.tailorMaskedCode}</p><p className="price">{money(o.totalAmount)}</p><Link className="btn outline" href={`/orders/${o.id}`}>Follow your order &rarr;</Link></article>)}</div> : <div className="panel"><h3>Your next favorite piece starts here.</h3><p className="muted">No orders yet. Find your masked atelier and perfect fit.</p><Link className="btn" href="/explore">Explore tailors</Link></div>}
    <h3>Pre-order design inquiries</h3>{inquiries.length ? inquiries.map(c => <p key={c.id}><Link className="btn outline" href={`/inquiries/${c.id}`}>Masked inquiry with {c.tailorMaskedCode}</Link></p>) : <p className="muted">Use &quot;Ask a masked design question&quot; in Explore before placing an order.</p>}
  </div>;
}
