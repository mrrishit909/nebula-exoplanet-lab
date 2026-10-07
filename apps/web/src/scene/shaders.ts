import * as THREE from "three";
// Surface, atmosphere and star shaders. The Blender meshes carry only shape; everything that looks like a planet is here.
const NOISE = /* glsl */ `
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y), mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.02 + 1.7; a *= 0.5; } return s; }`;
const KIND_INDEX: Record<string, number> = { rocky: 0, ocean: 1, "gas-giant": 2, lava: 3, ice: 4, "super-earth": 5 };
export const kindIndex = (k: string) => KIND_INDEX[k] ?? 0;
export function planetMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ uniforms: { uKind: { value: 0 }, uTemp: { value: 288 }, uTime: { value: 0 }, uSun: { value: new THREE.Vector3(-1, 0.2, 0.4).normalize() }, uSeed: { value: 1 }, uShade: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vO; void main(){ vO = position; vN = normalize(normalMatrix * normal); vP = (modelViewMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${NOISE} uniform float uKind, uTemp, uTime, uSeed, uShade; uniform vec3 uSun; varying vec3 vN; varying vec3 vP; varying vec3 vO;
      void main(){ vec3 o = normalize(vO) * 1.0 + uSeed * 3.1; float h = fbm(o * 2.6); vec3 col; float spec = 0.0, emis = 0.0;
        if (uKind < 0.5) { col = mix(vec3(0.42,0.27,0.18), vec3(0.65,0.5,0.35), h); col *= 0.8 + 0.4 * vn(o * 14.0); }
        else if (uKind < 1.5) { float land = smoothstep(0.52, 0.56, h); vec3 sea = mix(vec3(0.02,0.1,0.32), vec3(0.05,0.25,0.5), fbm(o*4.0)); vec3 ld = mix(vec3(0.2,0.35,0.15), vec3(0.5,0.42,0.3), fbm(o*7.0)); col = mix(sea, ld, land); float cl = smoothstep(0.55, 0.8, fbm(o*3.2 + uTime*0.02)); col = mix(col, vec3(1.0), cl*0.85); spec = (1.0 - land) * (1.0 - cl) * 0.6; }
        else if (uKind < 2.5) { float lat = normalize(vO).y; float band = sin(lat * 16.0 + fbm(vec3(o.x*1.5, lat*6.0, o.z*1.5 + uTime*0.01)) * 5.0); col = mix(vec3(0.78,0.58,0.38), vec3(0.93,0.8,0.62), band * 0.5 + 0.5); col = mix(col, vec3(0.6,0.35,0.22), smoothstep(0.7, 1.0, fbm(o * vec3(2.0, 9.0, 2.0)))); }
        else if (uKind < 3.5) { float ridge = 1.0 - abs(2.0 * fbm(o * 3.0) - 1.0); float crack = smoothstep(0.82, 0.95, ridge); col = mix(vec3(0.07,0.04,0.035), vec3(0.2,0.1,0.07), h); emis = crack * (0.6 + 0.4 * sin(uTime + h * 8.0)); col = mix(col, vec3(1.0,0.45,0.1), emis); }
        else if (uKind < 4.5) { col = mix(vec3(0.74,0.86,0.95), vec3(0.95,0.98,1.0), h); float cr = smoothstep(0.9, 0.97, 1.0 - abs(2.0*fbm(o*5.0)-1.0)); col = mix(col, vec3(0.35,0.55,0.75), cr * 0.6); spec = 0.35; }
        else { col = mix(vec3(0.25,0.32,0.22), vec3(0.55,0.48,0.38), h); col = mix(col, vec3(0.15,0.25,0.35), smoothstep(0.55, 0.4, fbm(o*2.0+3.0)) * 0.7); }
        // temperature: hot worlds glow, cold worlds frost
        float hot = smoothstep(700.0, 1400.0, uTemp), cold = smoothstep(220.0, 120.0, uTemp); col = mix(col, vec3(1.0,0.4,0.1) * (0.5 + h), hot * 0.45 * step(0.5, uKind)); col = mix(col, vec3(0.88,0.94,1.0), cold * 0.6);
        vec3 n = normalize(vN); float d = max(dot(n, normalize(uSun)), 0.0); float wrap = smoothstep(-0.15, 0.5, dot(n, normalize(uSun))); vec3 v = normalize(-vP); float sp = pow(max(dot(reflect(-normalize(uSun), n), v), 0.0), 40.0) * spec;
        vec3 lit = col * (0.04 + 0.96 * wrap * uShade) + vec3(sp) * wrap; lit += vec3(1.0,0.45,0.1) * emis * 1.4 * (uKind > 2.5 && uKind < 3.5 ? 1.0 : 0.0) + vec3(1.0,0.35,0.1) * hot * 0.25 * (1.0 - wrap);
        gl_FragColor = vec4(lit, 1.0); }` });
}
export function atmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: new THREE.Color("#7B4DFF") }, uPower: { value: 3.0 }, uAmount: { value: 1.0 }, uSun: { value: new THREE.Vector3(-1, 0.2, 0.4).normalize() } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uPower, uAmount; uniform vec3 uSun; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(normalize(vN), vV), 0.0), uPower); float lit = 0.25 + 0.75 * smoothstep(-0.3, 0.6, dot(normalize(vN), normalize(uSun))); gl_FragColor = vec4(uColor * f * lit * uAmount, f * uAmount * 0.6); }` });
}
export function starMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color("#FFD28A") }, uBright: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vO; void main(){ vN = normalize(normalMatrix * normal); vO = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${NOISE} uniform vec3 uColor; uniform float uBright, uTime; varying vec3 vN; varying vec3 vO; void main(){ float mu = max(vN.z, 0.0); float ld = 1.0 - 0.45 * (1.0 - sqrt(mu)); float g = 0.85 + 0.3 * fbm(normalize(vO) * 5.0 + uTime * 0.05); vec3 c = uColor * ld * g * 1.25 * uBright; gl_FragColor = vec4(c, 1.0); }` });
}
