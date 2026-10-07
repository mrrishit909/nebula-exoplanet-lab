import { useSyncExternalStore } from "react";
import { Vector3 } from "three";
export type View = "atlas" | "transit" | "spectrum" | "habitability" | "timeline";
export const VIEWS: { id: View; label: string; blurb: string }[] = [
  { id: "atlas", label: "Atlas", blurb: "Star systems in space" }, { id: "transit", label: "Transit Lab", blurb: "Radius, period, tilt, noise" }, { id: "spectrum", label: "Spectrum", blurb: "Molecules in the light" },
  { id: "habitability", label: "Habitability", blurb: "Compare worlds" }, { id: "timeline", label: "Discoveries", blurb: "A wave through time" },
];
export type Lab = { radiusEarth: number; periodDays: number; inclinationDeg: number; noisePpm: number };
export type State = { view: View; prevView: View; sysId: string; planetId: string; opened: boolean; lab: Lab; labOn: boolean; tDays: number; playing: boolean; year: number; yearPlaying: boolean; compare: string[]; specA: string; specB: string; molecules: string[]; specNoise: number; aOverride: number | null; introDone: boolean; introFx: boolean; introStep: number; reduced: boolean; pauseMotion: boolean; gfx: "webgl" | "poster" };
export const state: State = { view: "atlas", prevView: "atlas", sysId: "s1", planetId: "p2", opened: false, lab: { radiusEarth: 1.9, periodDays: 11.6, inclinationDeg: 89.6, noisePpm: 150 }, labOn: false, tDays: 0, playing: true, year: 2026, yearPlaying: false, compare: ["p2", "p6", "p14"], specA: "p3", specB: "p2", molecules: ["H2O", "CO2", "CH4", "O3", "Na", "K"], specNoise: 25, aOverride: null, introDone: false, introFx: false, introStep: 0, reduced: false, pauseMotion: false, gfx: "webgl" };
/** Per-frame values the intro and the camera read; not reactive. */
export const live = { cam: new Vector3(0, 0, 60), look: new Vector3(0, 0, 0), yaw: 0.4, pitch: 0.1, journey: 1, jFrom: new Vector3(), jTo: new Vector3(), jLook: new Vector3(), yearSmooth: 2026, introT: 0, introK: 0, introPlanet: 0, atm: 0, haze: 0, starDim: 1, introOrbit: 0, planetScreen: [0.5, 0.5] as [number, number], mask: 1 };
let snap = { ...state }; const subs = new Set<() => void>();
export function set(p: Partial<State>) { Object.assign(state, p); snap = { ...state }; subs.forEach((f) => f()); }
export const useStore = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => snap, () => snap);
