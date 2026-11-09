# TIEN404 AI — GitHub Pages Source

This branch hosts a static public preview of TIEN404 AI. It has 17 HTML pages, browser-only simulated chat, styles, and Sass source.

## Enable live Pages

GitHub → repository Settings → Pages → Build and deployment → **Deploy from a branch** → branch **gh-pages** → folder **/(root)** → Save.

Once enabled and built, the expected URL is https://ngoctien20.github.io/demo-git/ . This URL is not verified live yet.

## Sass workflow

- Styles source: `src/scss/main.scss` and partials.
- Built CSS: `assets/style.css`.
- Install `npm install`; then `npm run build:css` or `npm run dev:css`.
- Static checks: `python qa_static.py`.

## Production limitations

**Chat is a simulation.** Contact form does NOT send leads from GitHub Pages. No real AI, n8n, payment, sign-in, or backend is deployed. No secrets should be committed here. The full backend, tests, and QA agent are available in the separately delivered project ZIP.

This deployment lives on a dedicated gh-pages branch; original main is unchanged.
