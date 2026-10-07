"use client";
import { useEffect, useState } from "react";
import { loadData, base, type Data } from "./data";
import { live, set, state, useStore, VIEWS } from "./store";
import Intro from "./ui/Intro";
import Panels from "./ui/Panels";
import Scene from "./scene/Scene";
const webglOk = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
export default function App() {
  const s = useStore(); const [data, setData] = useState<Data | null>(null); const [err, setErr] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(location.search), rm = matchMedia("(prefers-reduced-motion: reduce)").matches || q.get("motion") === "reduced", view = VIEWS.find((v) => v.id === q.get("view"))?.id, skip = q.get("skip") === "1" || !!view;
    const year = Number(q.get("year"));
    loadData().then((d) => { const sys = d.systems.find((x) => x.id === q.get("system")) ?? d.systems[0], pl = sys.planets.find((x) => x.id === q.get("planet")) ?? (sys.id === "s1" ? sys.planets[1] : sys.planets[0]);
      const needsSystem = view === "transit" || view === "spectrum" || view === "habitability" || !!q.get("system");
      set({ reduced: rm, pauseMotion: rm, gfx: q.get("gfx") === "off" || !webglOk() ? "poster" : "webgl", sysId: sys.id, planetId: pl.id, opened: needsSystem, ...(view ? { view } : {}), ...(Number.isFinite(year) && q.get("year") ? { year: Math.max(1995, Math.min(2026, year)) } : {}), ...(skip ? { introDone: true, introStep: 99 } : {}) });
      if (skip) { document.documentElement.style.setProperty("--mask", "200%"); live.yearSmooth = state.year; live.journey = 1; const off = view === "habitability" ? [0, 46, 14] : view === "transit" ? [24, 7, 30] : [16, 12, 34]; if (needsSystem) live.cam.set(sys.pos[0] + off[0], sys.pos[1] + off[1], sys.pos[2] + off[2]); }
      setData(d); }).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => { const f = () => { const v = VIEWS.find((x) => x.id === location.hash.slice(1)); if (v && v.id !== state.view && state.introDone) set({ prevView: state.view, view: v.id }); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  if (err) return <div className="boot" role="alert">Could not load data: {err}</div>;
  if (!data) return <div className="boot" role="status">Pointing the telescope…</div>;
  return (
    <div className="app" data-view={s.view} data-intro={s.introDone ? "done" : "running"} data-gfx={s.gfx} data-opened={String(s.opened)}>
      {s.gfx === "webgl" ? <Scene data={data} /> : <div className="poster" style={{ backgroundImage: `url(${base}/posters/planets.png)` }} role="img" aria-label="Still of six planet types in a row: rocky, ocean, ringed gas giant, lava, ice and super-Earth" data-testid="poster" />}
      <div className="vignette" aria-hidden /><Panels data={data} />{(!s.introDone || s.introFx) && <Intro data={data} />}
    </div>
  );
}
