"use client";
import { useMemo } from "react";
import { MOLECULES, addNoise, countsByYear, detectMolecules, equilibriumTemp, esi, habitableZone, inHabitableZone, insolation, luminosity, radiusRatio, semiMajorAxisAu, separation, simulateTransit, transmissionSpectrum, wavelengthGrid, R_SUN_AU } from "@nebula/domain";
import type { Planet, System } from "@nebula/schemas";
import { planetOf, type Data } from "../data";
import { set, state, useStore, VIEWS, type View } from "../store";
import { closeSystem, openSystem } from "./journey";

const go = (data: Data, v: View) => { if (v === state.view) return; if ((v === "transit" || v === "spectrum" || v === "habitability") && !state.opened) openSystem(data, state.sysId, state.planetId, v); if (v === "atlas" && state.opened) closeSystem(); if (v === "timeline" && state.opened) closeSystem(); set({ prevView: state.view, view: v }); history.replaceState(null, "", `#${v}`); };
const sys = (d: Data) => d.systems.find((x) => x.id === state.sysId)!;
const f1 = (n: number) => n.toFixed(1), n0 = (n: number) => Math.round(n).toLocaleString("en-US");
const labOf = (p: Planet, s: System, lab: typeof state.lab, on: boolean) => on ? { radiusEarth: lab.radiusEarth, periodDays: lab.periodDays, inclinationDeg: lab.inclinationDeg, noisePpm: lab.noisePpm } : { radiusEarth: p.radiusEarth, periodDays: p.periodDays, inclinationDeg: p.inclinationDeg, noisePpm: 150 };
const phase0 = (id: string) => (parseInt(id.slice(1), 10) * 2.399) % (Math.PI * 2);
const theta = (per: number, id: string, t: number) => (2 * Math.PI * t) / per + phase0(id);

