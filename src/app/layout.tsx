import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/nav";
import "./globals.css";
export const metadata: Metadata = { title: "Sui-dhaaga | Your fabric. Our craft. Doorstep to doorstep.", description: "Compare anonymous Indian tailors, design your perfect fit, and follow your fabric's doorstep journey. Transparent INR prices and 50/25/25 demo payments." };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers><Nav /><main id="main">{children}</main><footer><span>SUI-DHAAGA &copy; {new Date().getFullYear()} &middot; Made personal. Made together.</span><span>India-wide demo &middot; Simulated payments only &middot; INR</span></footer></Providers></body></html>;
}
