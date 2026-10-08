# Video Latency Calculator — V1

Compare the one-way video delay of Path A and Path B using the agreed Web Creations planning model. This package contains a static GitHub Pages front end and a separate Cloudflare Worker for optional address lookup.

The files are ready for local use and deployment. They have **not** been published to GitHub or Cloudflare as part of this delivery. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for the Mac1584 setup.

## Start locally

Install a current [Node.js LTS release](https://nodejs.org/), version 22 or newer. Open a terminal in this folder and run:

```powershell
npm start
```

Open **http://127.0.0.1:8788** in your browser. No front-end dependencies or build step are needed. Stop the server with Ctrl+C. Use the local server rather than opening `index.html` directly, because the JavaScript uses ES modules.

```powershell
npm test
```

This runs the shared calculation and CSV tests, plus Worker request tests. Worker tests use a simulated geocoder and do not need account credentials. They do not verify a live Geoapify or Cloudflare deployment.

Distance and coordinate calculations work without the Worker. Address lookup becomes available after the Worker and its API key are configured.

## Using the calculator

- Compare both paths in milliseconds, seconds and equivalent frames at 60 fps, with the absolute difference shown beneath the diagrams.
- Select generic HEVC, AVC or JPEG XS encoder/decoder assumptions, or enter custom names and delays. The matching decoder follows the selected encoder; its delay remains editable.
- Choose GEO, LEO, Fiber, Microwave, Internet or Custom transport. Internet has Local / Metro, Regional and Long Distance planning tiers.
- Enter a distance in miles or kilometers, enter coordinates, or explicitly look up addresses and select the intended results. The two paths share endpoints by default; uncheck **Use the same endpoints for A & B** for separate locations.
- Enter a measured transport delay to replace the fiber or microwave calculation; **Use calculated delay** restores the propagation model. Advanced assumptions expose display delay and the fiber route factor.
- Use **Copy Path A to B**, **Reset Path A**, **Reset Path B**, **Reset All**, or **Export Comparison (.csv)**. Copy transfers all Path A settings. Reset All restores both paths and links their endpoints.

The CSV contains both paths, inputs, resolved coordinates, stage values, assumptions, totals and differences. It records whether values are **Default**, **Calculated** or **User entered**, keeps more numeric precision than the screen, and guards user-provided text against spreadsheet formula execution. CSV export requires valid inputs for both paths.

## Agreed defaults and equations

| Stage or assumption | V1 value |
| --- | --- |
| HEVC / H.265 | Encode 150 ms; decode 10 ms |
| AVC / H.264 | Encode 100 ms; decode 10 ms |
| JPEG XS | Encode 8 ms; decode 8 ms |
| Display | 15 ms |
| GEO satellite | 300 ms one-way |
| LEO satellite | 60 ms one-way |
| Internet Local / Metro | 15 ms one-way |
| Internet Regional | 30 ms one-way |
| Internet Long Distance | 60 ms one-way |
| Fiber propagation | 65% of vacuum light speed; route factor 1.25 |
| Microwave propagation | 99% of vacuum light speed; no fiber route factor |
| Frame equivalents | 60 fps |
| Initial geographic distance | 1,000 miles |

```text
Total ms = encoder ms + transport ms + decoder ms + display ms
Seconds = total ms / 1,000
Equivalent frames = total ms × 60 / 1,000
Fiber route km = geographic km × route factor
Fiber transport ms = route km / (299,792.458 × 0.65) × 1,000
Microwave transport ms = geographic km / (299,792.458 × 0.99) × 1,000
```

Codec and transport presets are agreed, editable planning values, not vendor specifications or service guarantees. Fiber and microwave formulas estimate propagation. Capture, processing, queuing, recovery and jitter buffering are not separate stages; include applicable delays in measured overrides and avoid double counting.

Coordinates and selected address results use a spherical great-circle distance with mean Earth radius 6,371.0088 km. Fiber's route factor estimates a longer cable route. Microwave calculations do not establish a usable line of sight, relay plan, terrain clearance or equipment delay. Diagrams are schematic.

## Files and services

| Location | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `script.js`, `favicon.svg` | Static calculator interface |
| `config.js` | Public Worker URL; never store an API key here |
| `shared/defaults.js` | Agreed presets used by the front end and Worker |
| `shared/model.js` | Calculations, validation and CSV export |
| `worker/` | Separate Worker, Wrangler configuration and request tests |
| `tests/`, `tools/`, `package.json` | Calculation tests and local preview |
| `DEPLOYMENT.md` | GitHub Pages and Cloudflare setup |

The Worker provides `GET /health`, `GET /defaults` and `GET /geocode?address=...`. Keep `worker/` and `shared/` as siblings: Wrangler bundles their shared defaults import. No database, D1 setup or front-end framework is required.

## Sources, privacy and limits

The interface includes **Sources & Assumptions**. [NIST](https://physics.nist.gov/cuu/Constants/Value/c.html) supplies the exact vacuum light-speed constant. [Corning's fiber sheet](https://www.corning.com/content/dam/corning/media/worldwide/coc/documents/Fiber/product-information-sheets/PI-1424-AEN.pdf) illustrates that real fiber propagation depends on group index; V1 retains the agreed 65% approximation. [NASA](https://www.nasa.gov/missions/tdrs/tracking-and-data-relay-satellite-tdrs-generations-of-spacecraft/) places GEO at 35,786 km, implying approximately 239 ms for a minimum vertical Earth–satellite–Earth traversal. The 300 ms preset is a planning allowance. [Starlink](https://starlink.com/nr/updates/network-update) describes its published network latency as RTT; V1's 60 ms one-way value is an independent assumption. [RFC 7679](https://www.rfc-editor.org/info/rfc7679/) explains why half of ping RTT is only an approximation to one-way delay.

The app does not persist settings or encode them in a share URL. Address queries are sent only when **Look up** is selected, through the Worker to [Geoapify](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/). Requests can be retained by browser or service infrastructure even though this Worker does not explicitly log or cache addresses. Manual distance and coordinates avoid geocoding requests. CSV files can contain entered addresses; review them before sharing.

Lookup results retain provider attribution and show **Powered by Geoapify** and [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Check current [Geoapify usage limits](https://www.geoapify.com/pricing/) and [terms](https://www.geoapify.com/terms-and-conditions/). The Worker's per-IP burst limiter is eventually consistent and operates per Cloudflare location; it is not a global quota or billing cap. CORS controls browser origins and does not authenticate callers.
