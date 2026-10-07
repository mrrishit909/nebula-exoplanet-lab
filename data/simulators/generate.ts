// Synthetic exoplanet catalog: 8 systems with 24 planets (full parameters) and a 260-entry background catalog for the sky and timeline. Names are invented (NEB-nnn).
import { mkdirSync, writeFileSync } from "node:fs";
import { mulberry32, semiMajorAxisAu, equilibriumTemp, makeCatalog } from "../../packages/domain/src/index.ts";
import type { Kind, Planet, System } from "../../packages/schemas/src/index.ts";
const r = mulberry32(2026);
const stars = [["NEB-017", "G2V", 1.0, 1.0, 5772, 42], ["NEB-052", "K5V", 0.72, 0.68, 4400, 88], ["NEB-104", "M3V", 0.38, 0.36, 3400, 31], ["NEB-131", "F6V", 1.28, 1.2, 6300, 140], ["NEB-208", "K1V", 0.85, 0.85, 5000, 64], ["NEB-233", "M1V", 0.52, 0.5, 3700, 27], ["NEB-301", "G8V", 0.93, 0.95, 5400, 190], ["NEB-377", "M5V", 0.2, 0.15, 3000, 12]] as const;
const plan: Record<string, [Kind, number, number, number][]> = {   // kind, radius (Earth), period (days), inclination
  "NEB-017": [["lava", 1.1, 2.4, 89.1], ["ocean", 1.9, 11.6, 89.6], ["gas-giant", 11.2, 140, 89.8]],
  "NEB-052": [["rocky", 0.9, 5.1, 88.9], ["super-earth", 1.6, 17, 89.4], ["ice", 2.6, 80, 89.0]],
  "NEB-104": [["rocky", 1.0, 4.2, 89.7], ["ocean", 1.15, 9.8, 89.5], ["rocky", 0.95, 17.4, 89.6], ["ice", 1.3, 31, 89.2]],
  "NEB-131": [["gas-giant", 13.5, 3.4, 87.5], ["super-earth", 1.8, 22, 88.8]],
  "NEB-208": [["rocky", 1.05, 28, 89.5], ["ocean", 1.4, 52, 89.7], ["gas-giant", 8.6, 410, 89.9]],
  "NEB-233": [["lava", 0.8, 1.6, 87.9], ["rocky", 1.2, 6.3, 89.2], ["ocean", 1.6, 12.4, 89.4], ["ice", 2.0, 40, 88.7]],
  "NEB-301": [["super-earth", 1.7, 9.7, 89.1], ["gas-giant", 9.9, 71, 89.3]],
  "NEB-377": [["rocky", 0.85, 1.5, 88.1], ["rocky", 0.95, 2.4, 88.6], ["ocean", 1.1, 4.0, 88.9], ["rocky", 1.0, 6.1, 89.0], ["ice", 1.25, 12.2, 89.2]],
};
const atmo: Record<Kind, Record<string, number>> = { rocky: { CO2: 0.5, H2O: 0.1 }, ocean: { H2O: 0.8, CO2: 0.3, O3: 0.15 }, "gas-giant": { H2O: 1, CH4: 1, Na: 1, K: 0.8 }, lava: { Na: 0.9, K: 0.5 }, ice: { CH4: 0.8, H2O: 0.2 }, "super-earth": { H2O: 0.5, CO2: 0.4, CH4: 0.3 } };
const mass = (k: Kind, rad: number) => k === "gas-giant" ? Math.round(rad ** 2 * 3 * 10) / 10 : Math.round(rad ** 3.2 * 10) / 10;
let id = 0; const systems: System[] = stars.map(([name, sp, rs, ms, tk, ly], si) => {
  const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), d = 60 + si * 40 + r() * 30, sid = `s${si + 1}`;
  const planets: Planet[] = plan[name].map(([kind, rad, per, inc], pi) => { const a = semiMajorAxisAu(per, ms); return { id: `p${++id}`, starId: sid, name: `${name} ${String.fromCharCode(98 + pi)}`, kind, radiusEarth: rad, massEarth: mass(kind, rad), periodDays: per, semiMajorAxisAu: Math.round(a * 1e4) / 1e4, equilibriumTempK: Math.round(equilibriumTemp(tk, rs, a)), discoveryYear: 2004 + Math.floor(r() * 21), inclinationDeg: inc, atmosphere: atmo[kind] }; });
  return { id: sid, name, spectralType: sp, radiusSolar: rs, massSolar: ms, temperatureK: tk, pos: [d * Math.sin(ph) * Math.cos(th), d * Math.cos(ph), d * Math.sin(ph) * Math.sin(th)].map((v) => Math.round(v * 10) / 10) as [number, number, number], distanceLy: ly, planets };
});
const out = new URL("../generated/", import.meta.url).pathname; mkdirSync(out, { recursive: true });
writeFileSync(out + "systems.json", JSON.stringify(systems)); writeFileSync(out + "catalog.json", JSON.stringify(makeCatalog(260)));
console.log(`generated ${systems.length} systems, ${systems.reduce((a, s) => a + s.planets.length, 0)} planets, ${makeCatalog(260).length} catalog entries`);
