# Hajj Guide v3.2 — In-app user guide modal

A new "i" (information) button in the header opens a modal slide presentation that walks pilgrims through the main features. 8 slides covering Welcome, Today, Itinerary, Add your own stops, Duas, Hajj journal, Emergency card, and Settings.

## What changed

### Header — new (i) button

A new circular icon button sits between the font-size selector and the print button. Same styling as the print icon. Click → modal opens.

### The modal

- 8 slides total, navigated by Next/Back buttons or arrow keys
- Page-indicator dots below the slide; click any dot to jump
- First slide is a welcome with no image (text-only intro)
- Slides 2–8 each have a screenshot + bullet points
- Last slide's "Next" button becomes "Done ✓" — clicking it closes the modal
- ESC closes
- Click outside the modal closes
- Body scroll locks while the modal is open
- Focus returns to the (i) button on close
- ARIA roles set for screen readers

### Slide content

1. **Welcome** — what Hajj Guide is, four key features
2. **Today** — the smart-default landing tab, today's day card
3. **Itinerary** — day cards, phase pills, journey map, print button
4. **Add your own stops** — the new v2.8 stops feature in detail
5. **Duas** — Arabic + transliteration + English, source citations
6. **Hajj journal** — Reflection textareas, Journal tab, text export
7. **Emergency card** — printable card with QR code, Saudi numbers
8. **Settings** — name, font size, edit trip, reset

### Screenshots

7 JPEGs at 1100px wide, optimized to ~50KB each (362KB total). Captured from the live UI with realistic example data so they show what the user will actually see.

### Print

Modal is hidden in print output (`@media print { .userguide-overlay { display: none } }`). Doesn't interfere with the existing emergency card or full itinerary print modes.

### Mobile

At ≤640px the modal goes full-screen with no rounded corners. Smaller fonts, tighter padding. Screenshots scale to fit the viewport width.

---

## Files in this drop

**New (v3.2):**
- `js/userguide.js` — UserGuide module (~280 lines)
- `img/userguide/01-today.jpg` — Today tab screenshot
- `img/userguide/02-itinerary.jpg` — Itinerary tab heading + Print button
- `img/userguide/03-stops.jpg` — Day card with custom stops + Reflection
- `img/userguide/04-duas.jpg` — Talbiyah dua with full Arabic/transliteration/English
- `img/userguide/05-journal.jpg` — Journal tab with one entry
- `img/userguide/06-emergency-card-print.jpg` — Rendered emergency card with QR
- `img/userguide/07-settings.jpg` — Settings tab

**Modified (v3.2):**
- `app.html` — added (i) button + userguide.js script tag
- `css/styles.css` — appended ~180 lines of modal styles
- `js/app.js` — wired up the (i) button click

No data layer changes. No changes to onboarding, store, journal, stops, print, or any other module.

---

## Deployment

```bash
cd ~/Downloads/hajj-app21
unzip -o ~/Downloads/v3.2-update.zip -d /tmp/v32

# Copy the modified files
cp /tmp/v32/v32/app.html .
cp /tmp/v32/v32/css/styles.css css/
cp /tmp/v32/v32/js/app.js js/

# Add the new module
cp /tmp/v32/v32/js/userguide.js js/

# Add the screenshots — create the directory first if it doesn't exist
mkdir -p img/userguide
cp /tmp/v32/v32/img/userguide/*.jpg img/userguide/

git add .
git commit -m "v3.2: in-app user guide modal with 8-slide tour"
git push
```

## Verify on hajjguide.net

After deploy:

1. Open the app
2. Top-right header — see the new (i) icon between font-size and print
3. Click it — modal opens centered on the dimmed page
4. Slide 1 "Welcome" — read the intro, no image yet
5. Click Next — slide 2 "Today" with screenshot
6. Click any dot to jump to a specific slide
7. Click outside the modal → closes
8. Click (i) again → re-opens at slide 1
9. Press Esc → closes
10. Press → → → → → → → on slide 8 Next becomes "Done ✓"
11. Click Done → closes
12. Test on mobile — modal should be full-screen

## Risk

🟢 **Low.** Purely additive feature:
- New module in its own file
- New images in their own subfolder
- No data layer changes
- Modal is hidden by default; only shown when (i) clicked
- If broken: delete `js/userguide.js` and the (i) button button does nothing — everything else works fine
- Print modes still work unchanged

If anything looks off:
```bash
git revert HEAD && git push
```
