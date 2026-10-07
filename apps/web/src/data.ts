import type { CatalogEntry, System } from "@nebula/schemas";
export type Data = { systems: System[]; catalog: CatalogEntry[] };
export const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export async function loadData(): Promise<Data> { const g = async <T,>(n: string) => (await fetch(`${base}/data/${n}.json`)).json() as Promise<T>; const [systems, catalog] = await Promise.all([g<System[]>("systems"), g<CatalogEntry[]>("catalog")]); return { systems, catalog }; }
export const planetOf = (d: Data, id: string) => { for (const s of d.systems) { const p = s.planets.find((x) => x.id === id); if (p) return { p, s }; } return null; };
