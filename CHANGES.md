# Hajj Guide v3.3 — Hotel-driven itinerary + accommodation prompt

The Itinerary day cards are now driven by the user's actual hotel check-in/out dates instead of a hardcoded "first 3 days = Madinah" heuristic. When hotel dates change, the itinerary reshapes around them. When dates are missing, a prominent banner prompts the user to add them.

## What changed

### `buildItineraryDays()` — full rewrite

Was: total trip length divided into a fixed-shape Madinah/Travel/Makkah/Hajj/Makkah/Wada/Return structure, with day count per phase computed by ratios from the flight dates.

Now: the function walks every day in the trip and decides each day's phase by checking, in order:

1. Is this the outbound flight date? → **Departure**
2. Is this the return flight date? → **Return Home**
3. Is this the day before return? → **Tawaf al-Wada**
4. Is this 8-12 Dhul Hijjah (via `Utils.toHijri()`)? → **Hajj day** (anchored to actual Hijri date, not flight offset)
5. Is this the natural travel day (last Madinah day, or first Makkah day, or the overlap day)? → **Travel to Makkah · Umrah**
6. Is this date inside any Madinah hotel range? → **In Madinah · Day N** (using the hotel name as the location)
7. Is this date inside any Makkah hotel range? → **In Makkah · Day N**
8. Fallback: if Travel-to-Makkah already fired, treat remaining days as Makkah; otherwise show a placeholder.

The result is that a Madinah hotel of dates Apr 27 → Apr 30 produces 4 Madinah day cards. Change it to Apr 27 → May 2 and you get 6 Madinah day cards. The Makkah days similarly follow the Makkah hotel range.

The 5 Hajj days remain anchored to **8-12 Dhul Hijjah** regardless of where they fall in the trip — they no longer slip when flight dates don't match the Hajj period.

### Default fallback (`_buildDefaultItinerary`)

When no flight dates AND no hotel dates are configured (e.g. user skipped onboarding or just reset), the page shows a generic 14-day Hajj reference itinerary. This matches the previous behaviour but is now an explicit named function (separated cleanly from the date-driven path).

### "Make this itinerary yours" CTA banner

A new prominent banner at the top of the Itinerary tab, shown when neither Madinah nor Makkah hotels have dates configured. Brass left accent, gradient cream background, big serif title, a deep-green primary button labelled "Add accommodation dates →" that jumps to the Settings tab.

When only one city is set (e.g. Madinah dates but no Makkah), a softer info-callout nudge appears asking for the missing one.

### Boundary edge cases handled

- **Hotel overlap on the same day** (last Madinah night = first Makkah night) → that day is the Travel-to-Makkah/Umrah day
- **Gap between hotels** → travel day fires on the first Makkah-hotel day
- **Madinah only, no Makkah** → travel day fires the day after Madinah ends, then remaining days default to "In Makkah" (de-facto)
- **Very short Madinah stay** (e.g. 2 days) → only 2 Madinah cards, not the previous fixed 3
- **Hajj period not in trip** (Umrah-only outside Hajj season) → Hajj day cards don't appear; itinerary is just Madinah/travel/Makkah days

## Tested scenarios

✅ No hotels (skip user) → CTA banner + generic 14-day reference
✅ Madinah only → softer nudge + Madinah days follow hotel range, Makkah days appear after travel
✅ Both with 4-day Madinah → 4 Madinah cards + travel day + Makkah cards
✅ Both with 2-day Madinah → 2 Madinah cards + travel day + Makkah cards
✅ Real Hajj 2026 trip (May 18 → Jun 4) → Madinah Days 1-6, Travel/Umrah on May 24 (overlap), 5 Hajj day cards anchored to actual Hijri dates, post-Hajj Makkah days, Wada, Return

## What stays exactly the same

- The 5 Hajj day card data (titles, locations, summaries) — those come from `data/itinerary-template.json` and aren't touched
- Day-card UI, custom stops, journal/reflection, print modes — all untouched
- The journey map and phase-pill strip — both still work
- Settings tab — still where users configure hotel dates
- Onboarding flow — unchanged

---

## Files in this drop

**Modified (v3.3):**
- `js/guide.js` — `buildItineraryDays()` rewrite + new `_buildDefaultItinerary()` helper + Itinerary tab CTA banner
- `css/styles.css` — appended ~70 lines for `.itinerary-cta` styles

No new files. No changes to onboarding, store, journal, stops, print, or any other module. No data file changes.

---

## Deployment

Replace these 2 files in `~/Downloads/hajj-app21/`:

```bash
cd ~/Downloads/hajj-app21
# replace js/guide.js and css/styles.css from v3.3-update.zip
git add .
git commit -m "v3.3: hotel-driven itinerary + accommodation CTA"
git push
```

## Verify on hajjguide.net

After deploy:

1. **As a user with hotel dates** — go to Itinerary, see day cards matching your actual hotel check-in/out (Madinah days = Madinah hotel duration, etc.)
2. **Change a hotel date** in Settings — go back to Itinerary, day cards re-shape immediately to match
3. **Reset all data** (Settings → Reset) — Itinerary now shows the generic 14-day reference plus the prominent "Make this itinerary yours" banner with the "Add accommodation dates →" button
4. **Skip onboarding** entirely (clear localStorage and click skip on the home page) — same banner + generic itinerary
5. Click the "Add accommodation dates →" button — should jump to Settings tab where the user can add hotels

## Risk

🟢 **Low.** This is a focused refactor of one function plus a new banner:

- The function signature is unchanged — every caller (Today tab, Itinerary tab, print itinerary) still gets the same shape
- The default fallback path preserves the previous behaviour for users without hotel data
- Existing per-day features (custom stops, reflection, duas) work identically since they depend only on the `date` field
- If a bug surfaces: `git revert HEAD && git push` and you're back to v3.2

If anything renders unexpectedly, the most likely culprits are:

- A user with malformed hotel dates (e.g. `fromDate` after `toDate`) — now visible as zero or weird Madinah days. Nudge message tells them to fix it
- A user whose flight dates fall entirely outside the 8-12 Dhul Hijjah window for their booked Hajj year — previously the labels were wrong, now Hajj day cards just don't appear (more accurate)
