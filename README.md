# xinzuo.com.au Shopify clone — TYICDI hiring task

A sanitized clone of the [xinzuo.com.au](https://xinzuo.com.au) Shopify store, shared for the **TYICDI developer hiring task**.

**You get:**
- The Liquid theme (sections, snippets, blocks, assets, templates, layout, config, locales) — same code running on xinzuo.com.au today.
- `seed.json` — 237 products, 68 collections, 17 pages, 77 published articles + product imagery URLs. Sanitized: no customer data, no order data, no cost / margin / supplier info, no internal metafields, no tokens.
- `scripts/seed-to-dev-store.mjs` — an importer that populates **your own** free Shopify Partners dev store with this catalog.

You can stand up a full visual clone of xinzuo's store on your own dev store in about 15 minutes, then pick any page (PDP, collection, cart, homepage, blog, footer — your call) to improve.

---

## Setup — about 15 minutes

### 1. Sign up for Shopify Partners (free)

<https://www.shopify.com/partners/signup>

### 2. Create a development store

In your Partner dashboard → **Stores** → **Add store** → **Development store**. Pick any name. This store is free, won't be visible to customers, and isn't billed.

### 3. Create an Admin API access token for your dev store

In your dev store admin:

1. **Settings → Apps and sales channels → Develop apps**
2. **Create an app** → give it any name (e.g. "xinzuo-seed")
3. **Configure Admin API scopes** → enable these:
   - `read_products`, `write_products`
   - `read_themes`, `write_themes`
   - `read_content`, `write_content` (covers pages + articles + blogs)
4. **Install app** in the top right
5. Copy the **Admin API access token** (starts with `shpat_…`). You only see this once — save it.

### 4. Configure `.env` in this repo

Clone this repo and create a `.env` file in its root:

```bash
SHOPIFY_STORE_URL=your-dev-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ This file is `.gitignored`. **Never commit your token.** Your token only ever lives on your machine.

### 5. Dry-run the seed

```bash
node scripts/seed-to-dev-store.mjs
```

Prints what it *would* create without actually writing. Confirms your token + store URL are correct.

> The script **refuses** any URL containing `xinzuo` or any URL not ending in `.myshopify.com`. You cannot accidentally seed our production store.

### 6. Run for real

```bash
node scripts/seed-to-dev-store.mjs --write
```

Takes ~10 minutes for the full catalog. To do a quick smaller test first:

```bash
node scripts/seed-to-dev-store.mjs --write --limit-products=20
```

### 7. Push the theme to your dev store

```bash
npm i -g @shopify/cli @shopify/theme
shopify theme push --store=your-dev-store.myshopify.com --live
```

When prompted, log in via the Shopify CLI's browser flow. The theme uploads in a couple of minutes.

### 8. Visit your dev store

Your Partner dashboard → your store → **Online Store**. You should see a near-pixel-clone of xinzuo.com.au running on your own infrastructure with real-shaped data.

---

## The hiring task

Pick **one** thing on your dev store (which mirrors xinzuo.com.au) that you'd fix if you owned it. Anywhere — homepage, PDP, collection, cart, checkout-adjacent, mobile UX, perf, SEO, copy, accessibility, an outright bug. Performance issues, navigation issues, conversion-rate opportunities — anything you spot.

This is an **engineering** task, not a redesign. We're hiring a developer to work in Liquid alongside our lead dev Rachid. We want the eye for the thing a real Shopify dev would catch.

**Submit** in your own public GitHub repo (≥3 commits inside your 2-hour window):

1. Your fix — edited Liquid / CSS / JS / JSON files in their original paths
2. `before.png` — screenshot of the issue
3. `after.png` — screenshot of your fix in action
4. `NOTE.md` (≤300 words):
   ```markdown
   ## What I picked
   ## Why it's #1
   ## What I did
   ## What I'd do next
   ```
5. Loom URL — max 3 min, face + screen, in your repo's README

Then submit your repo URL + Loom + NOTE on the [hiring portal](https://apply.toldyouicoulddoit.com).

---

## What's NOT in this repo (and why)

- `.env` / API tokens — never committed
- Customer data — never queried
- Order data — never queried
- Refunds, discount codes, webhooks, apps — never queried
- Variant `cost`, `inventory_quantity`, internal metafields — explicitly stripped by the export allowlist
- Internal tags (anything containing "supplier", "wholesale", "margin") — filtered
- Admin scripts, backup folders, audit results from our working theme repo — not copied

In short: only what an applicant could observe by browsing xinzuo.com.au with their dev tools open.

## License

Code shared **solely for the TYICDI developer hiring task**. Brand, product names, and content are © Xinzuo Australia / Told You I Could Do It. Do not redistribute, fork for commercial use, or use as the basis for any other project.
