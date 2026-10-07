import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "NEBULA: an exoplanet discovery lab", description: "Transits, spectra and habitability on synthetic worlds, in one lab. All data is synthetic." };
export const viewport: Viewport = { themeColor: "#06050A", width: "device-width", initialScale: 1 };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
