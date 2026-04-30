# Hajj Guide v2.1 — engagement + flight helpers

## What this drop contains

**Modified files:**
- `_worker.js` — adds `/api/feedback` (Resend) and `/api/like` (KV) routes
- `wrangler.jsonc` — declares KV binding + plain vars for feedback addresses
- `css/styles.css` — feedback modal + footer + like button + flight hint styles
- `js/onboarding.js` — smart flight helpers (auto-uppercase, IATA detection, verify links, date warning)
- `js/app.js` — wires Feedback.init() and Like.init() on app boot
- `index.html` — new footer with like button + feedback link, scripts wired
- `app.html` — same footer additions, scripts wired, analytics placeholder

**New files:**
- `js/feedback.js` — modal feedback form module
- `js/like.js` — like button counter module

## What changed and why

### 1. Smart flight helpers
- Auto-uppercases flight numbers as user types ("ba 147" → "BA147")
- Detects IATA prefix (first 2 chars), shows airline name beneath the field
- Adds "Verify on airline website ↗" link to that carrier's flight status page
- Warns if return date is the same as or before outbound date
- Falls back gracefully if airline unknown — no hint, no error
- ~25 carriers covered (Saudia, Emirates, Qatar, Turkish, BA, Delta, etc.)

### 2. Feedback form (Resend)
- Footer "Send feedback" link opens a centered modal
- Optional name + email, required message, honeypot anti-bot field
- Esc/backdrop/Cancel all close the modal
- Submit POSTs to /api/feedback, which calls Resend's REST API
- Resend sends an HTML email to FEEDBACK_TO with the message + meta (IP, country, UA)
- Reply-To set to user's email if they provided one

### 3. Like button (Workers KV)
- Footer button shows global "♥ N pilgrims" count
- One-click increment, blocked from re-counting via localStorage
- KV is eventually consistent — small races accepted

### 4. Cloudflare Web Analytics
- Placeholder script in both HTML files, commented out
- Replace YOUR_BEACON_TOKEN and uncomment after enabling in dashboard

## What did NOT change

- localStorage schema (`hajj-companion-v1`) untouched (one new key
  `hajj-companion-v1.likedAt` outside the Store object)
- Maps integration unchanged
- Tab structure unchanged
- All data files unchanged
- All other modules unchanged

## Deployment steps (in order)

### Step 1 — Drop in the new files

Replace these in your project (~/Downloads/hajj-app/):
- `_worker.js`
- `wrangler.jsonc`
- `css/styles.css`
- `js/onboarding.js`
- `js/feedback.js` (new)
- `js/like.js` (new)
- `js/app.js`
- `index.html`
- `app.html`

### Step 2 — Create the KV namespace for likes

In Cloudflare Dashboard:
1. Workers & Pages → KV → **Create namespace**
2. Name: `hajj-likes`
3. Click **Create**
4. Copy the **Namespace ID**
5. Open `wrangler.jsonc` and replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`

### Step 3 — Set FEEDBACK_TO in wrangler.jsonc

Replace `REPLACE_WITH_YOUR_EMAIL` with your email address.

### Step 4 — Verify your domain on Resend

EMAILS WON'T SEND UNTIL THIS IS DONE.

1. Sign up at https://resend.com (free tier)
2. Resend dashboard → **Domains** → **Add Domain** → enter `hajjguide.net`
3. They give you 3 DNS records to add (SPF, DKIM, MX-style)
4. Add those in Cloudflare DNS → wait 5-15 min for verification
5. When status shows "Verified", domain is ready
6. Resend dashboard → **API Keys** → **Create API Key** → copy value

### Step 5 — Set the Resend secret

```bash
cd ~/Downloads/hajj-app
wrangler secret put RESEND_API_KEY
```
Paste the key when prompted.

### Step 6 — Enable Cloudflare Web Analytics

1. Cloudflare Dashboard → **Analytics** → **Web Analytics**
2. **Add a site** → `hajjguide.net`
3. Copy the beacon token from the snippet
4. In `index.html` and `app.html`, find the commented analytics block at the bottom,
   replace `YOUR_BEACON_TOKEN`, remove the `<!-- ... -->`

### Step 7 — Push everything

```bash
cd ~/Downloads/hajj-app
git add .
git commit -m "v2.1: feedback form, like button, flight helpers, analytics"
git push
```

### Step 8 — Verify

In fresh incognito:
- Footer visible on every page
- "Send feedback" → modal opens
- Submit → "Thank you" state, email arrives in your inbox
- Like button → count increments, button stays "liked" on refresh
- Onboarding → type "BA22" → "British Airways · BA22" shows
- Return date < outbound date → warning appears

## Rollback

```bash
git revert HEAD
git push
```

## Known gotchas

- **Feedback won't work until Resend domain is verified** — graceful 503 until then
- **Likes won't persist until KV namespace is created** — graceful 0 until then
- **Analytics won't track until you uncomment the snippet** — placeholder is commented

Each piece is independently enableable. You can ship the code immediately
and complete Resend / KV / Analytics setup at your own pace.

## Deferred to v2.2

- Audio audit + sourced duas
- Nusuk operator list
