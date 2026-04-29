# Hajj Guide

> A free, personalised, offline-first companion for pilgrims. Open source. Hosted at [hajjguide.net](https://hajjguide.net).

A personalised, offline-first guide for pilgrims. Open-source. Free to host. Works on any phone.

## What it does

A pilgrim opens the site, answers a few short questions about their trip (flights, dates, madhab, operator, accommodation), and gets a guide that:

- Renders a **day-by-day itinerary** keyed to their actual flight dates
- Shows **rulings according to their madhab** (Hanafi, Shafi'i, Maliki, Hanbali) with side-by-side comparison
- Provides **24+ duas** with Arabic, transliteration, English translation, and audio (downloadable for offline use)
- Embeds **Google Maps** for the holy sites and the user's accommodation, with walking distance to the Haram
- Maintains a **packing checklist** with ~95 items grouped by category, with progress saved
- Captures **personal notes** per section
- Adjusts **text size** for older pilgrims or low-light reading
- **Prints any section** for the trip
- Works **fully offline** once loaded
- Generates an **emergency card** with operator and group contacts

All data stays on the user's device. Nothing is sent anywhere.

## Tech

- Vanilla HTML/CSS/JS — no framework, no build step
- localStorage for state (with in-memory fallback)
- Cache API for audio + Service Worker for offline
- Google Maps Embed API + Places API (optional, for hotel autocomplete and embeds)
- PWA-installable

## Project structure

```
/_worker.js              ← Cloudflare Worker entry point
/wrangler.jsonc          ← Worker configuration
/.assetsignore           ← files NOT to expose as public URLs
/_headers                ← cache + security headers
/index.html              ← landing + onboarding wizard
/app.html                ← main guide
/manifest.json           ← PWA manifest
/robots.txt
/sitemap.xml
/css/
  styles.css             ← design system + components
  print.css              ← print-specific overrides
/js/
  utils.js               ← DOM/format helpers
  store.js               ← localStorage state layer
  onboarding.js          ← multi-step wizard
  guide.js               ← all-tab renderer (the largest file)
  app.js                 ← app.html boot
  fontsize.js            ← A−/A/A+/A++ control
  notes.js               ← per-section notes panel
  audio.js               ← player + offline cache
  maps.js                ← Google Maps integration
  print.js               ← per-section print
  sw.js                  ← service worker (offline)
  config.example.js      ← API key template (commit this)
  config.js              ← real API keys for local dev only (gitignored)
/data/
  duas.json              ← all duas with audio URLs
  rulings.json           ← madhab-specific rulings
  itinerary-template.json
/icons/
  icon.svg               ← master icon
  icon-192.png, 512.png, maskable.png
/audio/                  ← (empty, populated when audio is downloaded by user)
```

## Running locally

You need any static file server — the app uses `fetch()` to load JSON, so opening `index.html` directly via `file://` won't work.

**Python (any OS):**
```bash
cd hajj-app
python3 -m http.server 8000
# then open http://localhost:8000
```

**Node:**
```bash
npx serve hajj-app -p 8000
```

**PHP:**
```bash
php -S localhost:8000 -t hajj-app
```

## Configuring Google Maps (optional but recommended)

Without API keys, the site still works — but hotel autocomplete during onboarding and map embeds on the Locations tab will be disabled (placeholder shown instead).

This project uses a **Cloudflare Worker** with a **secret environment variable** to serve the API key without committing it to git. The key lives only in Cloudflare's encrypted secret store and is injected at request time by `_worker.js`.

### Step 1: Get an API key

1. Go to <https://console.cloud.google.com/>
2. Create a new project (or pick an existing one)
3. Enable these APIs (left menu → APIs & Services → Library):
   - **Maps Embed API** — free, no quota
   - **Places API (New)** — paid after free tier; cap your daily quota
4. APIs & Services → Credentials → Create Credentials → API key
5. Copy the key (starts with `AIza...`)

### Step 2: Restrict the key

This is critical — even with secrets, browser-side keys can be scraped. Lock yours down:

1. In Credentials, click your new key
2. Under **Application restrictions**, choose **Websites**
3. Add your domains:
   - `https://hajjguide.net/*`
   - `https://www.hajjguide.net/*`
   - `https://hajj-guide.<your-subdomain>.workers.dev/*`
4. Under **API restrictions**, choose **Restrict key** and select only:
   - Maps Embed API
   - Places API (New)
5. Save

### Step 3: Cap the daily quota

Still in Cloud Console:

1. APIs & Services → Quotas & System Limits
2. Filter for "Places API (New)" requests per day
3. Set a sensible daily cap (e.g. 1,000)

### Step 4: Add the key to your Worker as a secret

1. Cloudflare Dashboard → Compute (Workers) → `hajj-guide`
2. Settings → Variables and Secrets → **Add**
3. **Type:** Secret
4. **Variable name:** `GOOGLE_MAPS_API_KEY` (must match exactly)
5. **Value:** paste your API key
6. Save

Trigger a redeploy (push any commit, or hit "Retry deployment" in the Worker dashboard). The Worker reads the secret at request time and serves it dynamically as `/js/config.js`.

### Local development with the API key

`_worker.js` only runs on Cloudflare's edge — `python3 -m http.server` won't execute it. Two options:

**Option A — local config file (gitignored):**
```bash
cp js/config.example.js js/config.js
# edit js/config.js, paste your key
```
This file is in `.gitignore` so it won't be committed. The browser tries to load `/js/config.js` and finds your local one in dev. In production the Pages Function takes over.

**Option B — full Cloudflare simulation:**
```bash
npm install -g wrangler
wrangler dev
```
This runs your Worker locally. Set `GOOGLE_MAPS_API_KEY` in a `.dev.vars` file (also gitignored).

## Deployment

The site runs as a **Cloudflare Worker with static assets**, deployed via **GitHub** integration.

### Architecture

- `_worker.js` is the entry point. It serves a dynamic `/js/config.js` (containing the Google Maps API key from a Cloudflare secret), and falls through to static asset serving for everything else.
- `wrangler.jsonc` configures the Worker (compatibility date, asset binding).
- `.assetsignore` prevents internal files (`_worker.js`, `wrangler.jsonc`, `README.md`, etc.) from being exposed as public URLs.
- `_headers` configures cache-control and security headers.

### One-time setup

1. **Push to GitHub:**
   ```bash
   cd hajj-app
   git init
   git branch -M main
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR-USERNAME/hajj-guide.git
   git push -u origin main
   ```

2. **Create the Worker:**
   - Cloudflare Dashboard → Compute (Workers) → Create
   - Connect to Git → pick the `hajj-guide` repo
   - Cloudflare detects `wrangler.jsonc` and configures itself
   - Save and Deploy

3. **Add the secret** (if using Google Maps):
   - Worker → Settings → Variables and Secrets → Add
   - Type: **Secret**, Name: `GOOGLE_MAPS_API_KEY`, Value: your key
   - Save and trigger a redeploy

4. **Add custom domain:**
   - Worker → Settings → Domains & Routes → Add
   - Enter your domain — Cloudflare detects it and offers automatic DNS setup

### Ongoing development

```bash
git add .
git commit -m "your change"
git push
```

Cloudflare auto-deploys on every push to `main` (~30 sec).

### Local development

```bash
npm install -g wrangler
wrangler dev
```

Runs the Worker locally on `http://localhost:8787`. Set `GOOGLE_MAPS_API_KEY` in a `.dev.vars` file (gitignored) for local testing of the dynamic config endpoint.

## Audio

Audio files are streamed by default and cached on demand. The Duas tab has a **"Download all audio for offline"** button that bulk-downloads everything available.

Currently `data/duas.json` references audio URLs only for the Talbiyah (others are `null`). To add more recitations:

1. Either host the MP3s yourself (`/audio/talbiyah.mp3`, etc) and point `audioUrl` to a relative path
2. Or use any reliable CDN/external link (be aware of CORS — the file must allow cross-origin GET)

The recommended reciter is **Mishary Rashid Alafasy** for clarity. To swap reciters in bulk, edit the URLs in `data/duas.json`.

## Customising content

- **Madhab rulings** — `data/rulings.json`. Each entry has `hanafi`, `shafi`, `maliki`, `hanbali` strings. Add new entries by appending to the array.
- **Duas** — `data/duas.json`. Same structure.
- **Itinerary template** — `data/itinerary-template.json`. Phases and per-day Hajj content.
- **Packing list** — currently in `js/guide.js` under `packingData()`. Move to a separate JSON file if you prefer.

## Privacy & data

The app stores everything in `localStorage` under the key `hajj-companion-v1`. No analytics, no telemetry, no server. The user's Settings tab includes a one-click "Reset all data" that clears localStorage and the audio cache.

## Disclaimer

This is a planning aid, not a fatwa. Rulings reflect commonly-held positions in each school but individual scholars may differ. Always confirm with a qualified scholar of your madhab. The author is not responsible for trip decisions made on the basis of this guide.

May Allah accept the Hajj of every pilgrim who uses it.

## License

MIT — fork it, modify it, host your own. Attribution appreciated but not required.
