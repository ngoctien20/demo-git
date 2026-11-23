# TIEN404 AI Motion Design v2.0

## What's new

- Multi-layer hero ambient glow, perspective grid and subtle shifting gradient headline.
- Dashboard SVG line draw, simulated activity cues, floating informational badges, pointer-controlled shallow tilt (fine pointers only).
- Interaction-aware radial spotlight on cards; updated buttons, workflow route, timeline, CTA and demo chat micro-interactions.
- Scroll entrance effects via `IntersectionObserver` and one `requestAnimationFrame`-coalesced reading progress listener.
- **Interactive Workflow Studio**: 4 steps with functional mouse, touch and keyboard arrow/Home/End support, `tablist` and `tabpanel` attributes. Data is explicitly fictional; **there is no real n8n connection**.
- Respect `prefers-reduced-motion`, no animation dependency for core navigation/content, no third-party animation library.

## Edit animation

- HTML: `index.html` contains the Studio.
- CSS source: `src/scss/_motion.scss` (all motion variables and keyframes).
- Entry point: `src/scss/main.scss`.
- JavaScript: `assets/app.js` motion logic after static chat/lead handling.
- Ship output: `assets/style.css` (already built).
- Rebuild: `npm install` then `npm run build:css`.

## QA and deployment

- Run `python qa_static.py` and `python -m unittest discover -s tests -p test_motion_contract.py -v`.
- GitHub Actions workflow triggers on `gh-pages` and verifies SCSS/JS/static links/contracts.
- GitHub Pages must be enabled at **Settings → Pages → Deploy from a branch → gh-pages / (root)** if it has not been enabled already. This workflow performs QA only; publishing is controlled by GitHub Pages settings.

## Constraints

- Frontend is static. Contact form does not send leads on GitHub Pages; no production orders, tokens or AI APIs are integrated.
- For production release: configure a secured server-side lead API, real sandboxed demo API, authorization and rate limits, and verify on physical iOS/Android devices.
- On slow devices or when users request reduced motion, the experience favors clear text and controls over animation. Do not replace label text with fake counts or simulated customer statistics.