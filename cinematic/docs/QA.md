# Validation — 16 October 2026

## Completed

- `npm test`: **10/10 passed**. Deterministic generation, geometry budgets, finite transforms, smooth normals, matrix math, camera bounds, and relative import resolution.
- `npm run build`: **passed**, dependency-free static output.
- `npm run build:standalone`: **passed**, one HTML file without external module, stylesheet, image, font, or API requests.
- All **six GLSL program pairs compiled and linked** with an offscreen Mesa OpenGL implementation supporting GLSL ES 3.00. Shadow, reflection, and final scene passes completed with **GL error 0**.
- Visually inspected native offscreen renders of the actual generated geometry/shaders at **1490 × 760** (high detail) and **390 × 844** (low detail).
- Chromium: the real unavailable-WebGL path shows the static fallback, removes loading status, explains the failure, and disables unavailable controls.
- Chromium DOM/input tests at desktop and mobile widths passed for the settings panel, lighting selection, quality selection, keyboard navigation/reset, pause/resume, reduced-motion defaults, Escape/focus return, and viewport overflow. **These interaction tests used a renderer stub**; they are not full browser-WebGL end-to-end tests.

## Environment limitation / still to verify

The local managed Chromium instance disables WebGL and browser navigation. Consequently native offscreen rendering was used for shader/visual checks and a DOM harness for control checks. This is not a claim of successful hardware-accelerated browser rendering.

Still verify the complete live rendering path in Chrome/Edge/Safari on actual desktop/mobile hardware, graphics-context recovery with `WEBGL_lose_context`, fullscreen behavior on iOS, and frame rate/thermal behavior. No universal frame rate is claimed. The reproducible manual scenarios are in `tests/tests.json`.

## Scope and concurrent work

The repository gained a separate implementation on `main` while this version was being developed. This version is therefore isolated in the `cinematic/` directory on `feat/cinematic-mangrove-backdrop`, rather than overwriting that work. No production/main replacement is intended without review. Automatic Git-triggered Vercel deployments are disabled in this version's configuration.
