# BLU · Mangrove

ฉากป่าชายเลน 3D เต็มหน้าจอ อิงบรรยากาศท้องฟ้าสว่าง ผืนน้ำ และแนวป่าชายเลนจากภาพอ้างอิง **ไม่มีเหรียญ ไม่มีข้อความโฆษณา และไม่มีระบบซื้อขาย**

This is an original, stylized procedural environment, not a photographic reconstruction of a real site. The reference image is not embedded, uploaded, or distributed with the app.

## Run

Run these commands inside `cinematic/`. Node.js 20 or newer. No external packages or API keys are needed.

```sh
npm run dev
# http://localhost:4173

npm test
npm run build
npm run preview
```

`dist/` is a complete static website. Serve it over HTTP; do not open `index.html` using `file://` because browsers restrict ES modules there. Both the site root and subdirectory hosting are supported.

## Single-file download

`npm run build:standalone` creates `dist/mangrove.html`, an entirely self-contained website that can also be opened directly from disk. It includes the same geometry, shaders, controls, and fallback artwork. No network connection is needed at runtime.

## The scene

- Original three-dimensional trees, curved stilt roots, branching trunks, and instanced smooth broad leaves.
- Animated water with a real offscreen planar reflection, directional-light shadow maps, moving ripples, sky/cloud shaders, and distance haze.
- Slow leaf movement and subtle camera drift. Drag, touch, and scroll to explore within bounded camera limits.
- Compact Thai controls: morning/noon/evening, pause, fullscreen, quality, and camera reset. No hero text covers the scene.
- Mobile-specific framing, reduced-motion support, hidden-tab suspension, automatic quality fallback, and a static SVG fallback if WebGL 2 is unavailable.

## Background-only integration

Use `?clean=1` to hide all controls and the initial interaction hint. Additional optional parameters:

| Parameter | Values |
| --- | --- |
| `quality` | `auto`, `high`, `low` |
| `light` | `morning`, `noon`, `evening` |
| `motion` | `off` starts paused |

Example: `?clean=1&light=morning&quality=auto`. Parameters override local preferences. Without overrides, lighting and quality are remembered only in this browser's local storage; no data is sent to a server.

For an iframe, give it a meaningful title and `allow="fullscreen"` when fullscreen is wanted. Keyboard navigation on the focused canvas: arrows to look, `+` / `-` to zoom, `0` to reset, space to pause. Escape closes the settings panel.

## Source map

| File | Responsibility |
| --- | --- |
| `src/scene/world.js` | Seeded mangrove geometry, instance data, quality budgets |
| `src/scene/shaders.js` | Sky, leaves, wood, shadows, and water shaders |
| `src/scene/renderer.js` | WebGL resource lifecycle, reflection and shadow passes |
| `src/lib/math.js` | Vector, matrix, quaternion, and seeded-random helpers |
| `src/main.js` | Camera input, preferences, controls, motion and fallback handling |
| `src/styles.css` | Responsive overlay controls |
| `tests/scene.test.mjs` | Dependency-free automated geometry/math tests |
| `tests/tests.json` | Browser acceptance scenarios |

All models, leaf geometry, textures/shading, icons, and fallback artwork are generated in this repository. There are no runtime CDNs, external image/model downloads, analytics, authentication, or backend services.

## Deployment and validation

Use `cinematic` as the deployment root directory. `vercel.json` supports a manual static deployment. Automatic Git-triggered deployments are disabled; no GitHub Actions workflow is added. See `docs/QA.md` for exactly what was tested and the remaining browser/device checks. Frame rate depends on graphics hardware; no universal FPS is promised.
