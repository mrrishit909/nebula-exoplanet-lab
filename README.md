# NEBULA: an exoplanet discovery lab

A lone star. A planet crosses it and the light dips almost imperceptibly. The event repeats, the curve builds, the orbit and size appear, and the starlight spreads into a spectrum with dark lines where the planet's air absorbs. **DISCOVER WORLDS FROM THEIR SHADOWS.** Then the planet expands to fill the screen and its atmosphere dissolves into the navigation.

Then the instruments: an atlas of eight systems you fly to, a transit lab where tilting the orbit makes the transit vanish, a spectrum explorer that compares two worlds and detects molecules against noise, a habitable-zone scenario where you slide a planet in and out, and a discovery timeline that reshapes the sky.

Built from blueprint 05 of the *Advanced Engineering Build Book, Volume VII* as a **vertical slice**. **Every star, planet, atmosphere and discovery is synthetic**; the formulas are standard textbook relations, but no object here is real and no accuracy for any real planet is claimed.

- Live: https://mrrishit909.github.io/projects/nebula-exoplanet-lab/demo/
- Case study: https://mrrishit909.github.io/projects/nebula-exoplanet-lab/

## Run it
```bash
npm ci
npm run seed                      # systems and the background catalog
npm run model                     # Blender 4.5: build.py then validate.py (the GLB is committed, so optional)
npm test                          # 30 domain + API tests
npm run build && node scripts/serve.ts 8671   # static export at http://127.0.0.1:8671
npm run e2e                       # 21 Playwright tests (needs Google Chrome)
node apps/api/src/server.ts       # /v1 API on :8670, OpenAPI at /openapi.json
```
`?skip=1`, `?view=atlas|transit|spectrum|habitability|timeline`, `&system=s5&planet=p13`, `&year=2012`, `?gfx=off`, `?motion=reduced`.

## The pipeline
`model/parts.json` is the contract for six planet bases (pivot tilt, atmosphere shell, subdivisions). `build.py` makes them with a separate shell each, a ring, a moon and a star; `validate.py` re-imports the GLB and fails if a shell is inside its planet's terrain, a part is unparented or a budget is broken. All surface detail, clouds, scattering and temperature response are shaders in the browser. The science lives in `packages/domain/src/astro.ts`, separate from the story. See [docs/](docs/) and [design/](design/).

## Agent roles
`.claude/agents/` defines the twelve roles from the book, `.claude/skills/` the six project skills. **Honest note:** this repository was produced by one Claude Code session playing those roles in sequence on one working tree, not by parallel subagents in separate worktrees. The multi-agent workflow is the development process; the product contains no agents.

## Not built, and why
PostgreSQL (JSON files), adapters for public astronomy catalogs, real spectra and per-star limb-darkening coefficients, eccentric orbits and moons, touch tests beyond the phone layout, tablet and large-desktop checks, and a measurement on a physical GPU.
