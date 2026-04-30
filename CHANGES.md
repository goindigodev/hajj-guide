# Hajj Guide v3.0 — Tab nav redesign (Option A)

The 13-tab horizontal nav got three improvements that make scrolling discoverable and the active state much clearer. Single-row layout preserved — only the styling and affordances changed.

## What changed

Three things, all in service of "make it obvious there are more tabs and which one you're on":

### 1. Stronger active state (sage-tinted pill)

Was: a faint sage tint plus a brass underline. Easy to miss.
Now: a clear sage-tinted pill with deep-green text and slightly heavier weight. Matches the v2.6 phase pill aesthetic on the Itinerary tab — visual consistency.

### 2. Chevron arrows for scrolling

A small circular chevron button (`‹` / `›`) appears on each end whenever overflow exists. It auto-shows and auto-hides based on scroll position:

- **At the left edge:** only `›` is visible
- **Mid-scroll:** both visible
- **At the right edge:** only `‹` is visible
- **No overflow (e.g. very wide viewport):** neither visible

Click → scrolls 70% of the visible width with smooth scroll. Buttons are 28px desktop / 24px mobile, sit on a paper-coloured circle with a subtle border and shadow so they stand out against the cream background.

### 3. Auto-scroll active tab into view

When the user clicks a tab that's partially or fully off-screen (e.g. clicking "Settings" while looking at the start of the strip), the strip now smooth-scrolls so the active pill is fully visible with a 40px margin from the chevrons. Stops the active pill ever being clipped behind a chevron.

## What stays exactly the same

- 13 tabs, same labels, same order, same widths
- Single-row layout
- Sticky behaviour (tab-nav stays at the top below the site header during scroll)
- Edge-fade gradients (kept; tightened slightly to ~20px from 16px to better match the chevron)
- Accessibility: tab-nav__btn keeps its `role="tab"` and 44px min-height on mobile
- Rendering, switching, and the smart default tab selection all work identically

---

## Files in this drop

**Modified (v3.0):**
- `css/styles.css` — rewrote `.tab-nav*` rules (~50 lines), updated journey-strip sticky offset to match new ~49px nav height
- `js/app.js` — appended chevron creation + scroll listeners (~50 lines, all inside the existing nav-build block)
- `js/guide.js` — extended `switchTab()` to scroll the active button into view when off-screen

No new files. No changes to onboarding, store, journal, or stops.

---

## Deployment

Replace these 3 files in `~/Downloads/hajj-app21/`:

```bash
cd ~/Downloads/hajj-app21
# replace css/styles.css, js/app.js, js/guide.js from v3.0-update.zip
git add .
git commit -m "v3.0: tab nav redesign — sage pills, chevrons, auto-scroll active"
git push
```

## Verify on hajjguide.net

In a fresh tab:

1. Open the app at desktop width — see the active tab is now a sage pill (clearer than before)
2. See a small `›` chevron on the right edge
3. Click `›` — strip scrolls right, `‹` appears on the left, `›` may hide if you've reached the end
4. Click a tab that's partially visible — it auto-scrolls fully into view
5. Resize the window to be very wide → both chevrons should disappear
6. On a phone — the chevrons sit at 24px each, smaller pills, edge fade visible
7. Print itinerary or emergency card — chevrons hidden in print as expected

## Risk

🟢 **Low.** All changes are additive on top of existing markup:
- HTML markup is unchanged (chevron buttons are appended via JS at boot)
- New CSS rules replace old ones cleanly within the `.tab-nav*` namespace
- No change to data layer or any other module
- Print stylesheets already hide `.tab-nav` in both emergency-card and full-itinerary print modes — chevrons inherit that

If anything looks off:
```bash
git revert HEAD && git push
```

## What's NOT in this drop

- Did not implement Option B (two-row split) — the user-chosen direction was Option A
- Did not change the tab labels (e.g. shorten "5 Days of Hajj" to "Hajj Days") — keeping the existing copy untouched
- Did not add a "More" overflow menu — that was a different option (C)
- The tab-nav is now ~49px tall (vs the previous ~56px). The journey-strip sticky offset was updated to match, but if any other sticky element or scroll-margin elsewhere in the app assumed 56px, it might now have a small visual offset. None spotted in testing, but keep an eye out for things hiding under the nav when scrolled to anchors
