# Hajj Guide v2.9 — Print full itinerary

A new "🖨 Print full itinerary" button in the top-right of the Itinerary tab. Click it and your browser's print dialog opens with a single document covering every day of your trip, including any custom stops you've added.

## What's printed

Trip-level summary at the top:
- Pilgrim name, Hajj year (Hijri), madhab
- Date range
- Operator, group leader phone, 24-hr emergency line
- Madinah hotel, Makkah hotel

Then **one block per day** with:
- Day number, day-of-week, Gregorian date, Hijri date, location
- Day title (e.g. "Arrive in Madinah", "9 Dhul Hijjah · Yawm Arafah")
- Description
- "What to do" actions
- **Your custom stops** in a tinted callout — times in a left column, places aligned next to them
- Day note (the editorial callouts from the data file)
- Dua titles — single line, just titles separated by `·` (full Arabic / transliteration omitted to keep page count manageable)

A footer with print date and the hajjguide.net attribution.

## What's deliberately NOT printed

- The Reflection textareas (personal/empty at print time — journal export covers this separately)
- The journey map illustration (decorative)
- Phase pills / sticky strip (UI controls)
- Edit/Remove buttons on stops (already hidden in v2.8 print rules)
- Full Arabic dua text (would balloon the document to 30+ pages)

## Page format

A4 portrait, 14mm × 12mm margins. Days have `break-inside: avoid` rules so a day rarely splits across pages. A typical 14-day Hajj fits in 8–10 pages.

## How it works

Same overlay pattern as the Emergency Card (v2.7):
1. Click button → JS builds a fresh print-only render
2. Mounts it in `#it-print-overlay`
3. Sets `body.is-printing-itinerary` class
4. Print stylesheet hides everything except the overlay
5. Calls `window.print()`
6. Cleans up overlay + body class after the print dialog closes

Live UI is untouched throughout — the overlay is purely transient.

---

## Files in this drop

**Modified (v2.9):**
- `css/styles.css` — appended `.it-print*` styles + `body.is-printing-itinerary` print rules
- `js/guide.js` — added "Print full itinerary" button on Itinerary tab + `renderItineraryPrintable()` method
- `js/print.js` — added `Print.printFullItinerary()` method

No new files. No changes to onboarding, store, or any data files.

## Deployment

Replace these 3 files in `~/Downloads/hajj-app21/`:
- `css/styles.css`
- `js/guide.js`
- `js/print.js`

```bash
cd ~/Downloads/hajj-app21
git add .
git commit -m "v2.9: print full itinerary"
git push
```

## Verify on hajjguide.net

In a fresh tab:
1. Add a few custom stops to a day or two (use the v2.8 stops feature on the Itinerary tab)
2. Open **Itinerary** → top-right of the page should show "🖨 Print full itinerary"
3. Click it → browser print dialog opens with the full document preview
4. Verify the trip summary at the top, all days listed, your custom stops appearing in the gray callout boxes
5. Cancel the print, refresh — the live UI returns to normal (no overlay residue)

## Risk

🟢 **Low.** Same pattern as the Emergency Card print flow which is already in production:
- Overlay-based, transient, doesn't touch the live UI
- New CSS only fires when `body.is-printing-itinerary` is set — no risk of bleeding into normal browsing
- New JS methods are only called from one button; if button click fails, nothing else is affected
- If anything breaks: `git revert HEAD && git push` and you're back to v2.8
