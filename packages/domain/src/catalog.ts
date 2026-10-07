import type { CatalogEntry } from "@nebula/schemas";
import { mulberry32 } from "./rng.ts";
/** A synthetic background catalog whose yearly counts follow a slow start, a survey wave around 2011-2016 and a steady tail. */
export function makeCatalog(n: number, seed = 5): CatalogEntry[] {
  const r = mulberry32(seed), out: CatalogEntry[] = [];
  const weight = (y: number) => (y < 2009 ? 0.3 + (y - 1995) * 0.1 : y < 2011 ? 2 : y <= 2016 ? 6 + (y - 2011) * 1.4 : 5 - (y - 2016) * 0.12), years = Array.from({ length: 32 }, (_, i) => 1995 + i), tot = years.reduce((a, y) => a + weight(y), 0);
  for (const y of years) { const c = Math.round((weight(y) / tot) * n); for (let i = 0; i < c; i++) { const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), d = 160 + r() * 360, rad = Math.exp(r() * 3.2 - 1.2); out.push({ year: y, radiusEarth: Math.round(rad * 100) / 100, periodDays: Math.round(Math.exp(r() * 5.5) * 100) / 100, pos: [d * Math.sin(ph) * Math.cos(th), d * Math.cos(ph), d * Math.sin(ph) * Math.sin(th)].map((v) => Math.round(v * 10) / 10) as [number, number, number], tempK: Math.round(3000 + r() * 4200) }); } }
  return out;
}
export const countsByYear = (c: CatalogEntry[], y0 = 1995, y1 = 2026) => Array.from({ length: y1 - y0 + 1 }, (_, i) => ({ year: y0 + i, count: c.filter((e) => e.year === y0 + i).length }));
export const discoveriesUpTo = (c: CatalogEntry[], year: number) => c.filter((e) => e.year <= year);
