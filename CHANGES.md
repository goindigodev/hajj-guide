# Hajj Guide v2.5 (foundation drop) — multi-language UI

This is a **foundation drop**, not a complete release. The i18n machinery works, the language switcher works, the chrome translates correctly across all 4 locales — but the onboarding flow and the in-app guide tabs remain in English regardless of the selected language. They will be refactored in subsequent drops.

---

## What works in this drop

- **Language switcher chip** in the header (top-right, next to font-size control). Click to choose English / Français / العربية / اردو.
- **Persistent locale** — choice survives reloads (localStorage key `hajj-companion-v1.locale`).
- **RTL layout** — Arabic and Urdu correctly flip the layout direction (`<html dir="rtl">`).
- **Translated chrome:**
  - Footer (Support with Duas, Share, Send feedback, Reset my data, tagline)
  - Disclaimer popup
  - Share popup (modal title, lead, tile labels, count, copy feedback)
  - Tab navigation labels
  - The switcher itself
- **English fallback** — any string not yet translated falls back to English automatically (so missing translations are visible as English text, never broken).

## What does NOT translate yet (English only for now)

- The marketing copy on the landing page (`A companion for the journey of a lifetime`, the four feature cards)
- The entire onboarding flow (5 steps, ~80 strings)
- All in-app guide tabs (Today, Overview, Itinerary, 5 Days of Hajj, Umrah, Duas, Rulings, Locations, Packing, Preparation, Wisdom, Settings) — the biggest body of strings in the app
- Hotel validation warnings
- Day cards descriptions

These will be refactored in v2.5b and v2.5c. The pattern is established — it's just mechanical work to apply it across the larger files.

---

## ⚠ Translation quality caveat

The French / Arabic / Urdu translations were produced by Claude (the AI assistant) and are competent but **not authoritative**. They should be reviewed by a native speaker before being trusted by real pilgrims, particularly:

- **Religious-adjacent register** — words like "pilgrim", "ruling", "madhab", "operator" carry different connotations in different languages
- **Arabic specifically** — formal MSA was used; some pilgrims may expect more colloquial wording
- **Urdu specifically** — uses standard Urdu prose, not poetic register

Recommendation: ask a native speaker (a friend, your imam, a community member) to skim the translated UI in their language and flag anything that reads oddly. The strings live in `data/i18n.json` — easy to edit one entry at a time.

---

## Files in this drop

**New:**
- `js/i18n.js` — i18n machinery (~150 lines)
- `data/i18n.json` — translation dictionary (4 locales, ~800 strings total)

**Modified:**
- `index.html` — language switcher host + i18n script tag + boot now async + data-i18n attrs on footer
- `app.html` — same
- `css/styles.css` — language switcher chip + popover styles + RTL overrides
- `js/app.js` — async boot, I18n.init() first, switcher render + onChange refresh, tab i18n keys
- `js/disclaimer.js` — pulls strings via `I18n.t()`
- `js/share.js` — pulls strings via `I18n.t()` (including the share text used in deep links)

**Not yet touched (deferred):**
- `js/onboarding.js` — needs string extraction
- `js/guide.js` — needs string extraction
- `js/like.js` — only one string ("pilgrims"), already in i18n.json, applied via `data-i18n` on the footer span

---

## Deployment

Replace these files in `~/Downloads/hajj-app21/`:
- `css/styles.css`
- `index.html`
- `app.html`
- `js/app.js`
- `js/disclaimer.js`
- `js/share.js`

Drop in these new files:
- `js/i18n.js`
- `data/i18n.json`

```bash
cd ~/Downloads/hajj-app21
git add .
git commit -m "v2.5 foundation: i18n machinery + 4-locale chrome (en/fr/ar/ur)"
git push
```

## Verify on hajjguide.net

In a fresh incognito tab:
1. The language chip is visible in the header (shows "⌾ English ⌄")
2. Click it → dropdown shows English, Français, العربية, اردو
3. Click Français → footer text changes to French
4. Click العربية → footer flips to RTL, Arabic strings show
5. Reload the page → previously chosen language persists
6. Open the disclaimer modal (incognito should trigger it on first load) → it's translated
7. Click Share button → share modal is translated

Onboarding and in-app guide tabs will still be in English regardless of selected language. That's expected — fix in next drop.

## Risk

- 🟢 The i18n machinery is additive. Without selecting a non-English locale, the site behaves identically to v2.4.
- 🟢 Falls back to English for any missing key, so half-translated content never produces blank UI.
- 🟡 RTL CSS is scaffolded but not yet stress-tested in onboarding/guide. Some layouts might look awkward in RTL until session B fixes them.

If anything breaks, `git revert HEAD && git push`.
