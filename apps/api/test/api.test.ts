import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "../src/server.ts";
const api = build(); let base = "";
beforeAll(async () => { base = `http://127.0.0.1:${await api.listen(0)}`; }); afterAll(() => api.close());
const j = async (path: string, init?: RequestInit) => { const r = await fetch(base + path, init); return { status: r.status, body: (await r.json()) as any }; };
const post = (path: string, b: unknown, key?: string) => j(path, { method: "POST", headers: { "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: JSON.stringify(b) });
describe("catalogue", () => {
  it("systems, one planet with its star, and OpenAPI", async () => { expect((await j("/v1/systems")).body).toHaveLength(8); expect((await j("/v1/systems")).body[0].planets).toHaveLength(3); const p = (await j("/v1/planets/p2")).body; expect(p.name).toBe("NEB-017 c"); expect(p.star.name).toBe("NEB-017"); expect((await j("/v1/planets/p999")).status).toBe(404); expect((await j("/openapi.json")).body.openapi).toBe("3.1.0"); });
  it("discoveries are cumulative, paged and validated", async () => { const a = (await j("/v1/discoveries?year=2011&limit=10")).body, b = (await j("/v1/discoveries?year=2020")).body, c = (await j("/v1/discoveries")).body; expect(a.items.every((e: any) => e.year <= 2011)).toBe(true); expect(b.total).toBeGreaterThan(a.total); expect(c.total).toBe(260); expect(a.nextCursor).toBe(10); for (const q of ["year=1900", "year=x", "limit=0", "limit=999", "cursor=-2"]) expect((await j("/v1/discoveries?" + q)).status).toBe(400); });
});
describe("transit simulation", () => {
  const ok = { systemId: "s1", radiusEarth: 11, periodDays: 3.5, inclinationDeg: 89.8, noisePpm: 0, samples: 120 };
  it("returns the light curve and its summary; a tilted orbit has no transit and says why", async () => { const a = await post("/v1/transit/simulate", ok); expect(a.status).toBe(201); expect(a.body.transits).toBe(true); expect(a.body.depthPpm).toBeGreaterThan(5000); expect(a.body.flux).toHaveLength(120); const b = await post("/v1/transit/simulate", { ...ok, inclinationDeg: 80 }); expect(b.body.transits).toBe(false); expect(b.body.reason).toMatch(/No transit/); });
  it("is idempotent by key and rejects bad inputs", async () => { const a = await post("/v1/transit/simulate", ok, "k1"), b = await post("/v1/transit/simulate", { ...ok, radiusEarth: 3 }, "k1"); expect(b.status).toBe(200); expect(b.body.depthPpm).toBe(a.body.depthPpm); for (const bad of [{ ...ok, radiusEarth: 0 }, { ...ok, periodDays: 5000 }, { ...ok, inclinationDeg: 10 }, { ...ok, noisePpm: -1 }, { systemId: "s1" }]) expect((await post("/v1/transit/simulate", bad)).status).toBe(422); expect((await j("/v1/transit/simulate", { method: "POST", body: "{" })).status).toBe(400); });
});
describe("spectrum simulation", () => {
  it("finds the molecules in a gas giant's atmosphere and refuses an unknown planet", async () => { const a = await post("/v1/spectrum/simulate", { systemId: "s1", planetId: "p3", noisePpm: 20 }); expect(a.status).toBe(201); expect(a.body.detected.map((d: any) => d.molecule)).toContain("H2O"); expect(a.body.depthPpm).toHaveLength(300); expect((await post("/v1/spectrum/simulate", { systemId: "s1", planetId: "zzz" })).status).toBe(404); expect((await post("/v1/spectrum/simulate", { systemId: "s1", planetId: "p3", noisePpm: 99999 })).status).toBe(422); });
});
