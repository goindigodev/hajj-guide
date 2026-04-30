# Hajj Guide v2.8 — Custom stops on itinerary day cards

Pilgrims can now add their own stops to any itinerary day. Each stop has a place (chosen from a curated Ziyarat list, or typed in as free text) and optional start/end times.

## What changed

The stops feature is **purely additive** — the existing day card content (description, "What to do" actions, Duas, notes, Reflection) is untouched. Stops appear in a new "Your stops" section between the day's content and the Reflection textarea.

### How it works

When a day card is expanded:
1. **"Your stops" section** appears with all the user's added stops, sorted chronologically
2. **"+ Add a stop"** button below the list opens an inline form
3. Form fields: **Place** (combobox with type-ahead from the curated list, OR free text), **Start time** (optional), **End time** (optional)
4. Each stop has **Edit** and **Remove** actions
5. Curated places show their description as a sub-line; free-text entries don't

The combobox uses HTML5 `<datalist>` for native picker behaviour — works on all browsers, mobile keyboards show suggestions automatically, and free text always works.

### Curated Ziyarat list (21 places)

**Madinah (8)**: Quba Mosque, Masjid Qiblatain, Mount Uhud and the Martyrs' Cemetery, Jannat al-Baqi, Masjid al-Jumu'ah, The Seven Mosques (Sab'a Masajid), Wadi-e-Jinn (the magnetic valley), Date market and farms.

**Makkah (9)**: Jabal an-Nour (Cave of Hira), Jabal Thawr (Cave of Thawr), Jannat al-Mu'alla, Birthplace of the Prophet ﷺ (Mawlid), Masjid A'isha (at-Tan'eem), Masjid al-Khayf, Masjid Namirah (at Arafah), Masjid al-Mash'ar al-Haram, Clock Tower (Abraj al-Bait) viewing.

**Other (4)**: Operator-organised tour, Group meal, Shopping or errands, Rest at hotel.

For sites where rulings vary (Cave of Hira, Cave of Thawr, etc.), descriptions are factual and neutral ("not part of Hajj rites", "optional cultural visit"). Pilgrims and their scholars decide.

### Validation

- Place required: empty submissions show "Please enter or pick a place."
- Time sanity: if both times are given and end < start, shows "End time is before start time. Adjust or leave one blank."
- Empty stops auto-delete on save (storage hygiene)

### Storage

New key `hajj-companion-v1.stops` of shape:

```js
{
  '2026-04-30': [
    { id: 's_1761...', place: 'Quba Mosque', placeId: 'quba',
      startTime: '07:00', endTime: '09:00' },
    ...
  ]
}
```

`placeId` is set when the user picks from the curated list (so we can show the curated description). For free-text entries, `placeId: null`.

### Print

When printing the active tab, the "+ Add a stop" button, edit/remove actions, and any open forms are hidden. The stops list itself is preserved with simplified styling (no green tint background, just a left border) so a printed itinerary still shows your custom stops.

---

## Files in this drop

**New (v2.8):**
- `js/stops.js` — Stops module (~150 lines)
- `data/ziyarat-places.json` — 21 curated places

**Modified (v2.8):**
- `app.html` — added stops.js script tag
- `css/styles.css` — appended stops UI styles + print rules
- `js/app.js` — preload places list at boot
- `js/guide.js` — renderDayCard hooks in stops section + 3 new render helpers
- `js/store.js` — added `stops: {}` to default state

---

## Deployment

Replace these 5 files in `~/Downloads/hajj-app21/`:
- `app.html`
- `css/styles.css`
- `js/app.js`
- `js/guide.js`
- `js/store.js`

Add these 2 new files:
- `js/stops.js` (drop into `js/`)
- `data/ziyarat-places.json` (drop into `data/`)

```bash
cd ~/Downloads/hajj-app21
git add .
git commit -m "v2.8: custom stops on itinerary day cards"
git push
```

## Verify on hajjguide.net

In a fresh tab:
1. Open **Itinerary**, expand any day card
2. See the new **"Your stops"** section between Duas (or note) and Reflection
3. Click **"+ Add a stop"** — inline form appears
4. Type "Qu" — picker suggests "Quba Mosque" (and "Masjid Qiblatain")
5. Pick Quba, set times 07:00 – 09:00, click "Add stop"
6. Stop appears with sage left edge, time chip, name, and curated description
7. Click **Edit** — form pre-fills with current values
8. Click **Remove** — stop disappears
9. Try a free-text entry: type "Visit cousin in old city", no time, save — stop appears without a description (free text)
10. Try invalid times (end before start) — see the validation error
11. Open the **Today** tab — today's day card automatically shows the stops too (uses the same `renderDayCard()`)
12. Print the itinerary — stops are preserved, but edit/remove buttons are hidden

## Risk

🟢 **Low.** Purely additive feature:
- New module in its own file
- New storage key (`stops`) — separate from everything else
- Existing day card content untouched (verified — same description / actions / duas / note / reflection in the same order)
- If broken, just delete `js/stops.js` and the section disappears; everything else still works
- No change to public APIs, no change to the existing render functions' signatures

If anything breaks:
```bash
git revert HEAD && git push
```
