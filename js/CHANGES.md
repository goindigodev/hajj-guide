# Hajj Guide v2.7 — Hajj Journal + Print-optimised Emergency Card

Two features in this release:

1. **Hajj Journal** — a place for pilgrims to record daily reflections, both inline with the itinerary and in a dedicated tab
2. **Print-optimised Emergency Card** — single A4 page with all critical contact info, large fonts, and a QR code for the operator's emergency line

---

## 1. Hajj Journal

Journal entries live in two places:

- **Inline on each day card in the Itinerary tab.** When a day card is expanded, a "Reflection" textarea appears at the bottom. Pilgrims can write directly next to that day's plan. Auto-saves as they type (600ms debounce). Shows a "✓ Saved" indicator briefly.
- **A dedicated Journal tab** (13th tab, between Wisdom and Settings). Aggregates all entries chronologically, most recent first. Each entry shows the day-of-week + Hijri date + body text with paragraph breaks preserved. Includes "Export as text" button that downloads `hajj-journal.txt`.

### Empty state
Friendly callout: "Open any day in the Itinerary tab and write a reflection. Your entries will collect here." Plus an "Open Itinerary →" jump button.

### Storage
New key `hajj-companion-v1.journal` of shape `{ 'YYYY-MM-DD': { text, updatedAt } }`. Defensive default added to `Store.js`. Empty entries auto-delete (storage hygiene). Force-flush on page hide / blur / unload so the last few keystrokes always persist.

---

## 2. Print-optimised Emergency Card

A new "Print emergency card" button on the **Overview tab** (replacing the old discrete print link).

When clicked, the card mounts in a print overlay and triggers `window.print()`. The print stylesheet hides everything else; only the card prints.

### What's on the card
- **Pilgrim**: name (in big serif, taken from onboarding) + madhab + party size
- **Hajj operator**: name, Saudi service provider (if known), group leader name + phone
- **24-hr emergency line**: in a big bordered box, prominent
- **Accommodation**: every Madinah/Makkah hotel with check-in dates if known + Mina camp / zone / Aziziyah area
- **Saudi Arabia emergency numbers**: 5-cell grid showing 911 / 997 / 999 / 998 / 930 with role labels
- **Travel companions**: list of group contacts (if any)
- **QR code (right side)**: encodes `tel:+966...` for the operator emergency phone, so a Saudi local can scan and call. Falls back to displaying just the number if QR generation fails.
- **Footer reminder**: "Keep this card with you at all times. Show to authorities if separated from your group."

### Page format
- A4 portrait, 12mm margins
- Single page — fits comfortably even with multiple hotels and group contacts
- Larger fonts: 22pt for the pilgrim's name, 18pt for the emergency line, 16pt for Saudi numbers, 12pt body
- Pure black on white (no decorative colour) — survives B&W printers and photocopying

### Pilgrim name handling
A new "Your name" field is added to:
- The first step of onboarding (welcome step). New users fill it in here.
- The Settings tab. Existing users from v2.4 who never had this field can fill it in here without re-onboarding.
- Defensive default of empty string if missing — the card prints `[Your name]` placeholder.

---

## Files in this drop

**New (v2.7):**
- `js/journal.js` — Journal module (~150 lines)
- `js/vendor/qrcode.min.js` — `qrcode-svg` library v1.1.0 by papnkukn, MIT licensed (18.6KB minified)

**Modified (v2.7):**
- `index.html` — no changes (rebundled for safety)
- `app.html` — added qrcode.min.js + journal.js script tags
- `css/styles.css` — appended journal reflection styles, journal tab styles, emergency card styles + print rules
- `js/app.js` — added "Journal" entry to TAB_LIST
- `js/onboarding.js` — added pilgrim name field to welcome step
- `js/guide.js` — TABS list + tabJournal() + renderEmergencyCardPrintable() + Settings name field + Overview print button + journal tab re-render on switchTab
- `js/print.js` — added Print.printEmergencyCard() method
- `js/store.js` — added `journal: {}` to default state

---

## Deployment

### 1. Replace these 8 files in `~/Downloads/hajj-app21/`

From this zip:
- `index.html`
- `app.html`
- `css/styles.css`
- `js/app.js`
- `js/guide.js`
- `js/onboarding.js`
- `js/print.js`
- `js/store.js`

### 2. Add these 2 new files

- `js/journal.js` (drop into `js/`)
- `js/vendor/qrcode.min.js` (you'll need to create the `js/vendor/` subdirectory first — `mkdir -p js/vendor` from the project root)

```bash
cd ~/Downloads/hajj-app21
mkdir -p js/vendor
# Then copy js/vendor/qrcode.min.js from the zip into js/vendor/
git add .
git commit -m "v2.7: Hajj journal + print-optimised emergency card"
git push
```

---

## Verify after deploy

In a fresh tab on hajjguide.net:

### Journal
1. Click **Itinerary** → expand any day card → see the "Reflection" section with a textarea
2. Type something → wait a moment → see "✓ Saved" appear briefly
3. Switch to the **Journal** tab → your entry appears with date + body
4. Click **Export as text** → downloads `hajj-journal.txt` containing the entry

### Emergency card
1. Open **Overview** → scroll to "Emergency Card" → see "🖨 Print emergency card" button
2. Click it → browser print dialog appears showing the single-page card with QR code
3. Scan the QR code with a phone camera → it should open a `tel:` dialer with your operator emergency number

### Pilgrim name
1. **Settings** → top of page should show "Your name" field
2. Or, if you reset and onboard from scratch → the welcome step now asks for your name

---

## Risk

🟢 **Moderate.** New code is well-isolated:
- Journal is purely additive (new module, new tab, new storage key). If broken, the rest of the app still works.
- Emergency card uses an overlay that only renders during the print flow — doesn't affect normal viewing.
- The `qrcode-svg` library is small, well-tested, MIT licensed, no dependencies.
- Existing emergency card on the Overview tab (the old summary view) is preserved alongside the new print button.

If anything breaks:
```bash
git revert HEAD && git push
```

## What's NOT in this drop

- Journal entries are stored locally only. There's no sync, no backup. If a pilgrim resets their data or clears localStorage, entries are lost. Export-as-text is the only persistence option.
- The QR code encodes the operator emergency phone only. If you want a more general "scan to call any of my contacts" QR, that's a follow-up.
- Emergency card doesn't yet include flight numbers (could be added if useful — currently it's about who to call, not the trip schedule).
- The on-screen Emergency Card on the Overview tab still uses the old simpler layout — the print version is the new richer one. Consolidating them is possible but optional.
