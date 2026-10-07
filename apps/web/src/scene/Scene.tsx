"use client";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { equilibriumTemp, fluxDrop, habitableZone, luminosity, mulberry32, orbitRadiusUnits, planetVisualRadius, radiusRatio, semiMajorAxisAu, separation, starColor, starVisualRadius, R_SUN_AU } from "@nebula/domain";
import type { Planet, System } from "@nebula/schemas";
import type { Data } from "../data";
import { base } from "../data";
import { live, set, state, useStore } from "../store";
import { atmosphereMaterial, kindIndex, planetMaterial, starMaterial } from "./shaders";
import { openSystem } from "../ui/journey";

const ATM: Record<string, string> = { rocky: "#E8A070", ocean: "#6FA8FF", "gas-giant": "#F0D8A0", lava: "#FF6A2A", ice: "#B0E0FF", "super-earth": "#9CD0B0" };
const BASE_R: Record<string, number> = { rocky: 1, ocean: 1, "gas-giant": 2.6, lava: 0.9, ice: 1.3, "super-earth": 1.55 };
const seen: Record<string, number> = {};
export const orbitPoint = (R: number, incDeg: number, theta: number): [number, number, number] => { const i = (incDeg * Math.PI) / 180; return [R * Math.sin(theta), R * Math.cos(i) * Math.cos(theta), R * Math.sin(i) * Math.cos(theta)]; };
const phase0 = (id: string) => (parseInt(id.slice(1), 10) * 2.399) % (Math.PI * 2);

