"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Ruler } from "lucide-react";
import { addressSchema } from "@/lib/validation";
import { money, splitPayment } from "@/lib/money";
import { contactError } from "@/lib/privacy";
import { api, errorText } from "@/lib/client";
import type { OrderDTO, TailorCard } from "@/lib/contracts";
import { AddressFields, emptyAddress, PhotoPicker, type Photo, MaskedBadge } from "./fields";

export function MeasurementGuide() {
  return <div className="guide"><svg viewBox="0 0 120 210" role="img" aria-labelledby="body-guide-title"><title id="body-guide-title">Measure chest around the fullest point, waist at the natural waist, and length from shoulder to hem.</title><circle cx="60" cy="21" r="15" fill="#d8c8b3" /><path d="M43 40 26 49 12 105 27 109 40 73 42 122 34 192 51 195 60 136 69 195 86 192 78 122 80 73 93 109 108 105 94 49 77 40Q60 49 43 40Z" fill="#d8c8b3" /><path d="M36 69h48M42 107h36M104 44v151M99 44h10M99 195h10" stroke="#ad543b" strokeWidth="2" strokeDasharray="4 2" /><text x="0" y="67" fontSize="10" fill="#ad543b">1</text><text x="24" y="106" fontSize="10" fill="#ad543b">2</text><text x="108" y="122" fontSize="10" fill="#ad543b">3</text></svg><div><h3><Ruler size={16} /> A fit that feels like you.</h3><p className="muted">1. Chest: fullest point.<br />2. Waist: natural waist.<br />3. Length: shoulder to desired hem.<br />Use one unit and a comfortably snug tape. Or send a reference garment.</p></div></div>;
}
export function OrderWizard({ tailor }: { tailor: TailorCard }) {
  const router = useRouter();
  const [step, setStep] = useState(0), [garmentType, setGarmentType] = useState(tailor.garmentCatalog[0]?.garmentType ?? "");
  const [measurementMode, setMode] = useState("CUSTOM_MEASUREMENTS"), [unit, setUnit] = useState("cm");
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [specs, setSpecs] = useState(""), [pickup, setPickup] = useState(emptyAddress), [delivery, setDelivery] = useState(emptyAddress);
  const [same, setSame] = useState(true), [agreed, setAgreed] = useState(false);
  const [images, setImages] = useState<Photo[]>([]), [checkoutKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false), [uploadBusy, setUploadBusy] = useState(false), [error, setError] = useState("");
  const garment = tailor.garmentCatalog.find(g => g.garmentType === garmentType);
  if (!garment) return <p className="notice error" role="alert">This tailor has no available garment catalog. Return to Explore.</p>;
  const amounts = splitPayment(garment.finalDisplayPrice), custom = measurementMode !== "REFERENCE_CLOTH_TEMPLATE";
  return <div className="split"><div><ol className="tracker" aria-label="Order form steps">{["Design", "Measurements", "Private addresses", "Timeline & quote"].map((label, i) => <li key={label} className={i <= step ? "done" : ""} aria-current={i === step ? "step" : undefined}><span>{i < step ? <Check size={12} /> : i + 1}</span>{label}</li>)}</ol>
    <form className="panel" onSubmit={async e => {
      e.preventDefault(); setError("");
      try {
        const privacyError = contactError(specs); if (privacyError) throw new Error(privacyError);
        if (!specs.trim()) throw new Error("Please describe your design.");
        if (step === 1 && custom && garment.requiredMeasurements.some(key => !Number.isFinite(Number(measurements[key])) || Number(measurements[key]) <= 0 || Number(measurements[key]) > 500)) throw new Error("Complete every required measurement using positive values up to 500.");
        if (step === 2) { addressSchema.parse(pickup); addressSchema.parse(same ? pickup : delivery); }
        if (step < 3) { setStep(step + 1); return; }
        if (!agreed) throw new Error("Please explicitly agree to the estimated completion duration.");
        setBusy(true);
        const order = await api<OrderDTO>("/api/orders", "POST", {
          tailorId: tailor.id, garmentType, quotedAmount: garment.finalDisplayPrice,
          designSpecifications: specs, measurementMode,
          measurements: custom ? { ...Object.fromEntries(garment.requiredMeasurements.map(key => [key, Number(measurements[key])])), unit } : { unit },
          hasReferenceCloth: measurementMode !== "CUSTOM_MEASUREMENTS", pickupAddress: pickup, deliveryAddress: same ? pickup : delivery,
          uploadIds: images.map(p => p.id), checkoutKey, agreedCompletionDays: garment.estimatedDays, customerAgreedToTimeline: true,
        });
        router.push(`/orders/${order.id}`);
      } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
    }}>
      {step === 0 && <><div className="eyebrow">01 / Dream it</div><h2>What are we making?</h2><label className="field">Garment type<select value={garmentType} onChange={e => { setGarmentType(e.target.value); setAgreed(false); setMeasurements({}); }}>{tailor.garmentCatalog.map(g => <option key={g.garmentType}>{g.garmentType}</option>)}</select></label><label className="field">Design specifications<textarea required maxLength={2000} value={specs} onChange={e => setSpecs(e.target.value)} placeholder="Describe cut, fabric and finishing, without names or contact details." /></label>{contactError(specs) && <p className="notice error" role="alert">{contactError(specs)}</p>}<PhotoPicker value={images} onChange={setImages} onBusy={setUploadBusy} /><p className="notice">Admin reviews your design and photos before the tailor can see them. Do not include real names, addresses, phone numbers or social handles.</p></>}
      {step === 1 && <><h2>Your perfect fit.</h2><MeasurementGuide /><label className="field">Measurement method<select value={measurementMode} onChange={e => setMode(e.target.value)}><option value="CUSTOM_MEASUREMENTS">Enter the tailor&apos;s required measurements</option><option value="REFERENCE_CLOTH_TEMPLATE">Send a reference cloth as a size template</option><option value="BOTH">Measurements and reference cloth</option></select></label>{custom && <><label className="field">Unit<select value={unit} onChange={e => setUnit(e.target.value)}><option value="cm">Centimeters</option><option value="in">Inches</option></select></label><div className="form-grid">{garment.requiredMeasurements.map(key => <label className="field" key={key}>{key} ({unit})<input type="number" step="0.1" min="0.1" max="500" required value={measurements[key] ?? ""} onChange={e => setMeasurements({ ...measurements, [key]: e.target.value })} /></label>)}</div></>}{measurementMode !== "CUSTOM_MEASUREMENTS" && <p className="notice">Your reference garment will be picked up with the raw fabric. Pack and label both for the logistics team.</p>}</>}
      {step === 2 && <><h2>We come to you.</h2><p className="notice">These details go only to Admin, never to your tailor.</p><AddressFields title="Fabric and reference-cloth pickup" value={pickup} onChange={setPickup} /><label className="actions"><input type="checkbox" checked={same} onChange={e => setSame(e.target.checked)} /> Deliver to the same private address</label>{!same && <AddressFields title="Finished garment delivery" value={delivery} onChange={setDelivery} />}</>}
      {step === 3 && <><h2>Agree on the journey.</h2><MaskedBadge code={tailor.maskedCode} /><p>{garmentType} &middot; {measurementMode.replaceAll("_", " ")}</p><label className="actions"><input required type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} /> Agree to Estimated Completion Duration: {garment.estimatedDays} days</label><p className="muted">The tailor must confirm or propose a revised duration. Any revision needs your acceptance before pickup. Production duration starts when fabric arrives at the workshop.</p><p className="notice">Nothing is charged at checkout. Admin records {money(amounts.pickup)} at actual pickup, {money(amounts.delivery)} at delivery. You approve the final fit before paying {money(amounts.approval)}.</p></>}
      {error && <p className="notice error" role="alert">{error}</p>}<div className="actions">{step > 0 && <button type="button" className="btn outline" disabled={busy || uploadBusy} onClick={() => { setStep(step - 1); setError(""); }}>Back</button>}<button className="btn rust" disabled={busy || uploadBusy || (step === 3 && !agreed)}>{busy ? "Creating..." : step === 3 ? "Confirm order and agreed estimate" : "Continue"}</button></div>
    </form></div><aside className="panel"><img src={tailor.portfolioImages[0] || "/images/atelier-hero.svg"} alt="Approved portfolio design" style={{ width: "100%", height: 180, objectFit: "cover" }} /><h3>{tailor.maskedCode}</h3><p>{tailor.city}</p><dl className="details"><dt>Tailor base price</dt><dd>{money(garment.basePrice)}</dd><dt>Added platform commission ({garment.commissionPercent}%)</dt><dd>{money(garment.platformCommission)}</dd><dt>Inclusive INR price</dt><dd className="price">{money(garment.finalDisplayPrice)}</dd><dt>Pickup 50% / Delivery 25% / Approval 25%</dt><dd>{money(amounts.pickup)} / {money(amounts.delivery)} / {money(amounts.approval)}</dd></dl><p className="meta">Whole-paise rounding reconciles exactly. Demo payments only.</p></aside></div>;
}