export function LightCurve({ planet, star, lab, on, t }: { planet: Planet; star: System; lab: typeof state.lab; on: boolean; t: number }) {
  const q = labOf(planet, star, lab, on), r = useMemo(() => simulateTransit({ ...q, star, samples: 260, seed: 4 }), [q.radiusEarth, q.periodDays, q.inclinationDeg, q.noisePpm, star]); // eslint-disable-line react-hooks/exhaustive-deps
  const W = 440, H = 170, lo = Math.min(...r.flux), hi = Math.max(...r.flux), pad = Math.max((hi - lo) * 0.15, 2e-4), y0 = lo - pad, y1 = hi + pad, t0 = r.times[0], t1 = r.times.at(-1)!;
  const X = (x: number) => 40 + ((x - t0) / (t1 - t0)) * (W - 56), Y = (v: number) => H - 26 - ((v - y0) / (y1 - y0)) * (H - 44);
  let th = theta(q.periodDays, planet.id, t) % (2 * Math.PI); if (th > Math.PI) th -= 2 * Math.PI; if (th < -Math.PI) th += 2 * Math.PI; const rel = (th * q.periodDays) / (2 * Math.PI), inWin = rel >= t0 && rel <= t1, cx = X(Math.max(t0, Math.min(t1, rel)));
  return (<svg viewBox={`0 0 ${W} ${H}`} className="curve" role="img" aria-label={r.transits ? `Light curve: depth ${n0(r.depthPpm)} ppm, duration ${r.durationH} hours` : "Light curve: no transit"} data-testid="curve" data-transits={String(r.transits)}>
    {[0, 1, 2, 3].map((i) => { const v = y0 + ((y1 - y0) * i) / 3; return <g key={i}><line x1="40" x2={W - 16} y1={Y(v)} y2={Y(v)} className="grid" /><text x="2" y={Y(v) + 3} className="ax">{(v * 100).toFixed(2)}%</text></g>; })}
    <polyline points={r.flux.map((v, i) => `${X(r.times[i]).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")} fill="none" className="lc" />
    <line x1={cx} x2={cx} y1="8" y2={H - 26} className={`cur ${inWin ? "" : "edge"}`} data-testid="cursor" data-in={String(inWin)} /><text x={W / 2} y={H - 6} className="ax" textAnchor="middle">hours around mid-transit: {n0((t0 * 24))} to {n0(t1 * 24)}</text></svg>);
}
export function Observer({ planet, star, lab, on, t }: { planet: Planet; star: System; lab: typeof state.lab; on: boolean; t: number }) {
  const q = labOf(planet, star, lab, on), a = semiMajorAxisAu(q.periodDays, star.massSolar), aRs = a / (star.radiusSolar * R_SUN_AU), k = radiusRatio(q.radiusEarth, star.radiusSolar), th = theta(q.periodDays, planet.id, t), i = (q.inclinationDeg * Math.PI) / 180;
  const sep = separation(aRs, q.inclinationDeg, th), px = 56, x = 80 + aRs * Math.sin(th) * px, y = 80 - aRs * Math.cos(i) * Math.cos(th) * px, vis = sep.front && Math.abs(x - 80) < 150 && Math.abs(y - 80) < 150;
  return (<svg viewBox="0 0 160 160" className="observer" role="img" aria-label="The star as an observer sees it, with the planet in front when it transits" data-testid="observer" data-front={String(sep.front)} data-z={sep.z.toFixed(2)}>
    <defs><radialGradient id="sg"><stop offset="0" stopColor="#FFF4D9" /><stop offset=".7" stopColor="#FFB070" /><stop offset="1" stopColor="#FF7A1A" /></radialGradient></defs><rect width="160" height="160" fill="#06050A" />
    <circle cx="80" cy="80" r={px} fill="url(#sg)" />{vis && <circle cx={x} cy={y} r={Math.max(1.5, k * px)} fill="#06050A" stroke="#7B4DFF" strokeWidth=".5" />}<text x="6" y="152" className="ax">star disk and planet, from Earth</text></svg>);
}
function Spec({ a, b, mol, noise }: { a: { p: Planet; s: System }; b: { p: Planet; s: System }; mol: string[]; noise: number }) {
  const wl = useMemo(() => wavelengthGrid(0.5, 5.5, 360), []), mk = (x: { p: Planet; s: System }, seed: number) => { const clean = transmissionSpectrum({ radiusEarth: x.p.radiusEarth, massEarth: x.p.massEarth, teqK: x.p.equilibriumTempK, starRadiusSolar: x.s.radiusSolar, atmosphere: Object.fromEntries(Object.entries(x.p.atmosphere).filter(([m]) => mol.includes(m))), hydrogenRich: x.p.kind === "gas-giant" || x.p.kind === "ice" }, wl); return addNoise(clean, noise, seed); };
  const A = useMemo(() => mk(a, 3), [a.p.id, mol.join(), noise]), B = useMemo(() => mk(b, 5), [b.p.id, mol.join(), noise]); // eslint-disable-line react-hooks/exhaustive-deps
  const W = 440, H = 200, allv = [...A, ...B], lo = Math.min(...allv), hi = Math.max(...allv), X = (l: number) => 36 + (Math.log(l / 0.5) / Math.log(11)) * (W - 52), Y = (v: number) => H - 28 - ((v - lo) / (hi - lo || 1)) * (H - 46);
  const dA = detectMolecules(A, wl, Math.max(noise, 1)), dB = detectMolecules(B, wl, Math.max(noise, 1));
  return (<div><svg viewBox={`0 0 ${W} ${H}`} className="curve spec" role="img" aria-label={`Transmission spectra of ${a.p.name} and ${b.p.name}`} data-testid="spectrum">
    {mol.map((m) => MOLECULES[m].bands.map((bd, i) => <rect key={m + i} x={X(bd.c - bd.w * 2)} width={Math.max(2, X(bd.c + bd.w * 2) - X(bd.c - bd.w * 2))} y="6" height={H - 34} fill={MOLECULES[m].color} opacity=".18" />))}
    <polyline points={A.map((v, i) => `${X(wl[i]).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")} fill="none" className="lc a" /><polyline points={B.map((v, i) => `${X(wl[i]).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")} fill="none" className="lc b" />
    {[0.6, 1, 2, 3, 5].map((l) => <text key={l} x={X(l)} y={H - 8} className="ax" textAnchor="middle">{l} µm</text>)}</svg>
    <p className="legend"><i className="k a" /> {a.p.name} <i className="k b" /> {b.p.name}</p>
    <table className="tbl" data-testid="detections"><thead><tr><th>Detected at {Math.max(noise, 1)} ppm noise</th><th>{a.p.name}</th><th>{b.p.name}</th></tr></thead><tbody>{Object.keys(MOLECULES).map((m) => <tr key={m}><td>{MOLECULES[m].label}</td><td data-testid={`det-a-${m}`}>{dA.find((x) => x.molecule === m) ? `yes (${dA.find((x) => x.molecule === m)!.snr}σ)` : "no"}</td><td data-testid={`det-b-${m}`}>{dB.find((x) => x.molecule === m) ? `yes (${dB.find((x) => x.molecule === m)!.snr}σ)` : "no"}</td></tr>)}</tbody></table></div>);
}

function Atlas({ data }: { data: Data }) {
  const s = useStore(), sy = sys(data);
  return (<section aria-labelledby="h-atlas"><h2 id="h-atlas">Exoplanet Atlas</h2><p className="lede">Eight synthetic systems, 26 planets. Drag the sky to look around; choose a system and the camera travels there.</p>
    <ul className="list" data-testid="systems">{data.systems.map((x) => <li key={x.id}><button className={`row ${s.opened && s.sysId === x.id ? "on" : ""}`} onClick={() => openSystem(data, x.id)} data-testid={`sys-${x.id}`}><b>{x.name}</b><span>{x.spectralType} · {x.distanceLy} ly · {x.planets.length} planets</span></button></li>)}</ul>
    {s.opened && <><h3>{sy.name}</h3><ul className="list" data-testid="planets">{sy.planets.map((p) => <li key={p.id}><button className={`row ${s.planetId === p.id ? "on" : ""}`} onClick={() => set({ planetId: p.id, labOn: false, aOverride: null })} data-testid={`pl-${p.id}`}><b>{p.name}</b><span>{p.kind} · {p.radiusEarth} R⊕ · {p.periodDays} d · {p.equilibriumTempK} K</span></button></li>)}</ul><button className="btn ghost" onClick={closeSystem} data-testid="back-sky">Back to the sky</button></>}</section>);
}
function Transit({ data }: { data: Data }) {
  const s = useStore(), sy = sys(data), p = sy.planets.find((x) => x.id === s.planetId)!, q = labOf(p, sy, s.lab, s.labOn), r = simulateTransit({ ...q, star: sy, samples: 40 });
  const cur = s.labOn ? s.lab : { radiusEarth: p.radiusEarth, periodDays: p.periodDays, inclinationDeg: p.inclinationDeg, noisePpm: s.lab.noisePpm };
  const slider = (key: keyof typeof s.lab, label: string, min: number, max: number, step: number, unit: string) => (<label className="sl">{label}<input type="range" min={min} max={max} step={step} value={cur[key]} onChange={(e) => set({ labOn: true, lab: { ...cur, [key]: Number(e.target.value) } })} data-testid={`lab-${key}`} /><output>{cur[key]} {unit}</output></label>);
  const th = theta(q.periodDays, p.id, s.tDays), phase = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI);
  return (<section aria-labelledby="h-tr"><h2 id="h-tr">Transit Lab · {p.name}</h2>
    <div className="row2"><label>Planet <select value={p.id} onChange={(e) => set({ planetId: e.target.value, labOn: false })} data-testid="planet-select">{sy.planets.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="btn" onClick={() => set({ labOn: false, lab: { radiusEarth: p.radiusEarth, periodDays: p.periodDays, inclinationDeg: p.inclinationDeg, noisePpm: 150 } })} data-testid="lab-reset">Reset to the catalog values</button></div>
    <div className="duo"><LightCurve planet={p} star={sy} lab={s.lab} on={s.labOn} t={s.tDays} /><Observer planet={p} star={sy} lab={s.lab} on={s.labOn} t={s.tDays} /></div>
    <div className="row2"><button className="btn" onClick={() => set({ playing: !s.playing })} data-testid="play">{s.playing ? "Pause" : "Play"}</button><label className="sl">Orbital phase<input type="range" min={0} max={1} step={0.005} value={phase} onChange={(e) => set({ playing: false, tDays: ((Number(e.target.value) * 2 * Math.PI - phase0(p.id)) / (2 * Math.PI)) * q.periodDays })} data-testid="phase" /><output>{phase.toFixed(2)}</output></label></div>
    {slider("radiusEarth", "Radius", 0.5, 20, 0.1, "R⊕")}{slider("periodDays", "Period", 1, 400, 1, "d")}{slider("inclinationDeg", "Inclination", 80, 90, 0.05, "°")}{slider("noisePpm", "Noise", 0, 3000, 50, "ppm")}
    <dl className="spec"><div><dt>Depth</dt><dd data-testid="depth">{r.transits ? n0(r.depthPpm) + " ppm" : "none"}</dd></div><div><dt>Duration</dt><dd data-testid="duration">{r.transits ? r.durationH + " h" : "none"}</dd></div><div><dt>Impact parameter</dt><dd data-testid="impact">{r.b}</dd></div><div><dt>Semi-major axis</dt><dd>{r.aAu} AU</dd></div></dl>
    {!r.transits && <p className="note" role="status" data-testid="no-transit">{r.reason}</p>}</section>);
}
function Spectrum({ data }: { data: Data }) {
  const s = useStore(), all = data.systems.flatMap((x) => x.planets.map((p) => ({ p, s: x }))), A = planetOf(data, s.specA)!, B = planetOf(data, s.specB)!;
  const sel = (key: "specA" | "specB", v: string) => (<select value={v} onChange={(e) => set({ [key]: e.target.value } as never)} data-testid={key}>{all.map(({ p }) => <option key={p.id} value={p.id}>{p.name} ({p.kind})</option>)}</select>);
  return (<section aria-labelledby="h-sp"><h2 id="h-sp">Spectrum Explorer</h2><p className="lede">Transmission spectra from a few scale heights of atmosphere. Toggle a molecule to show its bands; raise the noise and weak ones drop below detection.</p>
    <div className="row2"><label>A {sel("specA", s.specA)}</label><label>B {sel("specB", s.specB)}</label></div>
    <div className="chips" role="group" aria-label="Molecules">{Object.entries(MOLECULES).map(([m, d]) => <label key={m} className={s.molecules.includes(m) ? "on" : ""} style={{ ["--c" as string]: d.color }}><input type="checkbox" checked={s.molecules.includes(m)} onChange={(e) => set({ molecules: e.target.checked ? [...s.molecules, m] : s.molecules.filter((x) => x !== m) })} data-testid={`mol-${m}`} />{d.label}</label>)}</div>
    <Spec a={A} b={B} mol={s.molecules} noise={s.specNoise} /><label className="sl">Noise<input type="range" min={5} max={1500} step={5} value={s.specNoise} onChange={(e) => set({ specNoise: Number(e.target.value) })} data-testid="spec-noise" /><output>{s.specNoise} ppm</output></label></section>);
}
function Habit({ data }: { data: Data }) {
  const s = useStore(), sy = sys(data), lum = luminosity(sy.radiusSolar, sy.temperatureK), hz = habitableZone(lum), p = sy.planets.find((x) => x.id === s.planetId)!, a = s.aOverride ?? p.semiMajorAxisAu;
  const row = (pl: Planet, st: System, aa?: number) => { const A = aa ?? pl.semiMajorAxisAu, L = luminosity(st.radiusSolar, st.temperatureK), teq = equilibriumTemp(st.temperatureK, st.radiusSolar, A), S = insolation(L, A); return { pl, st, teq: Math.round(teq), S: Math.round(S * 100) / 100, esi: esi(pl.radiusEarth, teq, S), hz: inHabitableZone(L, A) }; };
  const rows = s.compare.map((id) => planetOf(data, id)).filter(Boolean).map((x) => row(x!.p, x!.s, x!.p.id === s.planetId && s.aOverride !== null ? s.aOverride : undefined));
  const lo = Math.log10(0.02), hi = Math.log10(8), X = (v: number) => 20 + ((Math.log10(v) - lo) / (hi - lo)) * 400, cur = row(p, sy, a);
  return (<section aria-labelledby="h-hz"><h2 id="h-hz">Habitability · {sy.name}</h2><p className="lede">The conservative habitable zone is the band where a planet receives between 0.36 and 1.1 times Earth's starlight. Slide {p.name}'s orbit and watch its temperature, light and similarity to Earth change.</p>
    <svg viewBox="0 0 440 90" className="curve hz" role="img" aria-label={`Habitable zone of ${sy.name} from ${hz.inner.toFixed(2)} to ${hz.outer.toFixed(2)} AU, ${p.name} at ${a.toFixed(3)} AU`} data-testid="hz-diagram"><rect x={X(hz.inner)} width={X(hz.outer) - X(hz.inner)} y="14" height="40" fill="#55d98a" opacity=".22" />{sy.planets.map((q) => <circle key={q.id} cx={X(q.semiMajorAxisAu)} cy="34" r={q.id === p.id ? 0 : 4} fill="#7B4DFF" />)}<circle cx={X(a)} cy="34" r="6" fill={cur.hz ? "#55d98a" : "#FF7A1A"} stroke="#FFF4D9" data-testid="hz-dot" />{[0.05, 0.1, 0.3, 1, 3].map((v) => <text key={v} x={X(v)} y="76" className="ax" textAnchor="middle">{v} AU</text>)}</svg>
    <label className="sl">{p.name} at<input type="range" min={0} max={100} value={((Math.log10(a) - lo) / (hi - lo)) * 100} onChange={(e) => set({ aOverride: 10 ** (lo + (Number(e.target.value) / 100) * (hi - lo)) })} data-testid="a-slider" /><output data-testid="a-out">{a.toFixed(3)} AU</output></label><div className="row2"><button className="btn" onClick={() => set({ aOverride: (hz.inner + hz.outer) / 2 })} data-testid="to-hz">Move into the habitable zone</button><button className="btn" onClick={() => set({ aOverride: hz.outer * 2.5 })} data-testid="out-hz">Move out</button><button className="btn ghost" onClick={() => set({ aOverride: null })}>Reset</button></div>
    <dl className="spec"><div><dt>Equilibrium temperature</dt><dd data-testid="teq">{cur.teq} K</dd></div><div><dt>Light vs Earth</dt><dd data-testid="flux">{cur.S}×</dd></div><div><dt>Earth similarity</dt><dd data-testid="esi">{cur.esi}</dd></div><div><dt>In the zone</dt><dd data-testid="inhz">{cur.hz ? "yes" : "no"}</dd></div></dl>
    <h3>Compare</h3><div className="row2"><label>Add <select value="" onChange={(e) => { if (e.target.value && s.compare.length < 4 && !s.compare.includes(e.target.value)) set({ compare: [...s.compare, e.target.value] }); }} data-testid="add-compare"><option value="">choose a world</option>{data.systems.flatMap((x) => x.planets).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select></label></div>
    <table className="tbl" data-testid="compare"><thead><tr><th>World</th><th>R⊕</th><th>T K</th><th>Light</th><th>ESI</th><th>HZ</th><th></th></tr></thead><tbody>{rows.map((r) => <tr key={r.pl.id}><td>{r.pl.name}</td><td>{r.pl.radiusEarth}</td><td>{r.teq}</td><td>{r.S}×</td><td data-testid={`esi-${r.pl.id}`}>{r.esi}</td><td>{r.hz ? "yes" : "no"}</td><td><button className="link" onClick={() => set({ compare: s.compare.filter((x) => x !== r.pl.id) })} aria-label={`Remove ${r.pl.name}`}>×</button></td></tr>)}</tbody></table></section>);
}
function Timeline({ data }: { data: Data }) {
  const s = useStore(), counts = useMemo(() => countsByYear(data.catalog), [data]), yr = Math.round(s.year), shown = data.catalog.filter((c) => c.year <= yr), max = Math.max(...counts.map((c) => c.count)), top = data.catalog.filter((c) => c.year === yr).sort((a, b) => b.radiusEarth - a.radiusEarth).slice(0, 5);
  return (<section aria-labelledby="h-tl"><h2 id="h-tl">Discovery timeline</h2><p className="lede">{data.catalog.length} background discoveries (synthetic) plus the eight systems. The sky behind this panel shows the ones found by the year you choose; the count follows a slow start, a survey wave and a steady tail.</p>
    <div className="yearrow"><output className="yr" data-testid="year-out">{yr}</output><button className="btn" onClick={() => set({ year: s.year >= 2026 ? 1995 : s.year, yearPlaying: !s.yearPlaying })} data-testid="year-play">{s.yearPlaying ? "Pause" : "Play"}</button></div>
    <input type="range" min={1995} max={2026} step={1} value={yr} onChange={(e) => set({ year: Number(e.target.value), yearPlaying: false })} data-testid="year" aria-label="Year" />
    <svg viewBox="0 0 440 110" className="curve bars" role="img" aria-label="Discoveries per year" data-testid="bars">{counts.map((c, i) => <rect key={c.year} x={20 + i * 12.6} width="9" y={96 - (c.count / max) * 80} height={(c.count / max) * 80} fill={c.year <= yr ? "#EE3D8A" : "#25242C"} opacity={c.year === yr ? 1 : 0.7} />)}{[1995, 2005, 2015, 2025].map((y) => <text key={y} x={20 + (y - 1995) * 12.6 + 4} y="108" className="ax" textAnchor="middle">{y}</text>)}</svg>
    <dl className="spec"><div><dt>Found by {yr}</dt><dd data-testid="found">{shown.length}</dd></div><div><dt>Found in {yr}</dt><dd data-testid="found-year">{counts.find((c) => c.year === yr)!.count}</dd></div></dl>
    <h3>Largest found in {yr}</h3><ul className="list">{top.length ? top.map((c, i) => <li key={i} className="faint">{c.radiusEarth} R⊕, {c.periodDays} day orbit, star {c.tempK} K</li>) : <li className="faint">None in the synthetic catalog.</li>}</ul></section>);
}
export default function Panels({ data }: { data: Data }) {
  const s = useStore(), idx = VIEWS.findIndex((v) => v.id === s.view), V = s.view;
  return (
    <div className="ui" data-testid="hud">
      <header className="top"><span className="brand">NEBULA</span><span className="rule" aria-hidden />{s.opened && <span className="where" data-testid="where">{sys(data).name} · {data.systems.find((x) => x.id === s.sysId)!.planets.find((p) => p.id === s.planetId)!.name}</span>}<button className="btn ghost" aria-pressed={s.pauseMotion} onClick={() => set({ pauseMotion: !s.pauseMotion })} data-testid="pause-motion">{s.pauseMotion ? "Resume motion" : "Pause motion"}</button></header>
      <nav className="rail" aria-label="Instruments">{VIEWS.map((v, i) => <button key={v.id} className={i === idx ? "on" : ""} aria-current={i === idx ? "page" : undefined} onClick={() => go(data, v.id)} data-testid={`nav-${v.id}`}><b>{v.label}</b><small>{v.blurb}</small></button>)}</nav>
      <main className={`panel ${s.reduced ? "" : "enter"}`} key={V} tabIndex={-1}>{V === "atlas" && <Atlas data={data} />}{V === "transit" && <Transit data={data} />}{V === "spectrum" && <Spectrum data={data} />}{V === "habitability" && <Habit data={data} />}{V === "timeline" && <Timeline data={data} />}</main>
    </div>
  );
}
