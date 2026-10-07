# NEBULA

Exoplanet discovery lab demo (blueprint 05, Advanced Engineering Build Book Vol. VII). Static site; the Blender planet bases are scripted. Every star, planet, spectrum and discovery is synthetic.

- Build the asset: `npm run model` (Blender 4.5 at ~/Applications), then `node scripts/copy-assets.ts`. Contract: `model/parts.json` (six bodies with pivot tilt, atmosphere shell factor, subdivisions). The validator rejects an atmosphere shell inside the terrain.
- Science: `packages/domain/src/astro.ts` (Kepler, equilibrium temperature, habitable zone, ESI, limb-darkened transit, scale height, spectra, band detection) is deterministic and separate from the story. Tests: `npm test`, `npm run e2e` after `npm run build`.
- Scene: not to scale on purpose, using `orbitRadiusUnits`, `planetVisualRadius` and `starVisualRadius`. The observer is at +z; a planet at orbital angle theta sits at (R sin t, R cos i cos t, R sin i cos t).
- Multi-agent is the development process only (.claude/agents); the product contains no agents.
