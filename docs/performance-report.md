# Performance report

Hardware: Apple M3 Pro, Chrome stable, **software WebGL (SwiftShader)**, 1280 x 800. No physical GPU was exercised: **no 60 fps claim is made.** Command: `node scripts/measure.mjs`, transit view.

| Measure | Value | Budget |
|---|---|---|
| Transfer (17 requests, local, uncompressed) | 1,507 KB | n/a |
| JS gzipped | 569 KB | 750 KB |
| planets.glb / catalog.json / systems.json | 891 KB / 23 KB / 8 KB | 1,000 / 60 / n/a KB |
| Draw calls / triangles / geometries / textures | 15 / 40,232 / 14 / 1 | 150 / 200,000 |
| LCP | 4.9 s (software rasteriser) | none set |
| CLS | 0 | 0.1 |
| Long tasks during load | 4.3 s | none set |
| Median / p95 frame | 16.8 / 33.4 ms (software) | none set |
| Lab slider to readout | 8 ms | 3 s |

The scene is cheap in draw calls (the sky is one `Points`, each planet three meshes) and moderate in triangles because the ocean world is dense. The surface shaders do five-octave noise per pixel and per planet; on a phone the first thing to try is three octaves and a lower subdivision for the planets that are never the camera's target. All 26 planets are instantiated for the opened system only (three to five), not the catalog.

Degradation: the frame loop stops on a hidden tab; `?gfx=off` and context loss show the poster; reduced motion removes ambient motion; dpr is capped at 1.5. There is no automatic quality ladder.
