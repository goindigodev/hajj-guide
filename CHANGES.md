# Hajj Guide v2.2-part2 — Hijri dates, Mina/Aziziyah, multi-hotel

Three substantial improvements building on v2.2-part1.

---

## Items shipped

### 5. Hijri dates wired into the UI
- Day cards in Itinerary now show Hijri date below the Gregorian date
  (e.g. "Wed, 20 May 2026" / "3 Dhul Hijjah 1447")
- Warning callout at the top of Itinerary tab when user's flight dates don't
  contain the 8–13 Dhul Hijjah window (suggests the trip might be Umrah-only
  or that dates need correcting)
- Uses the browser's built-in `Intl.DateTimeFormat` with `islamic-umalqura`
  calendar — matches the Saudi Umm al-Qura calculation. Zero dependencies.
- Note: Hijri dates may differ by ±1 day from official Saudi moon-sighting
  announcements (covered by the existing "times are approximate" disclaimer)

### 6. Two Mina camps (Mina vs Aziziyah)
- New onboarding question on the accommodation step: "Where will you sleep
  on the nights of 8th, 11th, 12th of Dhul Hijjah?"
- Three options: Inside Mina valley · In Aziziyah · I'm not sure yet
- When "Inside Mina valley" → reveals zone picker (A/B/C/D + unknown)
  and an optional sub-area/camp text field (e.g. "Muaisim", "Camp 12B")
- When "Aziziyah" → reveals an optional building/block text field
- Journey map adds an "Aziziyah" marker (building silhouette, brown accent)
  when the user selects Aziziyah; Mina marker is dimmed in that case to
  visually emphasise where the user actually sleeps
- Emergency Card now shows the user's Mina camp summary
  (e.g. "Mina · Zone B" or "Aziziyah · Aziziyah Tower 12")

### 7. Multi-hotel accommodation
- Schema changed: `madinahHotel` (single object) → `madinahHotels` (array)
- Same for `makkahHotel` → `makkahHotels`
- Each hotel: `{ name, address, placeId, lat, lng, fromDate, toDate }`
- Onboarding accommodation step rebuilt with multi-hotel support:
  - "+ Add another hotel" button per city
  - Each hotel entry has its own card with Remove button
  - From/To date pickers for each hotel
- Itinerary day cards now look up the right hotel by date (so if user has
  multiple Makkah hotels with different dates, each day shows the correct one)
- Emergency Card lists every hotel with its date range
- Locations tab shows all hotels (instead of just one per city)

#### Migration is automatic and silent
Existing users with the old single-hotel schema are migrated transparently
on next page load. The migration:
- Detects `config.madinahHotel` (old shape) without `config.madinahHotels`
- Converts it to a single-element array preserving all data
- Removes the old field
- Same for `makkahHotel`
- Idempotent — running twice does nothing

NO DATA IS LOST.

---

## What changed in this drop

**Modified files:**
- `js/utils.js` — already in v2.2-part1 (Hijri helpers); unchanged in part2
- `js/store.js` — DEFAULT_STATE schema, new `migrate()` function, hooked into `load()`
- `js/guide.js` — `renderDayCard` adds Hijri label, `tabItinerary` adds Hajj-period
  warning, `buildItineraryDays` passes raw `date` field, multi-hotel cascade across
  `renderJourneyMapHero`, `renderEmergencyCard`, `tabLocations`, `buildItineraryDays`,
  Aziziyah marker logic, Mina/Aziziyah emphasis classes
- `js/onboarding.js` — Mina camp section, multi-hotel UI in accommodation step,
  defensive defaults in init, `buildPlacesField` now uses callback uniformly
- `js/app.js` — already loads operators.json from v2.2-part1; unchanged in part2
- `css/styles.css` — new styles for `.day-card__date-col`, `.day-card__date-hijri`,
  `.mina-camp-types`, `.hotel-list`, `.hotel-entry`, journey map active/dim states

**No new files in this drop.**

---

## Deployment

### Step 1 — drop in the new files
Replace these in your project:
- `css/styles.css`
- `js/utils.js`
- `js/store.js`
- `js/onboarding.js`
- `js/guide.js`
- `js/app.js`

### Step 2 — commit and push
```bash
cd ~/Downloads/hajj-app21
git add .
git commit -m "v2.2-part2: Hijri dates, Mina/Aziziyah camps, multi-hotel"
git push
```

### Step 3 — verify

In a **fresh incognito window** (so the migration runs from saved data),
go to hajjguide.net.

If you have data already saved on your test browser:
- Itinerary day cards should now show "Hijri date" line below the Gregorian
- Emergency Card should list each hotel with date ranges
- No JS errors in the console

If you reset and re-onboard:
- Step 4 (accommodation) lets you add multiple hotels per city, each with dates
- Mina camp section appears at the bottom of step 4 with Mina/Aziziyah/unsure
- Journey map adds an Aziziyah marker when Aziziyah is selected
- Itinerary day cards correctly assign each day to the right hotel by date

---

## Risk profile

- 🟡 Item 7 (multi-hotel) is the highest-risk change in v2.2 because it
  changes the data schema. The migration runs once on load and is idempotent.
  Tested with both old-schema and new-schema localStorage entries.
- 🟢 Items 5 and 6 are additive — no schema migration risk.

If anything goes wrong:
```bash
git revert HEAD
git push
```

---

## Known limitations / what next session

- The journey map's Aziziyah marker is positioned visually but the SVG
  geometry isn't precisely geographic — Aziziyah in real life sits between
  Makkah and Mina; the marker is approximately there but stylised.
- Multi-hotel date-range validation is light: we don't currently warn if
  ranges overlap, gap, or extend outside the user's flight dates. Could
  be added later.
- Operator dropdown content (data/operators.json) still needs your manual
  verification against the official Nusuk page before you fully trust it.

