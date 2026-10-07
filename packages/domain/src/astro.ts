// The science, deterministic and separate from the story. Textbook relations with a simple limb-darkened transit model; synthetic planets, so accuracy of any real object is not claimed.
export const R_SUN_AU = 0.00465047, R_EARTH_PER_R_SUN = 0.009168, T_SUN = 5772, YEAR_DAYS = 365.25;
const rad = (d: number) => (d * Math.PI) / 180, clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** Kepler's third law: a^3 = M P^2 with a in AU, P in years and M in solar masses. */
export const semiMajorAxisAu = (periodDays: number, massSolar: number) => Math.cbrt(massSolar * (periodDays / YEAR_DAYS) ** 2);
export const periodDays = (aAu: number, massSolar: number) => YEAR_DAYS * Math.sqrt(aAu ** 3 / massSolar);
export const luminosity = (radiusSolar: number, tempK: number) => radiusSolar ** 2 * (tempK / T_SUN) ** 4;
export const insolation = (lum: number, aAu: number) => lum / aAu ** 2;
export const equilibriumTemp = (tempK: number, radiusSolar: number, aAu: number, albedo = 0.3) => tempK * Math.sqrt((radiusSolar * R_SUN_AU) / (2 * aAu)) * (1 - albedo) ** 0.25;
/** Conservative habitable zone from effective flux limits 1.1 (inner) and 0.36 (outer) of Earth's, a coarse stand-in for the published boundaries. */
export const habitableZone = (lum: number) => ({ inner: Math.sqrt(lum / 1.1), outer: Math.sqrt(lum / 0.36) });
export const inHabitableZone = (lum: number, aAu: number) => { const z = habitableZone(lum); return aAu >= z.inner && aAu <= z.outer; };
/** Earth Similarity Index over radius, equilibrium temperature and insolation: product of (1 - |x - x0|/(x + x0))^(w/n). Earth (1 R, 255 K, 1 S) scores 1. */
export function esi(radiusEarth: number, teqK: number, flux: number) {
  const term = (x: number, x0: number, w: number) => (1 - Math.abs(x - x0) / (x + x0)) ** (w / 3);
  return Math.round(term(radiusEarth, 1, 0.57) * term(teqK, 255, 5.58) * term(flux, 1, 0.7) * 1000) / 1000;
}
// ---- transits
/** Overlap area of the unit star disk and a planet disk of radius k at centre separation z (both normalised to the star). */
export function overlapArea(k: number, z: number): number {
  if (z >= 1 + k) return 0; if (z <= Math.abs(1 - k)) return Math.PI * Math.min(1, k) ** 2;
  const k0 = Math.acos(clamp((k * k + z * z - 1) / (2 * k * z), -1, 1)), k1 = Math.acos(clamp((1 - k * k + z * z) / (2 * z), -1, 1));
  return k * k * k0 + k1 - 0.5 * Math.sqrt(Math.max(0, 4 * z * z - (1 + z * z - k * k) ** 2));
}
export const radiusRatio = (radiusEarth: number, starRadiusSolar: number) => (radiusEarth * R_EARTH_PER_R_SUN) / starRadiusSolar;
export const impactParameter = (aAu: number, starRadiusSolar: number, inclinationDeg: number) => (aAu / (starRadiusSolar * R_SUN_AU)) * Math.cos(rad(inclinationDeg));
/** Flux drop at separation z with linear limb darkening u, weighting the overlap by the surface brightness under the planet's centre. */
export function fluxDrop(k: number, z: number, u = 0.4): number {
  const ov = overlapArea(k, z) / Math.PI; if (ov <= 0) return 0; const mu = Math.sqrt(Math.max(0, 1 - Math.min(z, 1) ** 2));
  return ov * (1 - u * (1 - mu)) / (1 - u / 3);
}
/** Transit duration in hours for a circular orbit (T14); 0 when the planet misses the star's disk. */
export function transitDurationHours(periodD: number, aAu: number, starRadiusSolar: number, k: number, inclinationDeg: number): number {
  const aRs = aAu / (starRadiusSolar * R_SUN_AU), b = aRs * Math.cos(rad(inclinationDeg)); if (b >= 1 + k) return 0;
  const arg = Math.sqrt((1 + k) ** 2 - b * b) / (aRs * Math.sin(rad(inclinationDeg))); return Math.round(((periodD * 24) / Math.PI) * Math.asin(clamp(arg, 0, 1)) * 100) / 100;
}
/** Planet-star separation (in stellar radii) at orbital angle theta (0 = mid-transit) and whether the planet is in front of the star. */
export const separation = (aRs: number, inclinationDeg: number, theta: number) => ({ z: aRs * Math.sqrt(Math.sin(theta) ** 2 + (Math.cos(rad(inclinationDeg)) * Math.cos(theta)) ** 2), front: Math.cos(theta) > 0 });
export type TransitInput = { radiusEarth: number; periodDays: number; inclinationDeg: number; noisePpm: number; star: { radiusSolar: number; massSolar: number }; samples?: number; seed?: number; u?: number };
export type TransitResult = { aAu: number; k: number; b: number; transits: boolean; depthPpm: number; durationH: number; reason: string; times: number[]; flux: number[] };
import { gauss, mulberry32 } from "./rng.ts";
export function simulateTransit(p: TransitInput): TransitResult {
  const a = semiMajorAxisAu(p.periodDays, p.star.massSolar), k = radiusRatio(p.radiusEarth, p.star.radiusSolar), b = impactParameter(a, p.star.radiusSolar, p.inclinationDeg), aRs = a / (p.star.radiusSolar * R_SUN_AU);
  const transits = b < 1 + k, dur = transitDurationHours(p.periodDays, a, p.star.radiusSolar, k, p.inclinationDeg), n = p.samples ?? 240, r = mulberry32(p.seed ?? 1);
  const halfWindow = Math.max(dur * 1.5, p.periodDays * 24 * 0.02) / 24;        // days either side of mid-transit
  const times = Array.from({ length: n }, (_, i) => -halfWindow + (2 * halfWindow * i) / (n - 1)), flux = times.map((t) => { const theta = (2 * Math.PI * t) / p.periodDays, s = separation(aRs, p.inclinationDeg, theta); return 1 - (s.front ? fluxDrop(k, s.z, p.u ?? 0.4) : 0) + (p.noisePpm ? (gauss(r) * p.noisePpm) / 1e6 : 0); });
  const depth = transits ? Math.round(fluxDrop(k, Math.min(b, 1 + k), p.u ?? 0.4) * 1e6) : 0;
  return { aAu: Math.round(a * 1e4) / 1e4, k, b: Math.round(b * 1000) / 1000, transits, depthPpm: depth, durationH: dur, reason: transits ? "" : `No transit: the orbit is tilted so the planet passes ${(b - 1 - k).toFixed(2)} stellar radii clear of the star's disk (impact parameter ${b.toFixed(2)} is above 1 + k = ${(1 + k).toFixed(2)}).`, times, flux };
}
// ---- spectra
export const MOLECULES: Record<string, { label: string; bands: { c: number; w: number; s: number }[]; color: string }> = {
  H2O: { label: "Water", bands: [{ c: 1.14, w: 0.04, s: 0.5 }, { c: 1.4, w: 0.06, s: 1 }, { c: 1.9, w: 0.08, s: 1 }, { c: 2.7, w: 0.15, s: 1.2 }], color: "#7B4DFF" },
  CO2: { label: "Carbon dioxide", bands: [{ c: 2.0, w: 0.04, s: 0.5 }, { c: 2.7, w: 0.1, s: 0.8 }, { c: 4.3, w: 0.12, s: 1.5 }], color: "#FF7A1A" },
  CH4: { label: "Methane", bands: [{ c: 2.3, w: 0.07, s: 0.6 }, { c: 3.3, w: 0.1, s: 1.2 }], color: "#EE3D8A" },
  O3: { label: "Ozone", bands: [{ c: 0.6, w: 0.05, s: 0.4 }, { c: 9.6, w: 0.3, s: 1.2 }], color: "#FFF4D9" },
  Na: { label: "Sodium", bands: [{ c: 0.589, w: 0.003, s: 2.0 }], color: "#FFB347" }, K: { label: "Potassium", bands: [{ c: 0.77, w: 0.004, s: 1.6 }], color: "#B28DFF" },
};
const KB = 1.380649e-23, AMU = 1.66054e-27, G = 6.674e-11, R_EARTH_M = 6.371e6, M_EARTH = 5.972e24;
export function surfaceGravity(massEarth: number, radiusEarth: number) { return (G * massEarth * M_EARTH) / (radiusEarth * R_EARTH_M) ** 2; }
/** Atmospheric scale height in km. */
export const scaleHeightKm = (teqK: number, meanMolecularMass: number, g: number) => (KB * teqK) / (meanMolecularMass * AMU * g) / 1000;
export type SpectrumInput = { radiusEarth: number; massEarth: number; teqK: number; starRadiusSolar: number; atmosphere: Record<string, number>; hydrogenRich: boolean };
/** Transmission depth (ppm) at each wavelength (micrometres): the planet's disk plus a few scale heights of atmosphere, scaled by band strength and abundance. */
export function transmissionSpectrum(p: SpectrumInput, wavelengths: number[]): number[] {
  const g = surfaceGravity(p.massEarth, p.radiusEarth), H = scaleHeightKm(p.teqK, p.hydrogenRich ? 2.3 : 28, g), rpKm = p.radiusEarth * 6371, rsKm = p.starRadiusSolar * 695700;
  return wavelengths.map((l) => { let tau = 0; for (const [m, ab] of Object.entries(p.atmosphere)) for (const b of MOLECULES[m]?.bands ?? []) tau += ab * b.s * Math.exp(-0.5 * ((l - b.c) / b.w) ** 2); const h = rpKm + H * (1 + 5 * Math.min(1.5, tau)); return Math.round((h / rsKm) ** 2 * 1e6 * 10) / 10; });
}
/** Which molecules stand out: a molecule is detected if the mean depth inside one of its bands exceeds the spectrum's median by `sigma` standard errors of that mean (noise / sqrt(samples in the band)). */
export function detectMolecules(spec: number[], wavelengths: number[], noisePpm: number, sigma = 3): { molecule: string; snr: number }[] {
  const sorted = [...spec].sort((a, b) => a - b), base = sorted[Math.floor(sorted.length / 2)], out: { molecule: string; snr: number }[] = [];
  for (const [m, def] of Object.entries(MOLECULES)) { let best = 0; for (const b of def.bands) { const inside = spec.filter((_, i) => Math.abs(wavelengths[i] - b.c) <= b.w); if (!inside.length) continue; const mean = inside.reduce((x, y) => x + y, 0) / inside.length; best = Math.max(best, ((mean - base) / Math.max(noisePpm, 1e-9)) * Math.sqrt(inside.length)); } if (best >= sigma) out.push({ molecule: m, snr: Math.round(best * 10) / 10 }); }
  return out.sort((a, b) => b.snr - a.snr);
}
export const wavelengthGrid = (lo = 0.5, hi = 5.5, n = 400) => Array.from({ length: n }, (_, i) => Math.round((lo * (hi / lo) ** (i / (n - 1))) * 10000) / 10000);
export function addNoise(spec: number[], noisePpm: number, seed = 3) { const r = mulberry32(seed); return spec.map((v) => Math.round((v + gauss(r) * noisePpm) * 10) / 10); }
// ---- visual scales (the scene is not to scale; these are the agreed mappings)
export const orbitRadiusUnits = (aAu: number) => 6 + 9 * Math.log10(1 + aAu / 0.03);
export const planetVisualRadius = (radiusEarth: number) => 0.35 + 0.28 * Math.sqrt(radiusEarth);
export const starVisualRadius = (radiusSolar: number) => 2 + 1.6 * Math.sqrt(radiusSolar);
export const starColor = (tempK: number): [number, number, number] => { const t = clamp((tempK - 2500) / 6000, 0, 1); return [1, 0.55 + 0.4 * t, 0.2 + 0.7 * t * t]; };
