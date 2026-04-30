# Hajj Guide v3.1 — SEO foundation + www subdomain redirect

Two related improvements: (1) make the site genuinely discoverable in Google search, and (2) handle the www subdomain you're about to add in Cloudflare so it redirects cleanly to the apex domain.

---

## What's in this drop

### 1. Worker — `www.hajjguide.net` → `hajjguide.net` (301 redirect)

When you add the `www` DNS record in Cloudflare and point it at this Worker, requests to `www.hajjguide.net/anything` will 301-redirect to `hajjguide.net/anything`. This consolidates SEO signals on a single canonical URL.

Five lines added at the top of the fetch handler in `_worker.js`. Path, query string, and fragment are preserved across the redirect.

### 2. SEO meta improvements on `index.html`

- **Title** — sharper, more keyword-rich: `Hajj Guide — free personalised companion for pilgrims | hajjguide.net`
- **Description** — expanded to a richer sentence with the actual feature list (itinerary, duas, rulings, journal, emergency card)
- **Robots** — explicit `index, follow, max-image-preview:large` so Google can use the icon as a rich-result image
- **OG/Twitter** — minor polish, added `og:image:alt`
- **Keywords** — added (small SEO impact but doesn't hurt)

### 3. JSON-LD structured data on `index.html`

Two schemas in one block:

- **WebApplication** — tells Google this is a free travel-category app, with a feature list, English language, target audience (Muslim pilgrims). Used to surface rich application info in some result types.
- **FAQPage** — six FAQs (free? offline? madhabs? data storage? print? fatwa?). Each answer is also visible on the page (see #4) so this is not cloaking.

Validated as parseable JSON. Both schemas detected by the structured-data parser.

### 4. Visible FAQ section on `index.html`

A new "Common questions" section on the home page, just before the footer. Six questions (matching the JSON-LD):
- Is Hajj Guide free?
- Does it work offline?
- Does it cover the four Sunni madhabs?
- Where is my data stored?
- Can I print my itinerary and emergency card?
- Is this a fatwa or religious ruling?

Each is a `<details>` element so users can expand individual questions. Editorial styling with brass `+` markers turning sage `−` on expand. Hidden from print.

This serves three purposes simultaneously: (a) makes the JSON-LD honest, (b) addresses common concerns visitors actually have before committing to use the app, (c) gives Google more crawlable content with the right keywords.

### 5. `app.html` — `noindex, follow`

The app shell at `/app.html` is the personal interface. When a Googlebot lands on it without onboarding context, it sees a mostly empty UI shell — that's bad for ranking. Adding `noindex, follow` keeps it out of search results while still letting any links from it count.

The `canonical` on `app.html` now points to the home page, not to itself, reinforcing that index.html is the page that should rank.

### 6. `robots.txt` — explicit allow + AI crawler guidance

Was: 4 lines. Now: structured rules for Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot. All allowed, with `/api/` and `/js/config.js` disallowed (those are runtime endpoints, not content). Sitemap reference preserved.

### 7. `sitemap.xml` — drop app.html, add lastmod

Now lists only the canonical home page URL. App.html is gone from the sitemap (it shouldn't be in there given we're noindex-ing it). Added a `<lastmod>` of today.

---

## Files in this drop

**Modified (v3.1):**
- `_worker.js` — 5 lines for www→apex redirect
- `index.html` — improved meta + JSON-LD block + visible FAQ section
- `app.html` — noindex + canonical pointing to home
- `css/styles.css` — appended ~75 lines of FAQ styles
- `robots.txt` — expanded crawler rules
- `sitemap.xml` — drop app.html, add lastmod

No new files. No JS module changes. No data file changes. Existing app behaviour is unchanged.

---

## Deployment

### Step 1 — In Cloudflare dashboard (you mentioned you'd do this)

Add a DNS record for `www.hajjguide.net`:
- Type: `CNAME`
- Name: `www`
- Target: `hajjguide.net`
- Proxy: enabled (orange cloud)

Or, if Cloudflare for Pages doesn't support CNAME, add an `A` record for `www` pointing to the same IP/Worker as the apex.

The Worker route should already include `*.hajjguide.net/*` if you've used the default. If not, add a route for `www.hajjguide.net/*` pointing to the same Worker.

### Step 2 — Deploy code

Replace these files in `~/Downloads/hajj-app21/`:
- `_worker.js`
- `index.html`
- `app.html`
- `css/styles.css`
- `robots.txt`
- `sitemap.xml`

```bash
cd ~/Downloads/hajj-app21
git add .
git commit -m "v3.1: SEO foundation + www subdomain redirect"
git push
```

### Step 3 — Submit sitemap to Google

After deploy, go to [Google Search Console](https://search.google.com/search-console). If you haven't verified ownership of `hajjguide.net` yet:

1. Add `https://hajjguide.net/` as a property
2. Verify ownership (DNS TXT record is the easiest method)
3. Once verified, in the left sidebar go to **Sitemaps**
4. Submit `https://hajjguide.net/sitemap.xml`

Google will then crawl the site and index it. Indexing usually takes 24–72 hours for a new site, sometimes a couple of weeks. You can also use the **URL inspection** tool to manually request indexing for the home page.

### Step 4 — Verify on the live site

After deploy:

```bash
# Test the canonical redirect (will show after the www DNS record exists)
curl -I https://www.hajjguide.net/
# Should show: HTTP/2 301, Location: https://hajjguide.net/

# Test the apex still works
curl -sI https://hajjguide.net/ | head -5
# Should show: HTTP/2 200

# Verify the JSON-LD on the home page
curl -s https://hajjguide.net/ | grep -A 2 'application/ld+json' | head
```

In the browser:
1. View the home page → scroll to the bottom → see the new "Common questions" FAQ section
2. Click any question → answer expands with a sage `−` icon
3. Open DevTools → check that the page title and meta description match what's described above
4. Visit `https://search.google.com/test/rich-results` and paste your URL — it should detect the WebApplication schema (FAQPage may show as detected but not eligible for rich results since Google deprecated FAQ rich snippets in 2023)

---

## What this gets you

**Short term (first 1–4 weeks):**
- Google indexes the home page properly
- Searching `hajj guide free` or `personalised hajj companion` should start showing the site
- Branded searches (`hajjguide.net`, `hajj guide app`) should show the site at #1
- Search results display the new sharper title and richer description
- The FAQ section helps Google understand the site's purpose

**Medium term (1–3 months):**
- Rankings for genuinely competitive terms like `hajj itinerary planner` or `hajj duas with audio` depend largely on backlinks from other Muslim sites — that's an outreach task, not a code task
- The structured data sometimes earns extra real estate in search results
- Image previews using the icon should look good when the link is shared

**What this does NOT do:**
- Doesn't manufacture backlinks. The single biggest factor in ranking competitive terms is sites that other people link to. That comes from word-of-mouth, sharing in WhatsApp groups, posting on r/islam etc.
- Doesn't help if there's no original content. The FAQ helps a little but the site's main "content" is the personalised guide, which is interactive and largely behind a JS app — Google will index what crawlers can see, which is mostly index.html.

---

## Risk

🟢 **Low.** Mostly meta-tag changes plus one small worker handler.
- The www redirect is 5 lines; if the worker compiles, it works
- The JSON-LD block is `<script type="application/ld+json">` which browsers ignore — only crawlers parse it. A bad block would just be ignored
- The FAQ section is purely additive HTML/CSS at the end of the home page
- The noindex on app.html is reversible by removing one meta tag

If the www redirect causes issues after Cloudflare DNS is set up:
```bash
git revert HEAD && git push
```

---

## What's NOT in this drop

- **Bing Webmaster Tools** — also worth submitting the sitemap there. Same process as Google Search Console, but bingwebmaster.com. Free.
- **A blog or content section** — for competitive Hajj queries, original written content (e.g. a "How to prepare for Hajj" guide) would help. That's a substantial writing exercise, not a code one
- **Backlinks** — the highest-leverage thing for Hajj-related search rankings, but it's outreach work
- **Image alt-text audit** — the journey map and other SVGs could probably benefit from richer aria-labels. Skipped for this drop to keep scope tight
- **Google Tag Manager / Analytics 4** — Cloudflare Web Analytics is a privacy-respecting alternative we already discussed enabling. Recommended over GTM
- **Schema.org for individual FAQ entries** — already covered via the FAQPage JSON-LD
- **`hreflang` tags** — only relevant if you add other-language versions of the site, which is on indefinite hold after the v2.5 rollback
