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
/index.html              ← landing + onboarding wizard
/app.html                ← main guide
/manifest.json           ← PWA manifest
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
  config.js              ← real API keys (gitignored — never commit)
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

This project uses **Cloudflare Pages Functions** to serve the API key without committing it to git. The key lives only in Cloudflare's encrypted secret store and is injected at request time.

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
   - `https://hajj-guide.pages.dev/*`
   - `https://*.hajj-guide.pages.dev/*` (covers preview deploys)
4. Under **API restrictions**, choose **Restrict key** and select only:
   - Maps Embed API
   - Places API (New)
5. Save

### Step 3: Cap the daily quota

Still in Cloud Console:

1. APIs & Services → Quotas & System Limits
2. Filter for "Places API (New)" requests per day
3. Set a sensible daily cap (e.g. 1,000)

### Step 4: Add the key to Cloudflare Pages as a secret

1. Cloudflare Dashboard → Workers & Pages → your project
2. Settings → Variables and Secrets → **Add**
3. **Type:** Secret
4. **Variable name:** `GOOGLE_MAPS_API_KEY` (must match exactly)
5. **Value:** paste your API key
6. Apply to: both Production and Preview
7. Save

Trigger a redeploy (push any commit, or hit "Retry deployment" on the latest deploy in the Pages dashboard). Pages Functions runs the file at `functions/js/config.js.js` and it serves your config.js dynamically with the key.

### Local development with the API key

The Pages Function only runs on Cloudflare's edge — `python3 -m http.server` won't execute it. Two options:

**Option A — local config file (gitignored):**
```bash
cp js/config.example.js js/config.js
# edit js/config.js, paste your key
```
This file is in `.gitignore` so it won't be committed. The browser tries to load `/js/config.js` and finds your local one in dev. In production the Pages Function takes over.

**Option B — full Cloudflare simulation:**
```bash
npm install -g wrangler
wrangler pages dev .
```
This runs the Pages Function locally. You'll need to set `GOOGLE_MAPS_API_KEY` in a `.dev.vars` file (also gitignored).

## Deployment

The site is fully static and deployed via **Cloudflare Pages** with **GitHub** as the source.

### One-time setup

1. **Push to GitHub:**
   ```bash
   cd hajj-app
   git init
   git branch -M main
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR-USERNAME/hajj-companion.git
   git push -u origin main
   ```

2. **Create the Pages project:**
   - Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git
   - Authorise Cloudflare to access your GitHub
   - Pick the `hajj-companion` repo
   - Build settings:
     - Framework preset: **None**
     - Build command: *leave empty*
     - Build output directory: `/`
   - Save and Deploy

3. **Add the secret** (if using Google Maps):
   - Pages project → Settings → Variables and Secrets → Add
   - Type: **Secret**, Name: `GOOGLE_MAPS_API_KEY`, Value: your key
   - Apply to both Production and Preview
   - Save and trigger a redeploy

4. **Add custom domain:**
   - Pages project → Custom domains → Set up a custom domain
   - Enter your domain — Cloudflare detects it and offers automatic DNS setup
   - Wait 1–5 min for SSL provisioning

### Ongoing development

```bash
git add .
git commit -m "your change"
git push
```

Cloudflare auto-deploys on every push to `main` (~30 sec). Other branches get preview URLs at `branch-name.hajj-guide.pages.dev` for testing before merge.

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
