# Hajj Guide v2.5 (complete) — multi-language UI

Multi-language UI shipped across all four target languages: **English, Français, العربية, اردو**. Includes RTL support for Arabic and Urdu.

This drop completes sessions A + B + C of the v2.5 plan. The app now translates the chrome (header, tab nav, footer, switcher, all popups), the entire onboarding flow, and the in-app guide tab headings + leads + key buttons.

---

## What's translated

### Chrome (foundation, session A)
- Header (language switcher chip)
- Footer (Support with Duas, Share, Send feedback, Reset, tagline)
- Tab navigation labels
- Disclaimer popup
- Share popup (modal title, lead, tile labels, count text, copy feedback)
- Common UI words (Continue, Back, Skip, Cancel, etc.)

### Onboarding (session B) — entire 5-step flow
- Welcome step
- Flights step (incl. by-road checkboxes, airport combobox placeholders, date warnings)
- Madhab step (incl. school hint subtitles, "if unsure" callout)
- Operator step (Saudi Service Provider dropdown labels, group leader, 24-hr line, tip)
- Accommodation step (Madinah / Makkah hotel sections, hotel names, dates, Mina vs Aziziyah, zone picker, sub-areas)
- Group / companions step
- All hotel-validation warnings (overlap, gap, reverse dates, outside flight window, uncovered nights)

### Guide tabs (session C)
- Today tab — **fully translated** (countdown, on-trip sections, concluded message, no-flights state, quick contacts)
- Overview tab — heading, lead, "Bismillah" intro, Essentials of Hajj heading
- Itinerary tab — heading + lead
- 5 Days of Hajj tab — heading + lead
- Umrah tab — heading + lead
- Duas tab — heading + lead
- Rulings tab — heading + lead
- Locations tab — heading + lead
- Packing tab — heading + lead
- Preparation tab — heading + lead
- Wisdom tab — heading + lead
- Settings tab — heading + lead + all card headings + reset confirm + disclaimer body

### NOT translated (intentional, not yet)
- **Religious instructional content** in `data/itinerary-template.json`, `data/duas.json`, `data/rulings.json`. These are technical religious content that should be translated by qualified scholars per language, not by an AI assistant. The data files stay English; the UI structure around them translates.
- Day card body text (descriptions of what to do each day)
- Specific ruling text in the Rulings tab body
- Step-by-step Umrah procedure paragraphs
- Inline prep tips in Preparation/Wisdom tabs

### Behaviour notes
- **English is default.** New users land in English. They can switch via the header chip.
- **Persistence.** Locale stored in `localStorage` under `hajj-companion-v1.locale`. Survives reloads and data resets (separate key from main user data).
- **Auto-fallback.** Any string missing in fr/ar/ur falls back to English at runtime. So missing translations = visible English, never broken UI.
- **RTL.** Arabic and Urdu set `<html dir="rtl">` and use Amiri / Noto Nastaliq Urdu fonts where available. Layout flips correctly across header, tab nav, day cards, contacts.

---

## ⚠ Translation quality caveat

The French / Arabic / Urdu translations were produced by Claude (the AI assistant) and are **competent but not authoritative**. Native-speaker review is recommended before being trusted by real pilgrims, particularly:

- **Religious-adjacent register** — words like "pilgrim", "ruling", "madhab", "operator" carry different connotations across languages
- **Arabic specifically** — formal MSA was used; some pilgrims may expect more colloquial wording
- **Urdu specifically** — uses standard Urdu prose, not poetic register

Recommendation: ask a native speaker of each language to skim the translated UI and flag anything that reads oddly. The strings live in `data/i18n.json` — easy to edit one entry at a time.

---

## Files in this drop

**New (v2.5):**
- `js/i18n.js` — i18n machinery (~150 lines)
- `data/i18n.json` — translation dictionary (4 locales, ~1000 keys total across all sections)

**Modified (v2.5):**
- `index.html` — language switcher host + i18n script tag + boot now async + data-i18n attrs on footer
- `app.html` — same
- `css/styles.css` — language switcher chip + popover styles + RTL overrides + locale-specific font fallbacks
- `js/app.js` — async boot, I18n.init() first, switcher render + onChange refresh, tab i18n keys
- `js/utils.js` — validation messages now translated
- `js/disclaimer.js` — pulls strings via `I18n.t()`
- `js/share.js` — pulls strings via `I18n.t()` (incl. share text used in deep links)
- `js/onboarding.js` — 80+ string sites refactored
- `js/guide.js` — tab headings + leads + Today tab + Settings tab translated

---

## Deployment

Replace these files in `~/Downloads/hajj-app21/`:
- `css/styles.css`
- `index.html`
- `app.html`
- `js/app.js`
- `js/utils.js`
- `js/disclaimer.js`
- `js/share.js`
- `js/onboarding.js`
- `js/guide.js`

Drop in these new files:
- `js/i18n.js`
- `data/i18n.json`

```bash
cd ~/Downloads/hajj-app21
git add .
git commit -m "v2.5: full multi-language UI (en/fr/ar/ur) with RTL support"
git push
```

## Verify on hajjguide.net

In a fresh incognito tab:
1. Language chip in header shows "English"
2. Click → dropdown lists English / Français / العربية / اردو
3. Click Français → tab nav, footer, all UI translates to French
4. Click العربية → layout flips to RTL, Arabic strings visible
5. Click اردو → also RTL, Urdu strings visible
6. Reload → locale persists
7. Open onboarding → all 5 steps translate
8. Walk through any tab → headings + section labels translate
9. Day card body content stays English (intentional — religious instructional content)

## Risk

- 🟢 The i18n machinery is additive. With English locale active, the site behaves identically to v2.4.
- 🟢 Falls back to English for any missing key, so a partial translation never produces broken UI.
- 🟡 RTL layouts have been tested in onboarding and the Today tab. Some other tabs (Itinerary, Locations) may have minor layout quirks in RTL that surface only with real use. Easy fix on report.

If anything breaks, `git revert HEAD && git push`.
