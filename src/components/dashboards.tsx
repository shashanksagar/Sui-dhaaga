"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminDTO, Garment, ModerationDTO, OrderDTO, ProfileDTO } from "@/lib/contracts";
import { api, errorText } from "@/lib/client";
import { money, economics } from "@/lib/money";
import { contactError } from "@/lib/privacy";
import { cities, expertiseTags, garmentTypes, measurementFields } from "@/lib/validation";
import { AddressFields, PhotoPicker, type Photo, MaskedBadge } from "./fields";
import { PrivateAddress } from "./order-view";

type CatalogInput = Pick<Garment, "garmentType" | "basePrice" | "estimatedDays" | "requiredMeasurements">;
function ProfileEditor({ profile }: { profile: ProfileDTO }) {
  const [city, setCity] = useState(profile.city), [expertise, setExpertise] = useState(profile.expertise), [bio, setBio] = useState(profile.bio);
  const [address, setAddress] = useState(profile.workshopAddress), [photos, setPhotos] = useState<Photo[]>(profile.portfolioUploadIds.map(id => ({ id, url: `/api/uploads/${id}` })));
  const [catalog, setCatalog] = useState<CatalogInput[]>(profile.garmentCatalog.length ? profile.garmentCatalog : [{ garmentType: garmentTypes[0], basePrice: 150000, estimatedDays: 10, requiredMeasurements: ["chest", "waist", "length"] }]);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [uploadBusy, setUploadBusy] = useState(false);
  const router = useRouter();
  function edit(index: number, patch: Partial<CatalogInput>) { setCatalog(catalog.map((g, i) => i === index ? { ...g, ...patch } : g)); }
  return <form className="panel" onSubmit={async e => {
    e.preventDefault(); setError(""); setNotice(""); setBusy(true);
    try {
      const blocked = contactError(bio); if (blocked) throw new Error(blocked);
      await api<ProfileDTO>("/api/profile", "PATCH", { city, expertise, bio, garmentCatalog: catalog, portfolioUploadIds: photos.map(p => p.id), workshopAddress: address });
      setNotice("Saved for Admin review. New profile content is withheld from search until approved."); router.refresh();
    } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }}><h3>Atelier profile and garment builder</h3><MaskedBadge code={profile.maskedCode} /><p className="notice">Your identity and workshop address are private. Only approved anonymous profile text, expertise, city and prices are shown to customers.</p><label className="field">City<select value={city} onChange={e => setCity(e.target.value)}>{cities.map(c => <option key={c}>{c}</option>)}</select></label><fieldset><legend>Specialized expertise</legend><div className="actions">{expertiseTags.map(tag => <label key={tag}><input type="checkbox" checked={expertise.includes(tag)} onChange={e => setExpertise(e.target.checked ? [...expertise, tag] : expertise.filter(t => t !== tag))} /> {tag}</label>)}</div></fieldset><label className="field">Anonymous craftsmanship bio<textarea required maxLength={2000} value={bio} onChange={e => setBio(e.target.value)} /></label><PhotoPicker value={photos} onChange={setPhotos} onBusy={setUploadBusy} label="Portfolio photos" /><AddressFields title="Private workshop logistics details" value={address} onChange={setAddress} />
    <h3>Exact garment prices and measurements</h3><p className="muted">Admin sets commission ({profile.commissionPercent}%). Select the exact measurements customers must provide for each garment. Existing orders keep their accepted quote.</p>{catalog.map((g, i) => {
      const price = Number.isSafeInteger(g.basePrice) && g.basePrice > 0 && g.basePrice <= 100_000_000 ? economics(g.basePrice, profile.commissionPercent) : null;
      return <fieldset className="panel" key={i}><legend>Garment {i + 1}</legend><div className="form-grid"><label className="field">Garment<select value={g.garmentType} onChange={e => edit(i, { garmentType: e.target.value })}>{garmentTypes.map(type => <option key={type}>{type}</option>)}</select></label><label className="field">Tailor price (INR)<input type="number" min="1" max="1000000" step=".01" required value={g.basePrice / 100} onChange={e => edit(i, { basePrice: Math.round(Number(e.target.value) * 100) })} /></label><label className="field">Production duration (days)<input type="number" min="1" max="365" required value={g.estimatedDays} onChange={e => edit(i, { estimatedDays: Number(e.target.value) })} /></label></div>{price ? <p>Customer inclusive price: <strong>{money(price.total)}</strong> / added commission {money(price.fee)}</p> : <p className="notice error">Enter a valid positive price for the preview.</p>}<div className="actions">{measurementFields.map(key => <label key={key}><input type="checkbox" checked={g.requiredMeasurements.includes(key)} onChange={e => edit(i, { requiredMeasurements: e.target.checked ? [...g.requiredMeasurements, key] : g.requiredMeasurements.filter(k => k !== key) })} /> {key}</label>)}</div><button type="button" className="btn small outline" disabled={catalog.length === 1} onClick={() => setCatalog(catalog.filter((_, n) => n !== i))}>Remove garment</button></fieldset>;
    })}<button type="button" className="btn outline" disabled={catalog.length >= garmentTypes.length} onClick={() => { const next = garmentTypes.find(type => !catalog.some(g => g.garmentType === type)); if (next) setCatalog([...catalog, { garmentType: next, basePrice: 150000, estimatedDays: 10, requiredMeasurements: ["chest", "waist", "length"] }]); }}>Add garment</button><button className="btn rust" disabled={busy || uploadBusy || !!contactError(bio)} style={{ marginLeft: 12 }}>{busy ? "Saving..." : "Save profile for review"}</button>{notice && <p role="status" className="notice">{notice}</p>}{error && <p role="alert" className="notice error">{error}</p>}</form>;
}
export function TailorDashboard({ orders, profile }: { orders: OrderDTO[]; profile: ProfileDTO }) {
  const router = useRouter(), retryKey = useRef<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  async function orderAction(order: OrderDTO, data: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { await api(`/api/orders/${order.id}`, "PATCH", { ...data, version: order.version }); router.refresh(); }
    catch (error) { setError(errorText(error)); router.refresh(); } finally { setBusy(false); }
  }
  return <><section className="panel"><h3>Monthly platform subscription</h3><MaskedBadge code={profile.maskedCode} /><p>Subscription: <strong>{profile.subscriptionStatus}</strong> / profile: <strong>{profile.approvalStatus}</strong></p><p>Monthly fee {money(profile.monthlyFeeAmount)}. Valid until {profile.nextBillingDate ? new Date(profile.nextBillingDate).toLocaleDateString() : "not activated"}.</p><p className="muted">Both an approved profile and an unexpired active subscription are required for new orders/search. Existing orders can always continue.</p><button className="btn rust" disabled={busy} onClick={async () => {
      setBusy(true); setError(""); retryKey.current ??= crypto.randomUUID();
      try { await api("/api/subscription", "POST", { outcome: "success", idempotencyKey: retryKey.current }); retryKey.current = null; setNotice("Demo subscription payment received. Profile review is still required."); router.refresh(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
    }}>Pay Monthly Fee / Renew (demo)</button></section><ProfileEditor profile={profile} />{error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}<h2>Your commissions</h2>{!orders.length && <p className="notice">New orders will appear here when customers choose your active approved atelier.</p>}<div className="grid">{orders.map(o => <article className="panel" key={o.id}><span className="badge">{o.status.replaceAll("_", " ")}</span><h3>{o.garmentType} for {o.customerMaskedCode}</h3><p>{o.hasReferenceCloth ? "Fabric + reference size template" : "Custom body measurements"} / {o.agreedCompletionDays}-day estimate</p><p>{o.designSpecifications || "Design withheld pending Admin review."}</p><div className="actions"><Link className="btn outline" href={`/orders/${o.id}`}>Specs &amp; measurements</Link><Link className="btn outline" href={`/orders/${o.id}/chat`}>Masked chat</Link></div>
      {o.status === "PENDING_TIMELINE_APPROVAL" && <form onSubmit={e => { e.preventDefault(); const days = Number(new FormData(e.currentTarget).get("days")); void orderAction(o, { kind: "timeline-propose", days }); }}><p>Customer must accept revised duration before pickup.</p><label className="field">Proposed completion days<input type="number" name="days" min="1" max="365" defaultValue={o.agreedCompletionDays} required /></label><div className="actions"><button className="btn rust" disabled={busy}>Propose duration</button><button type="button" className="btn outline" disabled={busy || o.proposedCompletionDays !== null} onClick={() => orderAction(o, { kind: "timeline-confirm" })}>Confirm agreed {o.agreedCompletionDays} days</button></div></form>}
      {(o.status === "IN_TRANSIT_TO_TAILOR" || o.status === "ALTERATION_IN_TRANSIT") && o.shipments.some(s => s.status === "DELIVERED" && (s.leg === "FABRIC_PICKUP" || s.leg === "ALTERATION_PICKUP") && s.cycle === (o.alterations.find(a => !a.completed)?.cycle ?? 0)) && <button className="btn rust" disabled={busy} onClick={() => orderAction(o, { kind: "production", status: "STITCHING" })}>Start stitching</button>}
      {o.status === "STITCHING" && <button className="btn rust" disabled={busy} onClick={() => orderAction(o, { kind: "production", status: "READY_FOR_DELIVERY" })}>Mark ready for delivery</button>}
      {o.status === "ALTERATION_REQUESTED" && o.alterations.some(a => !a.completed && a.alterationType === "DESIGN_PAID" && !a.paid) && <QuoteForm order={o} disabled={busy} onQuote={data => orderAction(o, data)} />}
    </article>)}</div></>;
}
function QuoteForm({ order, disabled, onQuote }: { order: OrderDTO; disabled: boolean; onQuote: (data: Record<string, unknown>) => Promise<void> }) {
  const a = order.alterations.find(a => !a.completed);
  if (!a || a.alterationType !== "DESIGN_PAID" || a.paid) return null;
  return <form onSubmit={e => { e.preventDefault(); void onQuote({ kind: "alteration-quote", alterationId: a.id, amount: Math.round(Number(new FormData(e.currentTarget).get("amount")) * 100) }); }}><label className="field">Additional design-change quote (INR)<input type="number" name="amount" required min=".01" step=".01" max="1000000" defaultValue={a.amount === null ? "" : a.amount / 100} /></label><p className="meta">Customer must accept and pay this quote before reverse pickup. No extra commission.</p><button className="btn outline" disabled={disabled || a.contentStatus !== "APPROVED"}>Set design-change quote</button></form>;
}
function ModerationCard({ item }: { item: ModerationDTO }) {
  const [text, setText] = useState(() => {
    if (item.kind !== "PROFILE" && item.kind !== "ORDER_SPECIFICATION") return item.originalText;
    const source: unknown = JSON.parse(item.originalText);
    const field = item.kind === "PROFILE" ? "bio" : "designSpecifications";
    if (source && typeof source === "object" && field in source) {
      const value = (source as Record<string, unknown>)[field];
      if (typeof value === "string") return value;
    }
    throw new Error("The review submission has an invalid structured original.");
  }), [checked, setChecked] = useState(false), [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false), [uploadBusy, setUploadBusy] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  async function review(status: "APPROVED" | "REJECTED") {
    setBusy(true); setError("");
    try { await api(`/api/moderation/${item.id}`, "PATCH", { status, publishedText: text, replacementUploadId: photos[0]?.id }); router.refresh(); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <section className="panel"><span className="badge">{item.kind} / {item.authorAlias}</span><p className="meta">Admin-only original: do not approve personal identities, addresses or contact information.</p>{item.imageUrl && <a href={item.imageUrl} target="_blank" rel="noreferrer"><img src={item.imageUrl} alt="Private original awaiting privacy review" style={{ maxWidth: "100%", maxHeight: 260 }} /></a>}<label className="field">Publishable redacted text<textarea value={text} onChange={e => setText(e.target.value)} maxLength={4000} /></label>{item.imageUrl && <PhotoPicker value={photos} onChange={setPhotos} onBusy={setUploadBusy} limit={1} label="Optional safe redacted replacement image" />}<label className="actions"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /> I inspected text and image: no real names, full addresses, contact details or identifying marks remain.</label><div className="actions" style={{ marginTop: 16 }}><button className="btn rust" disabled={busy || uploadBusy || !checked || !!contactError(text)} onClick={() => review("APPROVED")}>Publish reviewed content</button><button className="btn outline" disabled={busy || uploadBusy} onClick={() => review("REJECTED")}>Reject</button></div>{contactError(text) && <p className="notice error">{contactError(text)}</p>}{error && <p className="notice error" role="alert">{error}</p>}</section>;
}
function Logistics({ order }: { order: OrderDTO }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const router = useRouter(), active = order.alterations.find(a => !a.completed);
  const choices: { action: string; label: string }[] = [];
  const fabric = order.shipments.find(s => s.leg === "FABRIC_PICKUP" && s.cycle === 0);
  const final = order.shipments.find(s => s.leg === "FINAL_DELIVERY" && s.cycle === 0);
  const reverse = active && order.shipments.find(s => s.leg === "ALTERATION_PICKUP" && s.cycle === active.cycle);
  const back = active && order.shipments.find(s => s.leg === "ALTERATION_RETURN" && s.cycle === active.cycle);
  if (order.status === "PENDING_TIMELINE_APPROVAL" && order.contentStatus === "APPROVED" && order.timelineConfirmed) {
    choices.push({ action: "schedule", label: "Assign / schedule fabric and reference pickup" });
  }
  if (order.status === "PICKUP_SCHEDULED" && fabric?.status === "ASSIGNED") choices.push({ action: "collect-pickup", label: "Confirm actual pickup + collect 50% (demo)" });
  if (order.status === "IN_TRANSIT_TO_TAILOR" && fabric?.status === "IN_TRANSIT") choices.push({ action: "arrive-tailor", label: "Leg 2: confirm fabric/template delivered to tailor" });
  if (order.status === "READY_FOR_DELIVERY" && !order.paid25Delivery) {
    if (final?.status !== "IN_TRANSIT") choices.push({ action: "dispatch-final", label: "Leg 3: collect finished garment and dispatch" });
    else choices.push({ action: "deliver", label: "Confirm doorstep delivery + collect 25% (demo)" });
  }
  if (order.status === "ALTERATION_REQUESTED" && active?.contentStatus === "APPROVED" && (active.alterationType === "FITTING_FREE" || active.paid)) choices.push({ action: "reverse-pickup", label: "Reverse pickup to tailor (reviewed notes + extra paid)" });
  if (order.status === "ALTERATION_IN_TRANSIT" && reverse?.status === "IN_TRANSIT") choices.push({ action: "reverse-arrive", label: "Confirm alteration garment arrived at tailor" });
  if (order.status === "READY_FOR_DELIVERY" && order.paid25Delivery && active) {
    if (back?.status !== "IN_TRANSIT") choices.push({ action: "return-dispatch", label: "Dispatch corrected garment to customer" });
    else choices.push({ action: "return-deliver", label: "Confirm return delivery - no repeat 25% charge" });
  }
  return <section className="panel"><h3>Logistics / {order.garmentType}</h3><div className="actions"><MaskedBadge code={order.customerMaskedCode} /><MaskedBadge code={order.tailorMaskedCode} /></div><p>{order.status.replaceAll("_", " ")} / reference template: {order.hasReferenceCloth ? "YES - include with fabric" : "No"}</p><div className="form-grid"><div><h3>Customer</h3><p>{order.customerIdentity?.name} / {order.customerIdentity?.email} / {order.customerIdentity?.phone}</p><PrivateAddress value={order.pickupAddress} /><PrivateAddress value={order.deliveryAddress} /></div><div><h3>Tailor workshop</h3><p>{order.tailorIdentity?.name} / {order.tailorIdentity?.email} / {order.tailorIdentity?.phone}</p><PrivateAddress value={order.tailorAddress} /></div></div>
    {choices.length > 0 ? <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      const f = new FormData(e.currentTarget);
      try { await api(`/api/orders/${order.id}`, "PATCH", { kind: "logistics", version: order.version, action: f.get("action"), courier: f.get("courier"), contact: f.get("contact"), tracking: f.get("tracking") }); router.refresh(); }
      catch (error) { setError(errorText(error)); router.refresh(); } finally { setBusy(false); }
    }}><label className="field">Available logistics action<select name="action">{choices.map(c => <option key={c.action} value={c.action}>{c.label}</option>)}</select></label><div className="form-grid"><label className="field">Courier<input name="courier" required maxLength={120} /></label><label className="field">Private courier contact<input name="contact" required maxLength={120} /></label><label className="field">Consignment / tracking<input name="tracking" required maxLength={200} /></label></div><button className="btn rust" disabled={busy}>Record logistics milestone (demo)</button></form> : <p className="muted">Waiting for confirmed timeline, reviewed content, stitching, or customer approval.</p>}
    <QuoteForm order={order} disabled={busy} onQuote={async data => { setBusy(true); setError(""); try { await api(`/api/orders/${order.id}`, "PATCH", { ...data, version: order.version }); router.refresh(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); } }} />
    <div className="actions"><Link className="btn outline" href={`/orders/${order.id}`}>Order &amp; payments</Link><Link className="btn outline" href={`/orders/${order.id}/chat`}>Monitor masked chat</Link></div>{error && <p className="notice error" role="alert">{error}</p>}</section>;
}
export function AdminDashboard({ state }: { state: AdminDTO }) {
  const [selected, setSelected] = useState(state.orders[0]?.id ?? ""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const router = useRouter(), order = state.orders.find(o => o.id === selected);
  const metrics = [["Order value", state.ledger.gross], ["Customer collections", state.ledger.collected], ["Outstanding", state.ledger.unpaid], ["Held until approval", state.ledger.held], ["Expected commission", state.ledger.expectedFee], ["Earned commission", state.ledger.recognizedFee], ["Tailor payout owed", state.ledger.payoutOwed], ["Subscription collections", state.ledger.subscriptionCollected], ["Paid design extras", state.ledger.designCollected]] as const;
  return <><p className="notice">Admin-only private identity mediator. All payments and payouts below are simulations. Garment commission and payout are earned only when customer approval completes the order.</p><div className="stats">{metrics.map(([label, amount]) => <div className="panel" key={label}><span className="meta">{label}</span><strong>{money(amount)}</strong></div>)}</div>
    <form className="panel" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await api("/api/settings", "PATCH", { commissionPercent: Number(new FormData(e.currentTarget).get("percent")) }); router.refresh(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); } }}><h3>Platform commission - Admin controlled</h3><label className="field">Added percentage for future garment quotes<input type="number" name="percent" min="0" max="100" required defaultValue={state.commissionPercent} /></label><button className="btn outline" disabled={busy}>Update future quote commission</button><p className="meta">Existing orders retain their accepted price. Design extras carry no additional commission.</p>{error && <p className="notice error">{error}</p>}</form>
    <h2>Content review &amp; privacy mediation</h2><p className="muted">Inspect actual images, not just text. Reject or redact any identifying content. Human review cannot guarantee detection of every personal detail.</p>{state.moderation.length ? <div className="grid">{state.moderation.map(m => <ModerationCard key={m.id} item={m} />)}</div> : <p className="notice">No pending review submissions.</p>}
    <section className="panel"><h3>Tailor identity &amp; subscription ledger</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Alias / private identity</th><th>City / profile</th><th>Subscription</th><th>Monthly fee</th><th>Billing date</th><th>Workshop</th></tr></thead><tbody>{state.profiles.map(p => <tr key={p.id}><td>{p.maskedCode}<br />{p.identity?.name}<br />{p.identity?.email}<br />{p.identity?.phone}</td><td>{p.city} / {p.approvalStatus}</td><td>{p.subscriptionStatus}</td><td>{money(p.monthlyFeeAmount)}</td><td>{p.nextBillingDate ? new Date(p.nextBillingDate).toLocaleDateString() : "Not paid"}</td><td><PrivateAddress value={p.workshopAddress} /></td></tr>)}</tbody></table></div></section>
    <section className="panel"><h3>Order commission / payout ledger</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Customer / Tailor</th><th>Status</th><th>Total INR</th><th>Collected</th><th>Commission</th><th>Payout owed</th></tr></thead><tbody>{state.orders.map(o => <tr key={o.id}><td><button className="btn outline" onClick={() => setSelected(o.id)}>{o.garmentType}</button></td><td>{o.customerMaskedCode}<br />{o.tailorMaskedCode}</td><td>{o.status.replaceAll("_", " ")}</td><td>{money(o.totalAmount)}</td><td>{money(o.payments.filter(p => p.status === "SUCCEEDED").reduce((n, p) => n + p.amount, 0))}</td><td>{money(o.commissionAmount)}</td><td>{money(o.status === "COMPLETED" ? o.tailorNetPayout : 0)}</td></tr>)}</tbody></table></div></section>
    {order && <Logistics key={`${order.id}:${order.version}`} order={order} />}
  </>;
}
