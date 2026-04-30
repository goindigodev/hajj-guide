# Hajj Guide v2.4 — hotel validation + Today tab

5 modified files. No new files. No deletions.

---

## Items shipped

### 1. Hotel date-range validation
Live warnings appear beneath each city's hotel list as the user types dates:

- **Reverse dates** — checkout before check-in
- **Overlap** — two hotels claim the same nights ("you can't be in two hotels at once")
- **Gap** — missing nights between two consecutive hotels ("Where are you sleeping in between?")
- **Outside flight window** — hotel dates fall before outbound or after return
- **Combined coverage** — combined hotels don't cover every night between flights ("Are you in Mina/Aziziyah those nights?")

Two warning levels: amber-red `⚠` (real conflicts) and brass `ℹ` (informational). Validation re-runs on every date change.

### 2. New "Today" tab — Hajj Day Plan view
Placed first in the tab nav (left of Overview). Shows different content based on trip state:

**Pre-trip** (today < outbound flight):
- Big Gregorian + Hijri date hero
- Large countdown number ("30 days until your Hajj begins")
- Outbound flight summary
- Suggestions for productive prep tabs

**On-trip** (within flight window):
- Big Gregorian + Hijri date hero
- **Today** section — today's day card pre-expanded with full instructions + actions
- **Today's duas** — pulled from the day card's `duaIds`
- **Yesterday** section — slightly dimmed, collapsed by default
- **Tomorrow** section — preview, collapsed by default
- **Quick contacts** strip — operator, group leader, 24-hr line, group contacts. Each is a tap-to-call link.

**Post-trip** (today > return flight):
- "Your Hajj has concluded. May Allah accept your pilgrimage…"
- Trip dates summary
- Pointer to Itinerary tab (for the day-by-day record) and Wisdom tab (for post-Hajj reflections)

**No flight data**: Prompt to complete onboarding.

#### Smart default
When the user lands on the app and they're currently mid-trip, the Today tab is selected automatically. Otherwise the app behaves as before (lands on Overview).

### Bonus: Hijri month transliteration cleanup
The browser's Intl API returns Hijri months with curly Unicode quotes and varying spellings (e.g. "Dhuʻl-Qiʻdah" vs "Dhuʼl-Qa'dah"). `Utils.formatHijri()` now normalises to friendly readings: "Dhul Hijjah", "Dhul Qa'dah", "Rabi I", "Jumada II", etc.

---

## Files changed

- `js/utils.js` — `validateHotelDateRanges()` + helpers; better Hijri month normalisation
- `js/onboarding.js` — validation panel under each hotel list, trip-coverage warning, hooks on date inputs
- `js/guide.js` — `tabToday()` + sub-renders, `_isOnTrip()`, smart default, tab nav config + dispatch
- `js/app.js` — Today added to TAB_LIST, smart-default sync after `Guide.init()` resolves
- `css/styles.css` — `.hotel-warnings*`, `.today-tab*`, `.today-hero*`, `.today-countdown*`, `.today-section*`, `.today-contacts*`

---

## Deployment

Replace these 5 files in `~/Downloads/hajj-app21/`:
- `css/styles.css`
- `js/utils.js`
- `js/onboarding.js`
- `js/guide.js`
- `js/app.js`

Then:
```bash
cd ~/Downloads/hajj-app21
git add .
git commit -m "v2.4: hotel date-range validation + Today tab (Hajj Day Plan)"
git push
```

---

## Verify on hajjguide.net (fresh incognito)

**Hotel validation (onboarding step 4):**
- Add two Madinah hotels with overlapping dates → see ⚠ overlap warning
- Add a Madinah hotel that ends before the next Makkah hotel begins → see ℹ gap warning
- Set a hotel's `to` date earlier than `from` → see ⚠ reverse warning
- Leave nights uncovered between flights → see ℹ "X nights between your flights have no hotel"

**Today tab — pre-trip:**
- Default tab on load: Overview (unchanged)
- Click "Today" tab → countdown number + Hijri date + flight summary

**Today tab — on-trip (test by setting your outbound date to yesterday + return to next week):**
- App lands on **Today** tab automatically
- Today's day card is expanded with day actions visible
- Yesterday + Tomorrow sections appear below

**Today tab — post-trip (set both flight dates to last month):**
- Default tab on load: Overview
- Click "Today" tab → "Your Hajj has concluded" message

---

## Risk profile

- 🟢 Hotel validation: contained to onboarding accommodation step + new pure function in Utils
- 🟢 Today tab: additive — existing tabs unchanged. Smart default only triggers when mid-trip (zero impact on most users most of the time)
- 🟡 The `_isOnTrip` check uses the device's local timezone. If a user's phone clock is on UK time but they're physically in Saudi Arabia, the day boundary shifts by 3 hours. This is an acceptable tradeoff — most pilgrims have their phone clocks set to local time.

If anything breaks: `git revert HEAD && git push`.
