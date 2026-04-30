# Hajj Guide v3.4 — Madinah duas correction

The "Arrive in Madinah" day card was wrongly showing the Ka'bah dua. Replaced with two duas appropriate for arriving in Madinah and entering Masjid an-Nabawi.

## The bug

The Madinah arrival day's "Duas for today" section showed **Dua on First Sight of the Ka'bah** — but the pilgrim is in Madinah at this point, not Makkah. They won't see the Ka'bah for several more days.

## The fix

Two new authentic duas added and slotted into the Madinah arrival day:

### 1. On Entering Masjid an-Nabawi

اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ
*Allahumma'ftaḥ lī abwāba raḥmatik*
"O Allah, open for me the doors of Your mercy."

**Source:** Sahih Muslim 713 (narrated by Abu Usayd, RA). The Prophet ﷺ taught this as the dua to recite when entering any mosque, with the right foot first.

### 2. Salam on the Prophet ﷺ at the Rawdah

السَّلامُ عَلَيْكَ يَا رَسُولَ اللهِ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ
*As-salāmu ʿalayka yā Rasūlallāh wa raḥmatullāhi wa barakātuh*
"Peace be upon you, O Messenger of Allah, and the mercy of Allah and His blessings."

**Source:** The Prophet ﷺ said: "No one sends salam upon me except that Allah returns my soul to me so that I may return his salam." (Sunan Abi Dawud 2041, classed hasan). The basic salam wording is well-attested across the four Sunni madhabs.

## What stays unchanged

The "Dua on First Sight of the Ka'bah" itself is **not** removed — it correctly remains on:

- The **Travel to Makkah · Umrah** day (when the pilgrim approaches the Ka'bah for the first time)
- The standalone **Arrive in Makkah** day (used when there's no Madinah leg in the trip)

Only the misplaced reference on the Madinah arrival day was changed.

The card description, "What to do" actions, and journal/reflection feature on the Madinah card are all unchanged.

## Verification

I checked all five `first-sight-kabah` references in `guide.js`:
- ✅ Madinah arrival (live path) — **fixed**, now uses the two new duas
- ✅ Madinah arrival (fallback path, when no flight dates set) — **fixed**, same swap
- ✅ Travel to Makkah · Umrah (live path) — **kept**, correct context
- ✅ Travel to Makkah · Umrah (fallback path) — **kept**, correct context
- ✅ Arrive in Makkah (when no Madinah leg) — **kept**, correct context

Tested end-to-end: opened the Madinah arrival card and confirmed only the two new duas appear (no Ka'bah dua). Then opened the Travel/Umrah card and confirmed the Ka'bah dua is still there. The Duas tab now lists 23 duas (was 21).

---

## Files in this drop

**Modified (v3.4):**
- `data/duas.json` — added 2 new duas (`masjid-nabawi-entry`, `salam-prophet`); updated `_meta.count` to 23
- `js/guide.js` — swapped `first-sight-kabah` → `['masjid-nabawi-entry', 'salam-prophet']` on the Madinah arrival day in both the live path and the default-fallback path

No other changes. No CSS. No new modules.

---

## Deployment

Replace these 2 files in `~/Downloads/hajj-app21/`:

```bash
cd ~/Downloads/hajj-app21
unzip -o ~/Downloads/v3.4-update.zip -d /tmp/v34

cp /tmp/v34/v34/data/duas.json data/
cp /tmp/v34/v34/js/guide.js js/

git add .
git commit -m "v3.4: correct Madinah day duas — swap Ka'bah dua for Masjid an-Nabawi entry + Salam on the Prophet"
git push
```

## Verify on hajjguide.net

After deploy:

1. Open the Itinerary tab
2. Find the **Arrive in Madinah** day card and expand it
3. Under "DUAS FOR TODAY" you should see:
   - "On Entering Masjid an-Nabawi" (Allahumma'ftah li abwaba rahmatik)
   - "Salam on the Prophet ﷺ at the Rawdah"
4. The Ka'bah dua should NOT appear on this card
5. Expand the **Travel to Makkah · Umrah** day card — the Ka'bah dua should still be there alongside the other Umrah duas
6. Visit the **Duas** tab — both new duas should be listed between "The Traveler's Dua" and "Dua on First Sight of the Ka'bah"

## Risk

🟢 **Very low.** Only data and dua-ID references changed:
- The new duas use the same JSON shape as the existing 21
- All four authentic Sunni madhabs accept the basic mosque-entry dua and the basic salam wording
- The Ka'bah dua itself is not deleted, just removed from the wrong card
- No CSS, no module logic, no UI changes
- If anything unexpected happens: `git revert HEAD && git push` and you're back to v3.3
