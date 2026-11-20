"use client";
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api, errorText } from "@/lib/client";
import { cities } from "@/lib/validation";
export function AuthForm({ signup = false }: { signup?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return <form className="panel" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    try {
      if (signup) await api("/api/signup", "POST", { name: form.get("name"), location: form.get("location"), phone: form.get("phone"), role: form.get("role"), email, password });
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) throw new Error(signup ? "Account created, but login failed. Try logging in again." : "Login failed. Check your credentials or wait a minute before retrying.");
      router.push("/orders"); router.refresh();
    } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }}>
    {signup && <><p className="notice">Real identity and contact details are private to you and Admin. Other users see a masked alias.</p><label className="field">Account type<select name="role"><option value="CUSTOMER">Customer</option><option value="TAILOR">Tailor - profile review and monthly subscription required</option></select></label><label className="field">Your private name<input name="name" autoComplete="name" required minLength={2} maxLength={80} /></label><label className="field">Indian city<select name="location" autoComplete="address-level2" required>{cities.map(city => <option key={city}>{city}</option>)}</select></label><label className="field">Private phone number<input name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={30} /></label></>}
    <label className="field">Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label className="field">Password<input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 10 : 1} maxLength={128} /></label>
    {error && <p role="alert" className="notice error">{error}</p>}
    <button className="btn rust" disabled={busy}>{busy ? "Please wait..." : signup ? "Create your account" : "Welcome back"}</button>
    <p className="muted" style={{ fontSize: 12, marginTop: 20 }}>{signup ? "Already found us?" : "New to Sui-dhaaga?"} <Link href={signup ? "/login" : "/signup"} style={{ textDecoration: "underline" }}>{signup ? "Log in" : "Create an account"}</Link></p>
    {!signup && <p className="notice">Demo accounts: customer@sui.local, tailor1@sui.local, admin@sui.local. Ask the demo owner privately for credentials. Use fictional data only; no real payments.</p>}
  </form>;
}
