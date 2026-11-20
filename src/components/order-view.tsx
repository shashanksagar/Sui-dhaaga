"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ShieldCheck, Truck } from "lucide-react";
import type { Address, OrderDTO, Role, OrderStatus } from "@/lib/contracts";
import { money, splitPayment } from "@/lib/money";
import { contactError } from "@/lib/privacy";
import { api, errorText } from "@/lib/client";
import { MaskedBadge } from "./fields";

const progress: Record<OrderStatus, number> = {
  PENDING_TIMELINE_APPROVAL: 0, PICKUP_SCHEDULED: 1, IN_TRANSIT_TO_TAILOR: 1,
  STITCHING: 2, READY_FOR_DELIVERY: 3, DELIVERED_PENDING_APPROVAL: 4,
  ALTERATION_REQUESTED: 4, ALTERATION_IN_TRANSIT: 2, COMPLETED: 5,
};
export function OrderTracker({ status }: { status: OrderStatus }) {
  return <ol className="tracker" aria-label="Order progress">{["Agreed timeline", "Fabric pickup", "Stitching", "Doorstep delivery", "Fitting approval", "Complete"].map((label, i) => <li key={label} className={i <= progress[status] ? "done" : ""} aria-current={i === progress[status] ? "step" : undefined}><span>{i < progress[status] ? <Check size={13} /> : i + 1}</span>{label}</li>)}</ol>;
}
export function PrivateAddress({ value }: { value?: Address }) {
  if (!value) return <p className="notice error">Private address missing. Resolve before dispatch.</p>;
  return <p className="details">{value.name}<br />{value.line1}<br />{value.city}, {value.postalCode}, {value.country}<br />{value.phone}</p>;
}
export function OrderView({ order, role }: { order: OrderDTO; role: Role }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [type, setType] = useState("FITTING_FREE"), [notes, setNotes] = useState("");
  const [rating, setRating] = useState(5), [review, setReview] = useState("");
  const router = useRouter(), amounts = splitPayment(order.totalAmount);
  const active = order.alterations.find(a => !a.completed);
  async function change(data: Record<string, unknown>, payments = false) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api<OrderDTO>(`/api/orders/${order.id}${payments ? "/payments" : ""}`, payments ? "POST" : "PATCH", { ...data, version: order.version });
      setNotice(data.outcome === "failure" ? "Demo payment failed. No payment milestone advanced; you may retry." : "Saved. Shared content remains private until reviewed.");
      router.refresh();
    } catch (error) { setError(errorText(error)); router.refresh(); } finally { setBusy(false); }
  }
  const paid = [["50% pickup", amounts.pickup, order.paid50Pickup], ["25% delivery", amounts.delivery, order.paid25Delivery], ["25% approval", amounts.approval, order.paid25Approval]] as const;
  const readyToApprove = role === "CUSTOMER" && order.status === "DELIVERED_PENDING_APPROVAL" && !order.paid25Approval;
  return <><OrderTracker status={order.status} /><p className="badge">{order.status.replaceAll("_", " ")}</p><div className="split"><div><section className="panel"><div className="section-head"><div><h2>{order.garmentType}</h2><div className="actions"><MaskedBadge code={order.customerMaskedCode} /><MaskedBadge code={order.tailorMaskedCode} /></div></div><Link className="btn outline" href={`/orders/${order.id}/chat`}>Masked design room</Link></div>
    <dl className="details"><dt>Design specifications ({order.contentStatus})</dt><dd>{order.designSpecifications || "Awaiting Admin review; private original withheld."}</dd><dt>Measurement method</dt><dd>{order.measurementMode.replaceAll("_", " ")}{order.hasReferenceCloth && " / Reference cloth travels with fabric"}</dd><dt>Measurements</dt><dd>{Object.entries(order.measurements).map(([key, value]) => <span key={key} style={{ marginRight: 12 }}>{key}: {value}</span>)}</dd><dt>Agreed completion duration</dt><dd>{order.agreedCompletionDays} days from fabric arrival &middot; {order.timelineConfirmed ? "Confirmed" : "Awaiting tailor confirmation"}</dd></dl>
    {order.proposedCompletionDays !== null && order.status === "PENDING_TIMELINE_APPROVAL" && <p className="notice">Tailor proposes {order.proposedCompletionDays} days. Pickup is locked until customer accepts.{role === "CUSTOMER" && <button className="btn rust" disabled={busy} onClick={() => change({ kind: "timeline-accept" })}>Accept proposed {order.proposedCompletionDays}-day duration</button>}</p>}
    <div className="photos">{order.referenceImages.map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={role === "TAILOR" ? "Reviewed reference design" : "Private reference design"} /></a>)}</div><p className="meta">Unreviewed or rejected counterpart content and images are not shared.</p></section>
    <section className="panel"><h3><Truck size={16} /> Doorstep and alteration journey</h3>{order.shipments.map(s => <p key={s.id} className="details">{s.leg.replaceAll("_", " ")}{s.cycle > 0 && ` / correction cycle ${s.cycle}`} &middot; {s.status.replaceAll("_", " ")}{role === "ADMIN" && <span> / {s.courier} / {s.tracking} / {s.contact}</span>}</p>)}
      {order.alterations.map(a => <div key={a.id} className="notice"><strong>Correction cycle {a.cycle}: {a.alterationType === "FITTING_FREE" ? "Free fitting adjustment" : "Paid design change"}</strong><p>{a.notes || "Notes withheld pending Admin review."}</p><p>{a.contentStatus} &middot; {a.amount === null ? "Awaiting quote" : money(a.amount)} &middot; {a.completed ? "Returned" : a.paid ? "Extra paid" : "In progress"}</p></div>)}
      {role === "ADMIN" && <div className="form-grid"><div><h3>Customer identity</h3><p>{order.customerIdentity?.name} / {order.customerIdentity?.email} / {order.customerIdentity?.phone}</p><h3>Pickup</h3><PrivateAddress value={order.pickupAddress} /><h3>Customer delivery</h3><PrivateAddress value={order.deliveryAddress} /></div><div><h3>Tailor identity</h3><p>{order.tailorIdentity?.name} / {order.tailorIdentity?.email} / {order.tailorIdentity?.phone}</p><h3>Workshop</h3><PrivateAddress value={order.tailorAddress} /></div></div>}</section>
    {readyToApprove && <section className="panel"><h3>How does the final fit feel?</h3><p className="muted">Approve only when the fitting and design are right. Otherwise request corrections below. Final 25% stays unpaid through alteration cycles.</p><div className="actions"><button className="btn rust" disabled={busy} onClick={() => change({ installment: "APPROVAL", approved: true, outcome: "success" }, true)}>Approve &amp; Pay Final 25% ({money(amounts.approval)}, demo)</button><button className="btn outline" disabled={busy} onClick={() => change({ installment: "APPROVAL", approved: true, outcome: "failure" }, true)}>Simulate approval payment failure</button></div>
      <form style={{ marginTop: 24 }} onSubmit={e => { e.preventDefault(); const blocked = contactError(notes); if (blocked) { setError(blocked); return; } void change({ kind: "alteration", alterationType: type, notes }); }}><label className="field">Request Changes / Corrections<select value={type} onChange={e => setType(e.target.value)}><option value="FITTING_FREE">Fitting adjustment - INR 0 / Free</option><option value="DESIGN_PAID">Design change - additional charges apply</option></select></label><label className="field">Correction notes (no personal details)<textarea required maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} /></label>{contactError(notes) && <p className="notice error">{contactError(notes)}</p>}<button className="btn outline" disabled={busy || !!contactError(notes)}>Request corrections</button></form></section>}
    {role === "CUSTOMER" && order.status === "ALTERATION_REQUESTED" && active?.alterationType === "DESIGN_PAID" && <section className="panel"><h3>Design-change quote</h3>{active.amount === null ? <p>Admin or tailor is preparing your additional-charge quote.</p> : <><p>{money(active.amount)} additional, entirely paid to the tailor. Reverse pickup waits for reviewed notes and successful quote payment.</p><button className="btn rust" disabled={busy || active.paid || active.contentStatus !== "APPROVED"} onClick={() => change({ installment: "DESIGN", alterationId: active.id, quoteVersion: active.quoteVersion, quotedAmount: active.amount, acceptQuote: true, outcome: "success" }, true)}>{active.paid ? "Extra payment received" : "Accept quote & pay design change (demo)"}</button></>}</section>}
    {role === "CUSTOMER" && order.status === "COMPLETED" && order.customerRating === null && <form className="panel" onSubmit={e => { e.preventDefault(); const blocked = contactError(review); if (blocked) { setError(blocked); return; } void change({ kind: "feedback", rating, review }); }}><h3>Share your craftsmanship experience</h3><label className="field">Star rating<select value={rating} onChange={e => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}</select></label><label className="field">Review (no names or contact information)<textarea required maxLength={2000} value={review} onChange={e => setReview(e.target.value)} /></label><button className="btn rust" disabled={busy || !!contactError(review)}>Submit rating &amp; review for moderation</button></form>}
    {order.customerRating !== null && <p className="notice">Feedback: {order.customerRating} stars &middot; {order.reviewStatus}. {order.customerReview || "Unpublished review withheld."}</p>}
    </div><aside className="panel"><h3><ShieldCheck size={16} /> Transparent INR payments</h3><dl className="details"><dt>Inclusive garment total</dt><dd className="price">{money(order.totalAmount)}</dd><dt>Included added commission</dt><dd>{money(order.commissionAmount)}</dd><dt>Tailor payout owed on completion</dt><dd>{money(order.tailorNetPayout)}</dd>{paid.map(([label, amount, done]) => <div key={label}><dt>{label}</dt><dd>{money(amount)} &middot; {done ? "Paid" : "Not collected"}</dd></div>)}<dt>Paid design-change charges</dt><dd>{money(order.alterationExtraCharge)}</dd></dl><p className="notice">Simulation only. No real money, regulated escrow or bank payout. Only Admin records pickup/delivery collection; final payment requires customer approval.</p><p className="meta">Odd-paise rounding: pickup rounds up, delivery rounds down, approval receives the exact remainder.</p></aside></div>{busy && <p className="notice" role="status">Updating...</p>}{notice && <p className="notice" role="status">{notice}</p>}{error && <p className="notice error" role="alert">{error}</p>}</>;
}
