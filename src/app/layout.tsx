import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/nav";
import "./globals.css";
export const metadata: Metadata = { title: "Sui-dhaaga | Tailoring demo starter", description: "A tailoring marketplace demo. The Sui-dhaaga privacy, INR and milestone-payment overhaul is still pending." };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers><Nav /><main id="main"><p className="notice" style={{ margin: "16px auto", maxWidth: 1100 }}>Sui-dhaaga starter demo: legacy USD / 50-50 payments. Masked identities, INR pricing, subscriptions and the 50/25/25 workflow are not implemented. Use fictional data only.</p>{children}</main><footer><span>SUI-DHAAGA &copy; {new Date().getFullYear()} &middot; Made personal. Made together.</span><span>Starter demo &middot; Simulated payments only &middot; USD</span></footer></Providers></body></html>;
}
