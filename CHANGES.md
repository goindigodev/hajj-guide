# Hajj Guide v2.5 rollback — return to v2.4 working state

This drop **rolls back v2.5** entirely. The multi-language UI shipped in v2.5 had bugs that made the site strictly worse than v2.4 for users picking any non-English language. After deployment, this rollback restores the site to its last known-good state (v2.4: Today tab + hotel date-range validation).

## What was wrong with v2.5

1. **Raw i18n keys appeared as on-page text** for users (e.g. `onboarding.welcome.bismillah`, `guide.overview.lead`). This indicated `data/i18n.json` was not loading correctly in the deployed environment, causing the i18n fallback chain to return the key path itself.
2. **Homepage marketing copy** ("A companion for the journey of a lifetime", feature cards, intro paragraph) was never refactored — it stayed hardcoded English regardless of selected language.
3. **Locations / Packing / Preparation / Wisdom tabs** had only their `<h1>` heading and lead paragraph translated. The body content (lists of places, packing items, prep timeline, wisdom tips) stayed hardcoded English.
4. The above made the language feature look broken even where translations existed correctly.

## What this drop does

Restores every file v2.5 touched to its pre-v2.5 version:

**Restored to v2.4 state:**
- `css/styles.css`
- `js/app.js`
- `js/utils.js`
- `js/onboarding.js`
- `js/guide.js`

**Restored to v2.3 state** (these weren't touched by v2.4):
- `index.html`
- `app.html`
- `js/share.js`

**Restored to v2.2 state** (last touched in v2.2):
- `js/disclaimer.js`

**Files to delete** (added by v2.5, no pre-existing version):
- `js/i18n.js`
- `data/i18n.json`

## Deployment

### 1. Replace these files in `~/Downloads/hajj-app21/`

From this zip:
- `css/styles.css`
- `index.html`
- `app.html`
- `js/app.js`
- `js/disclaimer.js`
- `js/guide.js`
- `js/onboarding.js`
- `js/share.js`
- `js/utils.js`

### 2. Delete these files (they were added by v2.5)

```bash
cd ~/Downloads/hajj-app21
rm js/i18n.js
rm data/i18n.json
```

### 3. Commit and push

```bash
git add .
git commit -m "Rollback v2.5 — restore v2.4 working state"
git push
```

## Verify after deploy

In a fresh incognito tab on hajjguide.net:
- ✅ No language switcher chip in the header
- ✅ Homepage shows English marketing copy cleanly (no raw key paths)
- ✅ Onboarding works (flights step → madhab → operator → accommodation → group)
- ✅ Today tab shows daily plan if mid-trip, countdown if pre-trip
- ✅ Hotel date-range warnings still appear in the accommodation step

## What's preserved (v2.4 features still working)

- **Today tab** with smart trip-state detection (pre-trip countdown / on-trip plan / post-trip concluded)
- **Hotel date-range validation** with live feedback (overlap, gap, reverse, outside flight window, uncovered nights)
- **Multi-hotel** support per city
- **Hijri dates** in day cards
- **Mina vs Aziziyah** camp distinction
- **Type-ahead airport search** with by-road exit/entry support
- **Share button + counter**
- **Disclaimer popup**, **operator dropdown**, **mobile day-card layout**

## Risk

🟢 **Zero risk.** This bundle restores files to versions that were previously deployed and working. No new code, no new behaviour.

If for any reason something looks off after deploying:
```bash
git revert HEAD && git push
```
will roll forward back to v2.5.
