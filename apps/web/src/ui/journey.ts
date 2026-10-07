import gsap from "gsap";
import type { Data } from "../data";
import { live, set, state } from "../store";
/** Selecting a system is a camera journey: the camera arcs from where it is to the system's overview position. */
export const overviewOffset = (view: string): [number, number, number] => view === "habitability" ? [0, 46, 14] : view === "transit" ? [24, 7, 30] : [16, 12, 34];
export function openSystem(data: Data, id: string, planetId?: string, view: "atlas" | "transit" | "spectrum" | "habitability" = "atlas") {
  const s = data.systems.find((x) => x.id === id)!, off = overviewOffset(view === "atlas" ? "atlas" : view);
  live.jFrom.set(live.cam.x, live.cam.y, live.cam.z); live.jTo.set(s.pos[0] + off[0], s.pos[1] + off[1], s.pos[2] + off[2]); live.jLook.set(...s.pos);
  set({ sysId: id, planetId: planetId ?? s.planets[0].id, opened: true, labOn: false, aOverride: null });
  if (state.reduced) { live.journey = 1; return; }
  live.journey = 0; gsap.to(live, { journey: 1, duration: 2.4, ease: "power2.inOut" });
}
export function closeSystem() { set({ opened: false, labOn: false, aOverride: null }); live.jFrom.copy(live.cam); live.jTo.set(0, 0, 0); live.journey = state.reduced ? 1 : 0; if (!state.reduced) gsap.to(live, { journey: 1, duration: 1.8, ease: "power2.inOut" }); }
