# Hajj Guide v2.1.1 — drop the feedback form, use mailto

## Summary
The Resend-based feedback form was causing "Could not send" errors due to
domain verification issues. Replaced the entire feedback infrastructure with
a plain `mailto:ach@goindigo.co.uk` link in the footer.

## What changed in this drop

**Modified files:**
- `_worker.js` — removed `/api/feedback` route. Now only handles `/js/config.js`
  and `/api/like`. Cleaner, no Resend dependency.
- `wrangler.jsonc` — removed `FEEDBACK_TO` and `FEEDBACK_FROM` vars (no longer used)
- `index.html` — feedback button replaced with mailto link, feedback.js script removed
- `app.html` — same
- `js/app.js` — removed `Feedback.init()` call
- `css/styles.css` — removed all feedback modal styles (~175 lines deleted)

**Files in v2.1 that should now be DELETED:**
- `js/feedback.js` — no longer needed (this drop doesn't include it; you delete locally)

## Deployment steps

### 1. Drop in the new files
Replace these in `~/Downloads/hajj-app21/` (or whatever you've named the folder):
- `_worker.js`
- `wrangler.jsonc`
- `css/styles.css`
- `js/app.js`
- `index.html`
- `app.html`

### 2. Delete `js/feedback.js`
```bash
cd ~/Downloads/hajj-app21
rm js/feedback.js
```

### 3. (Optional) Remove the Resend secret since we're no longer using it
```bash
wrangler secret delete RESEND_API_KEY
```
(Not strictly required — the secret being there doesn't cause any issues.
But cleaner.)

### 4. Commit and push
```bash
git add .
git commit -m "v2.1.1: replace Resend feedback form with mailto link"
git push
```

## What still works the same
- Like button still works (no changes there)
- Smart flight helpers still work
- Maps autocomplete still works
- Cloudflare Web Analytics setup is unchanged (still commented out, ready when you are)
- Footer style/layout is unchanged — just the feedback element is now a link instead of a button

## What the user sees
Click "Send feedback" in the footer → their email client opens with:
- To: ach@goindigo.co.uk
- Subject: "Hajj Guide feedback"
- Body: empty, ready for them to type

It's the simplest, most reliable feedback channel. Works on every device. No
infrastructure to maintain. No DNS records, no API keys, no spam handling.

## Tradeoffs vs the form
- ❌ Mobile users without a configured email app see a confusing "no app to handle this" message
- ❌ No spam protection (you'll see your real email and may get bot mail eventually)
- ❌ No structured fields — users may forget to include context
- ✅ No backend cost or maintenance
- ✅ Replies happen naturally from your email client
- ✅ Zero failure modes to debug

If spam ever gets bad, change the email to a forwarding alias and protect that
one. Or come back to this later and re-implement the form with a different
provider (Postmark, Mailchannels, etc.).
