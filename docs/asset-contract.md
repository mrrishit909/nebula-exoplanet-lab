# Blender asset contract

Source of truth: `model/parts.json` and `model/build.py` (deterministic).

**planets.glb** (891 KB, 59,328 triangles): root `Bodies`; for each of six kinds a `Pivot_<kind>` (axial tilt as a rotation), `Planet_<kind>` (icosphere, bump from a few seeded sine waves) and, if listed, `Atmosphere_<kind>` (a separate shell). Also `GasGiant_Ring` (under the gas giant's pivot), `Star` and `Moon_A`.

| Kind | Radius | Tilt | Shell | Subdivisions (surface / shell) |
|---|---|---|---|---|
| rocky | 1.0 | 23.4 | 1.055 | 5 / 4 |
| ocean | 1.0 | 18.0 | 1.05 | 6 / 5 |
| gas-giant (oblate 0.9, ring 3.3 to 5.2) | 2.6 | 26.7 | 1.03 | 5 / 4 |
| lava | 0.9 | 3.0 | 1.07 | 5 / 4 |
| ice | 1.3 | 97.8 | 1.04 | 5 / 4 |
| super-earth | 1.55 | 12.0 | 1.06 | 5 / 4 |

The ocean world has the most triangles because it is the planet that grows to fill the screen in the intro; the lower subdivisions showed polygon silhouettes at that size.

**Validation** (`model/validate.py`): all 25 named nodes present; every planet and shell under its pivot; each planet's diameter within 15 to 20 percent of its radius with bump; **every shell outside the highest terrain** (the first build failed this for the lava world, whose 5 percent bump poked through a 2 percent shell, so the contract now derives each shell factor from the bump); nothing unparented; under 80,000 triangles and 1.8 MB. Last run: VALIDATION OK.

**Browser-driven:** surface and atmosphere shaders, planet and shell scale (visual radius), tilt, spin, ring, star material and brightness, orbit placement.

**Known limits.** Bases only: no UVs (the shaders use object-space noise), no moons beyond one decorative mesh, no cloud layer geometry.
