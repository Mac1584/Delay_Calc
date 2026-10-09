# Video Delay Calculator v0.9

Waypoint Utility Web edition: a responsive, accessible static site for comparing two one-way video contribution paths. No build step or front-end dependency installation is required.

## Deploy to GitHub Pages

1. Extract this ZIP and upload **the contents** to the root of your GitHub repository. Keep `shared/` and its files together.
2. Open **Settings → Pages**. Select **Deploy from a branch**, choose your branch (usually `main`) and **/ (root)**, then save.
3. Open the Pages URL after deployment. All local asset paths are relative and work for project repositories.

To preview locally, serve this folder over HTTP (for example, `python -m http.server 8000`) and open `http://localhost:8000`. JavaScript modules require an HTTP server; opening the HTML directly from disk is not sufficient.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Calculator, diagrams, sources, and Waypoint navigation |
| `styles.css`, `waypoint.css`, `tool.css` | Original layout, shared style guide, and calculator styling |
| `script.js` | Existing controls, address lookup, comparison and CSV download |
| `shared/defaults.js`, `shared/model.js` | Unchanged presets, calculations, validation and export model |
| `config.js` | Public address-lookup service URL and timeout |
| `favicon.svg`, `.nojekyll` | Local icon and static hosting marker |

Distance, coordinates, presets, stage delays, frame equivalents at 60 fps, linked endpoints, copy/reset and CSV export work in the browser. Address lookup uses the existing public Cloudflare Worker in `config.js`; that service must be reachable and allow your site's origin. No API key belongs in this package. If lookup is unavailable, manual distance/coordinates remain usable. The external Worker itself is not part of this static package. Its current origin allowlist accepts `https://mac1584.github.io` and rejects localhost: a local preview can show address lookup unavailable even though the service is healthy. When deploying under another account or custom domain, update the Worker allowlist or supply an appropriately configured service URL.

Interface version **0.9** is retained as requested. The calculation engine is preserved from [Mac1584/Delay_Calc](https://github.com/Mac1584/Delay_Calc), whose original interface is marked V1.0; its internal defaults version remains unchanged. Presets are planning assumptions; equations and references appear in **Sources & Assumptions**.

Navigation links to Camel Collision and Tower Horizon open their existing public GitHub Pages sites. Upload the other supplied packages to update those sites as well.

## Verification

Verified locally against the original source for transport/codec presets, custom and advanced values, distance units, coordinates, linked/separate endpoints, overrides, copy/reset, invalid input and CSV export. 35 baseline-versus-restyle browser scenarios and downloaded CSV matched exactly. Lookup success/error behavior was checked with simulated service responses; the real service also passed a New York address lookup with the local package served under its allowed GitHub Pages origin. Desktop and 320/390-pixel layouts passed overflow, labelling, keyboard skip-link and runtime checks.