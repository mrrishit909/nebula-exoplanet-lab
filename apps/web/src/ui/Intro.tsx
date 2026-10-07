"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { MOLECULES, mulberry32, gauss } from "@nebula/domain";
import type { Data } from "../data";
import { introBrightness } from "../scene/Scene";
import { live, set, state, useStore } from "../store";

// Steps (blueprint section 3): 0 a lone star, 1 a planet crosses the disk and the curve is drawn, 2 observations accumulate and the orbit and size appear, 3 the spectrum spreads into absorption lines,
// 4 the line, 5 the planet expands toward the camera, its atmosphere fills the frame and dissolves into the navigation. The planet is NEB-017 c; the readouts are its real catalog values.
export default function Intro({ data }: { data: Data }) {
  const s = useStore(), tl = useRef<gsap.core.Timeline | null>(null), [trace, setTrace] = useState<[number, number][]>([]), [dots, setDots] = useState<[number, number][]>([]), [lines, setLines] = useState(0), [txt, setTxt] = useState(false), [cap, setCap] = useState(""), [readout, setReadout] = useState(0);
  const pl = data.systems[0].planets[1], atm = Object.keys(pl.atmosphere), root = document.documentElement;
  const finish = () => { tl.current?.kill(); Object.assign(live, { introOrbit: 0, atm: 0, haze: 0, introPlanet: 0, journey: 1 }); root.style.setProperty("--mask", "200%"); root.style.setProperty("--haze", "0"); set({ introFx: false, introStep: 99, ...(state.introDone ? {} : { introDone: true, opened: true, sysId: "s1", planetId: "p2", view: "atlas" as const }) }); setTxt(false); }; // once the navigation is live the visitor may already have moved: never overwrite their choices
  useEffect(() => {
    if (state.reduced) return; gsap.ticker.lagSmoothing(0);
    const sp = data.systems[0].pos; Object.assign(live, { introOrbit: -9, introK: 0, introPlanet: 0, atm: 0, haze: 0 }); live.cam.set(sp[0], sp[1], sp[2] + 26); live.look.set(...sp); root.style.setProperty("--mask", "0%"); root.style.setProperty("--haze", "0");
    const t = gsap.timeline({ defaults: { ease: "power1.inOut" }, onComplete: finish }); tl.current = t; const step = (n: number, c = "") => () => { set({ introStep: n }); setCap(c); }, r = mulberry32(3), samples: [number, number][] = [];
    t.call(step(0, "One star, in the dark."), [], 0)
      .call(step(1, "A planet crosses its face. The star dims, almost imperceptibly."), [], 2).set(live, { introOrbit: -1.6 }, 2)
      .to(live, { introOrbit: Math.PI * 2 + 1.6, duration: 3.4, ease: "none", onUpdate: () => { samples.push([live.introOrbit, introBrightness(live.introOrbit)]); if (samples.length % 3 === 0) setTrace(samples.slice()); } }, 2)
      .call(step(2, "The event repeats. Each pass adds a point."), [], 5.6).to(live, { introK: 1, duration: 3.2, ease: "none" }, 5.6).to(live.cam, { z: data.systems[0].pos[2] + 36, duration: 3.4 }, 5.6)
      .to({ n: 0 }, { n: 64, duration: 3.2, ease: "none", onUpdate() { const n = Math.round((this.targets()[0] as { n: number }).n); const arr: [number, number][] = []; for (let i = 0; i < n; i++) { const ph = (((i * 0.6180339 + 0.05) % 1) - 0.5) * 0.9, f = 1 - (Math.abs(ph) < 0.18 ? 0.07 * (1 - (ph / 0.18) ** 2) : 0) + gauss(mulberry32(i + 11)) * 0.006; arr.push([ph, f]); } setDots(arr); setReadout(Math.min(2, Math.floor(n / 22))); } }, 5.6)
      .to(live, { introOrbit: Math.PI * 2 * 2.2, duration: 3.2, ease: "none" }, 5.6)
      .call(step(3, "Starlight through its air: some colours are missing."), [], 9.2).to({ l: 0 }, { l: atm.length, duration: 2.8, ease: "none", onUpdate() { setLines(Math.ceil((this.targets()[0] as { l: number }).l)); } }, 9.4)
      .call(() => { set({ introStep: 4 }); setCap(""); setTxt(true); }, [], 13)
      .call(() => { set({ introStep: 5 }); setTxt(false); setCap(""); }, [], 15.6)
      .to(live, { introOrbit: Math.PI * 2 * 3, duration: 1.4, ease: "power2.out" }, 14.4)
      .to(live, { introPlanet: 1, atm: 0, duration: 4.4, ease: "power2.in" }, 15.6).to(live.cam, { x: sp[0] + 0.6, y: sp[1] + 1.6, z: sp[2] + 9 + 7.8, duration: 4.6, ease: "power2.inOut" }, 15.6).to(live.look, { x: sp[0], y: sp[1] + 0.5, z: sp[2] + 9, duration: 4.6 }, 15.6)
      .to(live, { atm: 1, duration: 3, ease: "power1.in" }, 17.2).to({ h: 0 }, { h: 1, duration: 2.2, ease: "power1.in", onUpdate() { root.style.setProperty("--haze", String((this.targets()[0] as { h: number }).h)); } }, 18)
      .call(() => { set({ introDone: true, introFx: true, introStep: 99, opened: true, sysId: "s1", planetId: "p2", view: "atlas" }); live.journey = 1; Object.assign(live, { introPlanet: 0, atm: 0 }); }, [], 20.4)
      .to({ m: 0 }, { m: 160, duration: 2.4, ease: "power2.inOut", onUpdate() { root.style.setProperty("--mask", `${(this.targets()[0] as { m: number }).m}%`); } }, 20.4)
      .to({ h: 1 }, { h: 0, duration: 2.0, onUpdate() { root.style.setProperty("--haze", String((this.targets()[0] as { h: number }).h)); } }, 20.8);
    void r; return () => { if (!state.introDone) t.kill(); }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const skip = () => { const tt = tl.current; if (tt && tt.time() < 15.5) tt.seek(15.6); else finish(); };
  if (s.introDone && !s.introFx) return null;
  if (s.reduced) { const fr = [["A lone star", "One point of light in the dark."], ["A shadow", "A planet crosses it and the star dims by a hair."], ["The curve", "Each pass adds a point: period, size and orbit appear."], ["The spectrum", "Starlight through its air has colours missing."], ["Discover worlds from their shadows", "Enter the atlas."]];
    return (<div className="intro intro-static" role="dialog" aria-label="Opening story" data-testid="intro"><ol>{fr.map(([a, b], i) => <li key={i}><b>{a}</b> {b}</li>)}</ol><button className="btn primary" onClick={finish} data-testid="skip-intro">Enter the atlas</button></div>); }
  const W = 360, H = 90, tx = (th: number) => 10 + ((th + 1.6) / (Math.PI * 2 + 3.2)) * (W - 20), ty = (f: number) => H - 10 - ((f - 0.9) / 0.12) * (H - 20);
  return (<div className={`intro ${s.introDone ? "fx" : ""}`} data-testid="intro" data-step={s.introStep}>
    {s.introStep >= 1 && s.introStep <= 2 && <svg className="trace" viewBox={`0 0 ${W} ${H}`} aria-hidden>{s.introStep === 1 && <polyline points={trace.map(([th, f]) => `${tx(th)},${ty(f)}`).join(" ")} fill="none" />}{s.introStep === 2 && dots.map(([ph, f], i) => <circle key={i} cx={W / 2 + ph * (W - 40)} cy={ty(f)} r="1.8" />)}</svg>}
    {s.introStep === 2 && <div className="readouts" aria-live="off"><span className={readout >= 1 ? "on" : ""}>P = {data.systems[0].planets[1].periodDays} d</span><span className={readout >= 2 ? "on" : ""}>R = {data.systems[0].planets[1].radiusEarth} R⊕</span></div>}
    {s.introStep === 3 && <div className="strip" aria-hidden><i />{atm.slice(0, lines).map((m, k) => <b key={m} style={{ left: `${[22, 40, 58, 74, 86, 30][k % 6]}%`, background: MOLECULES[m]?.color ?? "#fff" }}><em>{MOLECULES[m]?.label ?? m}</em></b>)}</div>}
    {txt && <h1 className="statement" data-testid="statement">Discover worlds from their shadows.</h1>}<p className="caption" role="status">{cap}</p><div className="haze" aria-hidden />{!s.introDone && <button className="btn skip" onClick={skip} data-testid="skip-intro" autoFocus>Skip intro</button>}</div>);
}