function Sky({ data }: { data: Data }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uYear: { value: 2026 }, uTime: { value: 0 }, uAll: { value: 0 } },
    vertexShader: `attribute float aYear; attribute float aSize; attribute vec3 aCol; uniform float uYear, uTime, uAll; varying float vA; varying vec3 vC; void main(){ float vis = clamp(uYear - aYear + 0.6, 0.0, 1.0); vA = mix(vis, 0.35, uAll * step(5000.0, aYear)); vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * (320.0 / -mv.z) * (0.4 + 0.6 * vis) + 1.0; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vC, (1.0 - r * 2.0) * vA); }` }), []);
  const geo = useMemo(() => { const r = mulberry32(8), n = data.catalog.length + 1400, pos = new Float32Array(n * 3), yr = new Float32Array(n), sz = new Float32Array(n), col = new Float32Array(n * 3); data.catalog.forEach((c, i) => { pos.set(c.pos, i * 3); yr[i] = c.year; sz[i] = 2.2 + Math.min(3, c.radiusEarth * 0.25); const k = starColor(c.tempK); col.set(k, i * 3); });
    for (let i = data.catalog.length; i < n; i++) { const th = r() * 6.283, ph = Math.acos(2 * r() - 1), d = 600 + r() * 600; pos.set([d * Math.sin(ph) * Math.cos(th), d * Math.cos(ph), d * Math.sin(ph) * Math.sin(th)], i * 3); yr[i] = 9000; sz[i] = 1 + r() * 1.5; const t = 0.6 + r() * 0.4; col.set([t, t, 1], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aYear", new THREE.BufferAttribute(yr, 1)); g.setAttribute("aSize", new THREE.BufferAttribute(sz, 1)); g.setAttribute("aCol", new THREE.BufferAttribute(col, 3)); return g; }, [data]);
  useFrame((st) => { live.yearSmooth += (state.year - live.yearSmooth) * 0.08; mat.uniforms.uYear.value = state.introDone ? live.yearSmooth : 2026; mat.uniforms.uTime.value = st.clock.elapsedTime; });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-1} />;
}

function Markers({ data }: { data: Data }) {
  const refs = useRef<Record<string, THREE.Group | null>>({}); useFrame(() => { for (const s of data.systems) { const g = refs.current[s.id]; if (g) g.visible = !(state.opened && s.id === state.sysId) && !(!state.introDone && s.id === "s1"); } });
  return (<>{data.systems.map((s) => { const [r, g, b] = starColor(s.temperatureK); return (
    <group key={s.id} ref={(o) => { refs.current[s.id] = o; }} position={s.pos}><mesh><sphereGeometry args={[1.6, 12, 10]} /><meshBasicMaterial color={new THREE.Color(r, g, b)} /></mesh>
      <mesh onPointerDown={(e) => { if (state.introDone && !state.opened) { e.stopPropagation(); openSystem(data, s.id); } }} onPointerOver={() => (document.body.style.cursor = state.opened ? "" : "pointer")} onPointerOut={() => (document.body.style.cursor = "")}><sphereGeometry args={[9, 8, 6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh></group>); })}</>);
}

function PlanetBody({ planet, star, gltf, selected }: { planet: Planet; star: System; gltf: THREE.Group; selected: boolean }) {
  const g = useRef<THREE.Group>(null), pivot = useRef<THREE.Group>(null);
  const { surf, atm, ring, pm, am } = useMemo(() => {
    const src = gltf.getObjectByName(`Pivot_${planet.kind}`)!, tilt = src.rotation.x, pm = planetMaterial(), am = atmosphereMaterial(); pm.uniforms.uKind.value = kindIndex(planet.kind); pm.uniforms.uSeed.value = parseInt(planet.id.slice(1), 10); am.uniforms.uColor.value.set(ATM[planet.kind]);
    const mk = (n: string, m: THREE.Material | null) => { const o = gltf.getObjectByName(n) as THREE.Mesh | undefined; if (!o) return null; const c = new THREE.Mesh(o.geometry, m ?? (o.material as THREE.Material)); c.rotation.set(0, 0, 0); return c; };
    const surf = mk(`Planet_${planet.kind}`, pm)!, atm = mk(`Atmosphere_${planet.kind}`, am), ring = planet.kind === "gas-giant" ? mk("GasGiant_Ring", null) : null;
    [surf, atm, ring].forEach((o) => o && o.rotateX(-Math.PI / 2)); void tilt; return { surf, atm, ring, pm, am };
  }, [gltf, planet]);
  useFrame((st) => {
    const s = state, intro = !s.introDone, isLab = s.labOn && s.planetId === planet.id, radius = isLab ? s.lab.radiusEarth : planet.radiusEarth, per = isLab ? s.lab.periodDays : planet.periodDays, inc = isLab ? s.lab.inclinationDeg : planet.inclinationDeg;
    const a = isLab ? semiMajorAxisAu(per, star.massSolar) : s.aOverride !== null && s.planetId === planet.id ? s.aOverride : planet.semiMajorAxisAu, R = orbitRadiusUnits(a), teq = equilibriumTemp(star.temperatureK, star.radiusSolar, a);
    const sc = (planetVisualRadius(radius) / BASE_R[planet.kind]) * (intro ? 1 + live.introPlanet * 6 : 1); const grp = g.current!;
    if (intro) { const p = introPlanetPos(); grp.position.set(...p); grp.visible = planet.id === "p2" && live.introOrbit > -5; }
    else { const th = (2 * Math.PI * s.tDays) / per + phase0(planet.id); grp.position.set(...orbitPoint(R, inc, th)); grp.visible = true; }
    grp.scale.setScalar(sc); pm.uniforms.uTemp.value = teq; pm.uniforms.uTime.value = s.pauseMotion ? 0 : st.clock.elapsedTime; const toStar = new THREE.Vector3().copy(grp.position).negate().normalize(); pm.uniforms.uSun.value.copy(toStar); am.uniforms.uSun.value.copy(toStar);
    am.uniforms.uAmount.value = (intro ? 1 + live.atm * 7 : 1) * (selected ? 1.2 : 1); am.uniforms.uPower.value = intro ? 3 - live.atm * 1.8 : 3; if (pivot.current) { pivot.current.rotation.y += s.pauseMotion ? 0 : 0.002; pivot.current.rotation.z = (planet.kind === "ice" ? 1.7 : 0.3); }
  });
  return <group ref={g}><group ref={pivot}><primitive object={surf} />{atm && <primitive object={atm} />}{ring && <primitive object={ring} />}</group></group>;
}
export const introPlanetPos = (): [number, number, number] => { const th = live.introOrbit; return [Math.sin(th) * 9, 0.55 * Math.cos(th), Math.cos(th) * 9]; };
/** Star brightness during the intro: the planet (visual radius 0.74 against a star of 4.5) in front of the disk, three times exaggerated so the dip can be seen. */
export const introBrightness = (th: number) => 1 - (Math.cos(th) > 0 ? fluxDrop(0.74 / 4.5, (Math.abs(Math.sin(th)) * 9) / 4.5) * 3 : 0);

function OrbitLine({ planet, star, selected }: { planet: Planet; star: System; selected: boolean }) {
  const N = 180, line = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3)); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#7B4DFF", transparent: true, opacity: 0.55 })); }, []);
  useFrame((_, dt) => {
    const s = state, isLab = s.labOn && s.planetId === planet.id, per = isLab ? s.lab.periodDays : planet.periodDays, inc = isLab ? s.lab.inclinationDeg : planet.inclinationDeg, a = isLab ? semiMajorAxisAu(per, star.massSolar) : s.aOverride !== null && s.planetId === planet.id ? s.aOverride : planet.semiMajorAxisAu;
    const R = orbitRadiusUnits(a), p = line.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i <= N; i++) { const q = orbitPoint(R, inc, (i / N) * Math.PI * 2); p.setXYZ(i, ...q); } p.needsUpdate = true;
    seen[planet.id] = Math.min(1, (seen[planet.id] ?? 0) + (s.playing ? dt * (360 / per) / (2 * Math.PI) / 2 : 0) + (selected ? dt * 0.05 : 0)); const draw = s.introDone ? Math.max(selected ? 0.15 : 0.05, seen[planet.id]) : live.introOrbit > 0 ? Math.min(1, live.introK) : 0;
    line.geometry.setDrawRange(0, Math.max(2, Math.floor((N + 1) * (s.introDone ? Math.max(draw, state.view === "atlas" ? 0.6 : 1) : draw)))); (line.material as THREE.LineBasicMaterial).color.set(selected ? "#FFF4D9" : "#7B4DFF"); (line.material as THREE.LineBasicMaterial).opacity = selected ? 0.9 : 0.45; line.visible = s.introDone || planet.id === "p2";
  });
  return <primitive object={line} />;
}

function SystemView({ data }: { data: Data }) {
  const gltf = useLoader(GLTFLoader, `${base}/models/planets.glb`), root = useRef<THREE.Group>(null), starMesh = useRef<THREE.Mesh>(null), hz = useRef<THREE.Mesh>(null);
  const sm = useMemo(() => starMaterial(), []), starGeo = useMemo(() => (gltf.scene.getObjectByName("Star") as THREE.Mesh).geometry, [gltf]);
  const sys = data.systems.find((x) => x.id === state.sysId)!; useStore();
  useFrame((st) => {
    const s = state, sy = data.systems.find((x) => x.id === s.sysId)!, show = s.opened || !s.introDone; if (root.current) { root.current.visible = show; root.current.position.set(...sy.pos); }
    const [r, g, b] = starColor(sy.temperatureK); sm.uniforms.uColor.value.setRGB(r, g, b); sm.uniforms.uTime.value = st.clock.elapsedTime;
    // star brightness follows the transit of the selected planet: the same domain functions as the light curve
    const pl = sy.planets.find((x) => x.id === s.planetId)!, isLab = s.labOn, rad = isLab ? s.lab.radiusEarth : pl.radiusEarth, per = isLab ? s.lab.periodDays : pl.periodDays, inc = isLab ? s.lab.inclinationDeg : pl.inclinationDeg, a = isLab ? semiMajorAxisAu(per, sy.massSolar) : pl.semiMajorAxisAu;
    if (!s.introDone) { sm.uniforms.uBright.value = introBrightness(live.introOrbit); } else {
      const th = (2 * Math.PI * s.tDays) / per + phase0(pl.id), sep = separation(a / (sy.radiusSolar * R_SUN_AU), inc, th); sm.uniforms.uBright.value = 1 - (sep.front ? fluxDrop(radiusRatio(rad, sy.radiusSolar), sep.z) * (isLab || s.view === "transit" ? 60 : 12) : 0); }
    live.starDim = sm.uniforms.uBright.value; if (starMesh.current) starMesh.current.scale.setScalar(starVisualRadius(sy.radiusSolar) / 6 * (s.introDone ? 1 : 1.25));
    if (hz.current) { const z = habitableZone(luminosity(sy.radiusSolar, sy.temperatureK)); hz.current.visible = s.introDone && s.view === "habitability"; const i = orbitRadiusUnits(z.inner), o = orbitRadiusUnits(z.outer); hz.current.scale.set(1, 1, 1); (hz.current.geometry as THREE.RingGeometry).dispose(); hz.current.geometry = new THREE.RingGeometry(i, o, 96); }
  });
  return (<group ref={root}><mesh ref={starMesh} geometry={starGeo} material={sm} />
    <mesh ref={hz} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1, 2, 8]} /><meshBasicMaterial color="#55d98a" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    {sys.planets.map((p) => <group key={p.id}><PlanetBody planet={p} star={sys} gltf={gltf.scene} selected={p.id === state.planetId} /><OrbitLine planet={p} star={sys} selected={p.id === state.planetId} /></group>)}
    <pointLight intensity={0} /></group>);
}

