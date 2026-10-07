// NEBULA API: the blueprint's section 12 contract. Simulations are pure functions of their inputs; POSTs accept an Idempotency-Key and replay the stored answer.
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { MOLECULES, addNoise, detectMolecules, simulateTransit, transmissionSpectrum, wavelengthGrid, discoveriesUpTo } from "../../../packages/domain/src/index.ts";
import type { CatalogEntry, System } from "../../../packages/schemas/src/index.ts";
const load = <T,>(n: string) => JSON.parse(readFileSync(new URL(`../../../data/generated/${n}.json`, import.meta.url), "utf8")) as T;
export const openapi = { openapi: "3.1.0", info: { title: "NEBULA API", version: "1.0.0", description: "Synthetic exoplanet catalogue and deterministic simulations." }, paths: {
  "/v1/systems": { get: {} }, "/v1/planets/{id}": { get: {} }, "/v1/transit/simulate": { post: { summary: "Light curve for a planet; Idempotency-Key optional" } }, "/v1/spectrum/simulate": { post: { summary: "Transmission spectrum and detected molecules" } }, "/v1/discoveries": { get: { summary: "?year= cumulative; ?limit=&cursor= pages" } } } };
export function build() {
  const systems = load<System[]>("systems"), catalog = load<CatalogEntry[]>("catalog"), cache = new Map<string, unknown>();
  const send = (res: ServerResponse, code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,idempotency-key", "access-control-allow-methods": "GET,POST,OPTIONS" }); res.end(JSON.stringify(body)); };
  const err = (res: ServerResponse, code: number, error: string) => send(res, code, { error });
  async function body(req: IncomingMessage) { let s = ""; for await (const c of req) { s += c; if (s.length > 20_000) throw new RangeError("body too large"); } return s ? JSON.parse(s) : {}; }
  const inr = (v: unknown, a: number, b: number) => typeof v === "number" && Number.isFinite(v) && v >= a && v <= b;
  const server: Server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url ?? "/", "http://x"), p = u.pathname.replace(/\/+$/, "") || "/", m = req.method ?? "GET"; let g: RegExpMatchArray | null;
      if (m === "OPTIONS") return send(res, 204, {}); if (p === "/openapi.json") return send(res, 200, openapi); if (p === "/healthz") return send(res, 200, { ok: true });
      if (p === "/v1/systems" && m === "GET") return send(res, 200, systems.map((s) => ({ ...s, planets: s.planets.map((q) => q.id) })));
      if ((g = p.match(/^\/v1\/planets\/(p\d+)$/)) && m === "GET") { for (const s of systems) { const q = s.planets.find((x) => x.id === g![1]); if (q) return send(res, 200, { ...q, star: { id: s.id, name: s.name, spectralType: s.spectralType, radiusSolar: s.radiusSolar, massSolar: s.massSolar, temperatureK: s.temperatureK } }); } return err(res, 404, "no such planet"); }
      if (p === "/v1/discoveries" && m === "GET") {
        const year = u.searchParams.get("year") === null ? 2026 : Number(u.searchParams.get("year")), limit = Number(u.searchParams.get("limit") ?? 50), cursor = Number(u.searchParams.get("cursor") ?? 0);
        if (!Number.isInteger(year) || year < 1990 || year > 2100 || !Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(cursor) || cursor < 0) return err(res, 400, "year (1990-2100), limit (1-200) and cursor must be whole numbers");
        const all = discoveriesUpTo(catalog, year); return send(res, 200, { year, total: all.length, items: all.slice(cursor, cursor + limit), nextCursor: cursor + limit < all.length ? cursor + limit : null });
      }
      if ((p === "/v1/transit/simulate" || p === "/v1/spectrum/simulate") && m === "POST") {
        const key = req.headers["idempotency-key"], hit = typeof key === "string" ? cache.get(p + key) : undefined; if (hit) return send(res, 200, hit);
        const b = await body(req), sys = systems.find((s) => s.id === b.systemId) ?? systems[0]; let out: unknown;
        if (p === "/v1/transit/simulate") {
          if (![b.radiusEarth, b.periodDays, b.inclinationDeg, b.noisePpm ?? 0].every((v) => typeof v === "number") || !inr(b.radiusEarth, 0.3, 25) || !inr(b.periodDays, 0.3, 1000) || !inr(b.inclinationDeg, 30, 90) || !inr(b.noisePpm ?? 0, 0, 10000)) return err(res, 422, "radiusEarth 0.3-25, periodDays 0.3-1000, inclinationDeg 30-90 and noisePpm 0-10000 are required");
          const r = simulateTransit({ radiusEarth: b.radiusEarth, periodDays: b.periodDays, inclinationDeg: b.inclinationDeg, noisePpm: b.noisePpm ?? 0, star: sys, samples: Math.min(500, Number(b.samples ?? 200)), seed: Number(b.seed ?? 1) }); out = r;
        } else {
          const pl = sys.planets.find((x) => x.id === b.planetId); if (!pl) return err(res, 404, "no such planet"); const noise = b.noisePpm ?? 50; if (!inr(noise, 0, 5000)) return err(res, 422, "noisePpm 0-5000");
          const wl = wavelengthGrid(0.5, 5.5, 300), clean = transmissionSpectrum({ radiusEarth: pl.radiusEarth, massEarth: pl.massEarth, teqK: pl.equilibriumTempK, starRadiusSolar: sys.radiusSolar, atmosphere: pl.atmosphere, hydrogenRich: pl.kind === "gas-giant" || pl.kind === "ice" }, wl), spec = addNoise(clean, noise, Number(b.seed ?? 3));
          out = { planet: pl.id, wavelengthsUm: wl, depthPpm: spec, detected: detectMolecules(spec, wl, Math.max(noise, 1)), molecules: Object.keys(MOLECULES) };
        }
        if (typeof key === "string") cache.set(p + key, out); return send(res, 201, out);
      }
      return err(res, 404, "not found");
    } catch (e) { return err(res, e instanceof SyntaxError || e instanceof RangeError ? 400 : 500, e instanceof Error ? e.message : "error"); }
  });
  return { server, listen: (port = 8670) => new Promise<number>((r) => server.listen(port, () => r((server.address() as { port: number }).port))), close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }) };
}
if (import.meta.url === `file://${process.argv[1]}`) build().listen().then((p) => console.log(`NEBULA API on :${p}`));
