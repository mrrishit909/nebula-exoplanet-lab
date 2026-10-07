# Architecture

```
model/parts.json ──> model/build.py ──Blender──> planets.glb (six bodies, pivots, shells, ring, moon, star), poster.png, source.blend
                 └─> model/validate.py (fresh-scene re-import: names, parenting, sizes, shell outside terrain, budgets)
data/simulators/generate.ts ──> systems.json (8 stars, 26 planets), catalog.json (260 background discoveries)
packages/domain: astro (Kepler, temperature, habitable zone, ESI, transits, spectra, detection, visual scales), catalog
apps/web (Next.js 16 static export): App ─ store ─ Panels (DOM + SVG instruments) + Scene (R3F: sky, markers, system, rig) + Intro (GSAP)
apps/api (node:http): the blueprint's section 12 contract; simulations are the same domain functions
```

**The science is a separate, tested module.** `astro.ts` has no knowledge of the story or the scene. The transit model is a circular orbit with a uniform-disk overlap weighted by linear limb darkening at the planet's centre; a test checks its duration against a numerical light curve to within 3 percent, its depth against k squared, and that a tilted orbit has no transit and says why.

**Blender owns shape; shaders own the planet.** The GLB carries six sphere bases (low-frequency lumps on the rocky ones), tilted pivots, separate atmosphere shells, a ring and a star. Surfaces (continents, clouds, bands, lava cracks, frost), the atmospheres' scattering and temperature response are GLSL, parametrised by kind and equilibrium temperature.

**One clock.** `tDays` drives the planet's orbital angle. The light-curve cursor, the observer inset, the star's brightness and the orbit position all derive from it, so scrubbing the phase moves all four.

**Not to scale.** Orbit radius is logarithmic in AU, planet size is a square-root of radius, star size a square-root of solar radius; the mappings are named functions with monotonicity tests.

**Not built.** PostgreSQL (the schema in the book is the target), adapters for public astronomy catalogs (named in the data strategy, not implemented), real spectra, limb-darkening coefficients per star, eccentric orbits and the moon system.
