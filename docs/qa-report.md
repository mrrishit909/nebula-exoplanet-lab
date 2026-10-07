# QA report

Apple M3 Pro, Chrome stable, Playwright 1.63, WebGL through SwiftShader. Last full runs: 21 e2e passed twice in a row after the final fix; 30 unit and API tests passed.

| Matrix row (blueprint 18) | Covered by | Result |
|---|---|---|
| Intro first load, skip, refresh mid-sequence | demo walk, refresh test, a test that choices made during the last fade are kept | pass |
| Input: click, keyboard, drag | demo walk, year slider with arrow keys; dragging the sky is implemented but not tested | partial |
| Input: touch | phone layout only | not tested |
| Scroll | no scroll navigation; deep links restore system, planet, view and year | pass |
| Responsive | phone 390 px: instruments strip above, panel below, no sideways overflow | pass at one phone size |
| Motion: reduced | static keyframes; same navigation; panel animation off | pass |
| Graphics: success, failure, context loss | all WebGL tests; `?gfx=off`; lost-context event | pass |
| Lifecycle: tab hidden | frame loop pauses on visibilitychange | manual only |
| Science | depth near k squared, duration vs numeric curve, symmetry, tilt removes the transit, Kepler round trip, ESI of Earth is 1, detection finds present molecules only, noise hides weak ones | pass |
| Cross-view agreement | cursor, observer inset and the star's brightness agree at mid-transit and half an orbit later | pass |
| Visual regression | five instruments against the poster fallback | pass |
| Performance | budgets in tests/e2e/performance.spec.ts | pass |

Defects found and fixed during the build: the validator caught an atmosphere shell inside the lava world's terrain; the ocean world's atmosphere showed polygon edges at full-screen size; the lab's sliders showed the previous planet's values; **the intro's closing `finish()` overwrote the visitor's choices** (a system opened while the haze was still fading reverted to NEB-017), found as a flaky first test and fixed by having `finish()` leave state alone once the navigation is live; a range-input fill was rejected by Playwright for numbers like 0.00 so the test sets the value through the native setter.
