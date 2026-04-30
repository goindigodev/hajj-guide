# Hajj Guide v2.2-part1 — audio removal, disclaimer, operator dropdown

## Items shipped in this drop

1. **Audio feature removed completely** — until proper recordings are sourced
2. **Disclaimer popup** on first page load
3. **Tour operator dropdown** with the 12 Nusuk-approved Saudi providers + free-text "Other"
4. **Hijri conversion helpers** added to Utils (not yet wired to UI — coming next session)

## Items deferred to v2.2-part2 (next session)

5. Wire Hijri dates into day cards + "your flights don't contain Hajj" warning
6. Two Mina camps support (regular vs Mina Jadeed)
7. Multi-hotel accommodation (with localStorage migration for existing users)

These three are bigger and touch the data schema. Better to do them fresh.

---

## What changed in this drop

### Modified files
- `index.html` — disclaimer.js script tag, init call, reset hook
- `app.html` — disclaimer.js script tag (audio.js removed)
- `css/styles.css` — disclaimer modal styles added; audio progress bar styles removed
- `js/utils.js` — `toHijri()`, `formatHijri()`, `containsHajjPeriod()` helpers added
- `js/guide.js` — Settings audio card + per-dua audio + bulk download all stripped; reset description updated
- `js/app.js` — Disclaimer init, Audio init removed, header comment updated
- `js/onboarding.js` — operator step rebuilt with local-agency text + Saudi-provider dropdown

### New files
- `js/disclaimer.js` — first-visit modal with calligraphic ornament
- `data/operators.json` — Nusuk-approved Saudi service provider list

### Deleted
- `js/audio.js` — removed (must `git rm` locally)

---

## Deployment

### Step 1 — drop in the new files
Replace these in your project (~/Downloads/hajj-app21/):
- `index.html`
- `app.html`
- `css/styles.css`
- `js/utils.js`
- `js/guide.js`
- `js/app.js`
- `js/onboarding.js`
- `js/disclaimer.js` (new — drop in)
- `data/operators.json` (new — drop in)

### Step 2 — delete the orphaned audio.js
```bash
cd ~/Downloads/hajj-app21
rm js/audio.js
```

### Step 3 — verify the operator list

**IMPORTANT.** I included 13 providers in `data/operators.json` based on what I could see from the Nusuk public site. The news article from Hajj Reporters said "12 providers" approved for 1447H — there's a discrepancy worth checking.

Visit https://hajj.nusuk.sa/ServiceProviders and confirm:
- The exact count (12 or 13?)
- The exact spelling of each name (the Nusuk page uses different formatting from press releases)

Edit `data/operators.json` to match the official list before pushing.

The current file flags this in `_note` and `_lastVerified` fields at the top.

### Step 4 — commit and push
```bash
cd ~/Downloads/hajj-app21
git add .
git commit -m "v2.2-part1: remove audio, add disclaimer, operator dropdown"
git push
```

### Step 5 — verify on hajjguide.net (fresh incognito)
- First visit: disclaimer modal appears with "Before you begin"
- Click "I understand" → modal dismisses (with fade-out animation)
- Refresh page → modal does NOT reappear (acknowledged)
- Open onboarding → step 3 (operator) shows local-agency text + Saudi Service Provider dropdown
- Pick a provider from the dropdown OR pick "Other" → text field appears
- Open the Settings tab → no "Offline audio" card; no audio-related copy in reset card
- Open the Duas tab → no "Download all audio" button; no audio players on dua cards

---

## Risk profile

- ✅ Audio removal: clean — everything that referenced audio has been updated
- ✅ Disclaimer: isolated module, separate localStorage key, won't conflict with anything
- ✅ Operator dropdown: SCHEMA-ADDITIVE (adds `serviceProvider` and `serviceProviderOther` to `operator`). Existing users with older data are defensively defaulted in onboarding.init.
- ✅ Hijri helpers: pure additions to Utils, no callers yet

No localStorage schema breakage. No Worker changes. No KV / Resend / Maps changes.

---

## Rollback

```bash
git revert HEAD
git push
```

---

## Post-deploy notes

- The disclaimer storage key is `hajj-companion-v1.disclaimerAcknowledgedAt` (separate from main user data). Reset of user data in Settings ALSO clears the ack so users see the disclaimer again.
- If you ever change the disclaimer wording, bump `DISCLAIMER_VERSION` in `js/disclaimer.js` (currently '1') so all users see the new version once.
- The operator dropdown silently falls back to "Other" + free-text if `data/operators.json` fails to load (rare, but defensive).

