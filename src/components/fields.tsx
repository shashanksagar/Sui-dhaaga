"use client";
import { useState } from "react";
import type { Address } from "@/lib/contracts";
import { errorText, uploadImage } from "@/lib/client";
import { cities } from "@/lib/validation";

export const emptyAddress: Address = { name: "", line1: "", city: "", postalCode: "", country: "India", phone: "" };
export function AddressFields({ title, value, onChange }: { title: string; value: Address; onChange: (value: Address) => void }) {
  const labels: Record<keyof Address, string> = { name: "Private contact name", line1: "Street / workshop address", city: "City", postalCode: "PIN code", country: "Country", phone: "Private contact phone" };
  return <fieldset style={{ border: 0, padding: 0 }}><legend>{title} (Admin only)</legend><div className="form-grid">{(Object.keys(labels) as (keyof Address)[]).map(key => <label className="field" key={key}>{labels[key]}{key === "city" ? <select aria-label={labels.city} required value={value.city} onChange={e => onChange({ ...value, city: e.target.value })}><option value="">Choose an Indian city</option>{cities.map(city => <option key={city}>{city}</option>)}</select> : <input required readOnly={key === "country"} value={value[key]} maxLength={key === "line1" ? 200 : key === "phone" ? 30 : key === "postalCode" ? 12 : 100} onChange={e => onChange({ ...value, [key]: e.target.value })} />}</label>)}</div></fieldset>;
}
export type Photo = { id: string; url: string };
export function PhotoPicker({ value, onChange, onBusy, label = "Reference photos", limit = 5 }: { value: Photo[]; onChange: (value: Photo[]) => void; onBusy?: (busy: boolean) => void; label?: string; limit?: number }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <div><label className="field">{label} (JPEG/PNG/WebP, 3 MB each)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || value.length >= limit} onChange={async e => {
    const input = e.currentTarget, file = input.files?.[0]; if (!file) return;
    setBusy(true); onBusy?.(true); setError("");
    try { onChange([...value, await uploadImage(file)]); } catch (error) { setError(errorText(error)); } finally { setBusy(false); onBusy?.(false); input.value = ""; }
  }} /></label><div className="photos">{value.map((p, i) => <div key={p.id}><img src={p.url} alt={`Selected photo ${i + 1}`} /><button type="button" className="btn small outline" disabled={busy} onClick={() => onChange(value.filter(item => item.id !== p.id))}>Remove from selection</button></div>)}</div>{error && <p className="notice error" role="alert">{error}</p>}<p className="meta">Photos stay private until Admin checks them for personal information. Removing a selection does not erase an already submitted image.</p></div>;
}
export function MaskedBadge({ code }: { code: string }) { return <span className="badge" aria-label={`Masked identity ${code}`}>{code}</span>; }
