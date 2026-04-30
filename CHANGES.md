# Hajj Guide v2.3 — UI fixes & share button

8 modified files + 2 new files. No deletions.

---

## What's in this drop

### Footer & header refinements
- **Removed** GitHub link from footer (both index.html and app.html)
- **Added** "Support this page with your Duas" preamble before the like chip
- **Added** Share button next to the like chip
- "Send feedback" + "Reset my data" moved to a quieter secondary footer row

### UI consistency fixes
- The Saudi service provider dropdown, Mina zone select, and sub-area text inputs
  used `field__input` class which was undefined — now defined to match `.input`
  styling (Lora font, sage focus border, paper background)
- Native `<select>` elements get a custom chevron via SVG background-image
  so they match the rest of the form

### Mobile day-card layout
- On screens ≤600px wide, day-card headers now stack vertically:
  date row at top (Greg + Hijri inline), title on its own line, location below,
  chevron always right-aligned. Stops the header from wrapping into 4–5 lines.

### Flight step rebuild
- **Two new checkboxes**: "Entry by road (no flight)" on the outbound leg,
  "Exit by road (no flight)" on the return leg. Independent. When checked,
  the flight number + departure airport + arrival airport fields hide for
  that leg. Date/time still visible.
- **Type-ahead airport combobox** for departure and home airports. Search
  by city, IATA code, country, or airport name. ~80 worldwide airports curated.
- **Saudi-only combobox** for arrival airport on outbound and "from" airport
  on return — JED, MED, RUH, DMM.
- Itinerary day cards adapt: when byRoad is set, departure/return cards say
  "Departure (by road)" and show "Land crossing → KSA" instead of flight info.

### Share button & counter
- New `data/api/share` endpoint in the Worker, identical pattern to `/api/like`
- Same KV namespace (LIKES) — share counter stored under key `share-total`
- Share modal with WhatsApp, Telegram, Email, Copy-link tiles
- Each click increments the counter
- Counter visible at bottom of modal (e.g. "Shared 47 times")

---

## Files changed

**Modified:**
- `_worker.js` — generalised `handleCounter()` for like + share, added `/api/share` route
- `index.html` — footer rebuild, share.js script tag
- `app.html` — footer rebuild, share.js script tag
- `css/styles.css` — `.field__input` definitions, native select chevron, mobile
  day-card grid, footer refinements, combobox, travel-mode checkbox, share modal
- `js/store.js` — `outboundFlight.byRoad` + `returnFlight.byRoad` fields (default false)
- `js/onboarding.js` — flights step rebuilt with byRoad + airport combobox; airports list loaded
- `js/guide.js` — departure/return day cards adapt to byRoad
- `js/app.js` — Share module init

**New:**
- `js/share.js` — share modal logic
- `data/airports.json` — curated worldwide + Saudi airport list

**No deletions.**

---

## Deployment

### Step 1 — replace these files in `~/Downloads/hajj-app21/`:
- `_worker.js`
- `index.html`, `app.html`
- `css/styles.css`
- `js/store.js`, `js/onboarding.js`, `js/guide.js`, `js/app.js`
- `js/share.js` (new — drop in)
- `data/airports.json` (new — drop in)

### Step 2 — commit and push
```bash
cd ~/Downloads/hajj-app21
git add .
git commit -m "v2.3: footer cleanup, share button, byRoad flights, airport combobox, mobile day-card fix"
git push
```

### Step 3 — verify on hajjguide.net (fresh incognito)

**Footer:**
- ✅ No GitHub link
- ✅ "Support this page with your Duas" before the heart chip
- ✅ "Share" button next to heart chip
- ✅ Click Share → modal opens with 4 tiles
- ✅ Click WhatsApp tile → wa.me opens with prefilled message
- ✅ Click Copy → button shows "Copied ✓" briefly

**Onboarding flights step:**
- ✅ Outbound section has "Entry by road (no flight)" checkbox at top
- ✅ Return section has "Exit by road (no flight)" checkbox at top
- ✅ Untick: flight + airport fields visible
- ✅ Tick: flight + airport fields hide; date/time remain
- ✅ Departure airport: type "lon" → 4 London airports + Barcelona
- ✅ Arrival airport: type "jed" → JED Jeddah only (Saudi-restricted)
- ✅ All inputs use the same Lora font and styling

**Mobile (open dev tools, switch to iPhone view):**
- ✅ Day cards in Itinerary stack cleanly
- ✅ Day cards in 5 Days of Hajj stack cleanly
- ✅ Header doesn't wrap into 4+ lines

**Operator step (existing):**
- ✅ Saudi Service Provider dropdown matches form styling
- ✅ Mina zone dropdown (when "Inside Mina valley" selected) matches form styling

---

## Risk profile

- 🟢 Footer changes: pure HTML/CSS, no logic
- 🟢 UI consistency: defines a previously-undefined CSS class
- 🟢 Mobile day-card: pure CSS, scoped to ≤600px viewport
- 🟢 Airport combobox: new component, isolated
- 🟢 byRoad checkboxes: schema-additive (default `false`); existing user data unaffected
- 🟢 Share button: same Worker pattern as like, KV already configured

The KV namespace is already in place (you mentioned the like counter works),
so `/api/share` will work immediately without dashboard changes.

If anything breaks: `git revert HEAD && git push`.

---

## Known limitations

- **Airport list** is curated, not exhaustive (~80 airports). Smaller hubs aren't
  listed but users can still type the IATA code manually — the input accepts free
  text if no match is found.
- The Saudi list has the 4 international airports (JED, MED, RUH, DMM). Domestic
  Saudi airports aren't included.
- Share counter starts at 0 separate from the like counter (different KV key).