function Rig({ data }: { data: Data }) {
  const { camera, size } = useThree(), cam = camera as THREE.PerspectiveCamera, pos = useRef(new THREE.Vector3(0, 0, 0)), look = useRef(new THREE.Vector3(0, 0, -10)), want = useMemo(() => new THREE.Vector3(), []), wl = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const s = state, sy = data.systems.find((x) => x.id === s.sysId)!, sp = new THREE.Vector3(...sy.pos); let snap = false;
    if (!s.introDone) { want.copy(live.cam); wl.copy(live.look); snap = true; }
    else if (s.opened) { const off = s.view === "habitability" ? [0, 46, 14] : s.view === "transit" ? [24, 7, 30] : [16, 12, 34]; want.copy(sp).add(new THREE.Vector3(off[0], off[1], off[2])); wl.copy(sp); if (live.journey < 1) { const e = live.journey; want.copy(live.jFrom).lerp(want, e); want.y += Math.sin(Math.PI * e) * 24; wl.copy(sp); snap = true; } }
    else { if (live.journey < 1) { want.copy(live.jFrom).lerp(new THREE.Vector3(0, 0, 0), live.journey); wl.set(Math.sin(live.yaw) * 100, Math.sin(live.pitch) * 100, -Math.cos(live.yaw) * 100); snap = true; } else { want.set(0, 0, 0); wl.set(Math.sin(live.yaw) * 100, Math.sin(live.pitch) * 100, -Math.cos(live.yaw) * 100); } }
    const k = snap || s.reduced ? 1 : 1 - Math.exp(-dt * 2.4); pos.current.lerp(want, k); look.current.lerp(wl, k); cam.position.copy(pos.current); cam.lookAt(look.current); live.cam.copy(cam.position); cam.fov = 55; cam.near = 0.05; cam.far = 3000;
    const shift = size.width > 900 && s.introDone && s.opened ? size.width * 0.1 : 0; cam.setViewOffset(size.width, size.height, shift, 0, size.width, size.height); cam.updateProjectionMatrix();
    if (!s.introDone) { const p = new THREE.Vector3(...sy.pos).add(new THREE.Vector3(...introPlanetPos())).project(cam); live.planetScreen = [p.x * 0.5 + 0.5, -p.y * 0.5 + 0.5]; }
  });
  return null;
}
function Lifecycle() {
  const { setFrameloop, gl } = useThree();
  useEffect(() => { const vis = () => setFrameloop(document.hidden ? "never" : "always"), lost = (e: Event) => { e.preventDefault(); set({ gfx: "poster" }); };
    document.addEventListener("visibilitychange", vis); gl.domElement.addEventListener("webglcontextlost", lost); (window as unknown as { __nebulaStats: () => unknown }).__nebulaStats = () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures });
    return () => { document.removeEventListener("visibilitychange", vis); gl.domElement.removeEventListener("webglcontextlost", lost); }; }, [setFrameloop, gl]);
  return null;
}
function Clock() { useFrame((_, dt) => { if (state.playing && state.introDone && !document.hidden && !state.pauseMotion) set({ tDays: state.tDays + dt * Math.max(0.3, state.lab.periodDays > 0 && state.labOn ? state.lab.periodDays / 6 : 2.2) }); if (state.yearPlaying) { const y = Math.min(2026, state.year + dt * 3); set({ year: y, yearPlaying: y < 2026 }); } }); return null; }

export default function Scene({ data }: { data: Data }) {
  useStore(); const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  useEffect(() => { (window as unknown as { __nLive: typeof live }).__nLive = live; }, []);
  return (
    <Canvas className="stage" data-testid="stage" dpr={[1, 1.5]} camera={{ fov: 55, position: [0, 0, 60] }} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl, scene }) => { gl.setClearColor("#06050A"); scene.fog = null; }}
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, yaw: live.yaw, pitch: live.pitch }; }} onPointerMove={(e) => { const d = drag.current; if (!d || !state.introDone || state.opened) return; live.yaw = d.yaw - (e.clientX - d.x) * 0.004; live.pitch = Math.max(-1.2, Math.min(1.2, d.pitch - (e.clientY - d.y) * 0.004)); }} onPointerUp={() => { drag.current = null; }}>
      <ambientLight intensity={0.2} /><Rig data={data} /><Sky data={data} /><Markers data={data} /><SystemView data={data} /><Clock /><Lifecycle />
    </Canvas>
  );
}
