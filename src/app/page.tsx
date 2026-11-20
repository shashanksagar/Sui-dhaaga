import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Truck, Scissors, Sparkles, Check, Globe2 } from "lucide-react";
import { Marketplace } from "@/components/marketplace";
import { catalogue } from "@/server/catalogue";
export const dynamic = "force-dynamic";
export default async function Home() {
  const tailors = await catalogue();
  return <div className="container">
    <section className="hero"><div><div className="eyebrow"><span style={{ width: 24, height: 1, background: "currentColor" }} /> Sui-dhaaga / A thread of your story</div><h1>Not off the rack.<br />Made <em style={{ color: "var(--rust)" }}>for you.</em></h1><p className="muted">Compare skilled tailors across India without sharing personal identity. Your fabric, your inspiration, your perfect fit. We take care of the doorstep journey.</p><div className="actions"><Link className="btn rust" href="/explore">Explore the tailors <ArrowUpRight size={16} /></Link><Link className="btn outline" href="#how-it-works">How it works</Link></div><div className="trust-row"><span><ShieldCheck size={14} /> 50% pickup / 25% delivery / 25% approval</span><span><Truck size={15} /> Fabric + reference garment pickup</span></div><p style={{ fontSize: 10, color: "var(--muted)", marginTop: 24, letterSpacing: 1 }}>CRAFTED WITH CARE. CONNECTED WITH PRIVACY.</p></div>
      <div className="hero-visual"><img src="/images/atelier-hero.svg" alt="Original illustration of a sculptural terracotta dress and an artisan's tailoring workspace" /><div className="hero-tag"><div className="process-icon" style={{ margin: 0 }}><Scissors size={19} /></div><div><strong>Crafted by hands, not assembly lines.</strong><span>Independent makers. Personal connections.</span></div></div></div></section>
    <Marketplace tailors={tailors} compact />
    <div className="banner"><div><h3 style={{ marginBottom: 7 }}>Your perfect fit is out there.</h3><span className="muted" style={{ fontSize: 12 }}>Compare inclusive INR prices, expertise and timelines. Fitting corrections are free.</span></div><Link className="btn outline" href="/explore">Discover active ateliers <ArrowUpRight size={14} /></Link></div>
    <section className="steps-section" id="how-it-works"><div className="section-head"><div><div className="eyebrow">From your doorstep, and back again</div><h2>A little inspiration. We handle the rest.</h2></div></div><div className="process">
      {[{ Icon: Globe2, title: "01 / Find your maker", text: "Compare up to three approved, subscribed ateliers by expertise, city, inclusive price and rating. Ask a masked design question." }, { Icon: Scissors, title: "02 / Make it personal", text: "Choose exact measurements or a reference garment. Agree to the duration. Admin schedules fabric pickup and records the first 50%." }, { Icon: Sparkles, title: "03 / Wear your story", text: "Track stitching and doorstep delivery. Pay 25% on delivery, then approve the fit for the last 25%. Request free fitting adjustments or a paid design change." }].map(({ Icon, title, text }) => <div key={title}><div className="process-icon"><Icon size={20} /></div><h3>{title}</h3><p className="muted">{text}</p></div>)}
    </div><p className="meta"><Check size={13} /> Added commission is included in displayed INR prices. Demo payments and logistics only.</p></section>
  </div>;
}
