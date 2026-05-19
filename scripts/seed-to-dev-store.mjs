#!/usr/bin/env node
/*
 * Seed your own Shopify dev store from the public xinzuo.com.au catalog snapshot.
 *
 * Usage:
 *   1. Create a free Shopify Partners account: https://www.shopify.com/partners
 *   2. Create a development store inside Partners.
 *   3. Inside the dev store: Admin → Settings → Apps and sales channels → Develop apps →
 *      Create an app → Configure Admin API scopes → enable:
 *        write_products, read_products
 *        write_themes, read_themes
 *        write_content, read_content  (pages + articles + blogs)
 *      Install the app, then copy the Admin API access token.
 *   4. Create a `.env` file in this repo's root with:
 *        SHOPIFY_STORE_URL=your-dev-store.myshopify.com
 *        SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   5. Dry-run (prints what it would create without writing):
 *        node scripts/seed-to-dev-store.mjs
 *   6. Run for real:
 *        node scripts/seed-to-dev-store.mjs --write
 *
 * SAFETY RAILS:
 *   - Refuses any non-*.myshopify.com store URL.
 *   - Refuses if URL contains 'xinzuo' (so it can never accidentally seed our prod store).
 *   - Default is --dry-run.
 *   - Sleeps between requests to stay under Shopify's 40 req/sec limit.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--') && a.includes('='))
    .map((a) => { const i = a.indexOf('='); return [a.slice(2, i), a.slice(i + 1)]; })
);
const LIMIT_PRODUCTS = parseInt(args['limit-products'] ?? '0', 10) || Infinity;

// --- Load .env from CWD ---
const envPath = path.join(process.cwd(), '.env');
if (!existsSync(envPath)) {
  console.error(`No .env in ${process.cwd()}. See script header for setup.`);
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);

const STORE = env.SHOPIFY_STORE_URL;
const TOKEN = env.SHOPIFY_ACCESS_TOKEN;
if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE_URL or SHOPIFY_ACCESS_TOKEN in .env');
  process.exit(1);
}

// --- SAFETY: reject production / xinzuo domains ---
const hostname = STORE.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
if (hostname.includes('xinzuo')) {
  console.error(`REFUSED: store URL contains 'xinzuo'. This script is for YOUR dev store, not xinzuo's production store.`);
  process.exit(1);
}
if (!hostname.endsWith('.myshopify.com')) {
  console.error(`REFUSED: store URL must end in '.myshopify.com' (Shopify dev-store pattern). Got: ${hostname}`);
  process.exit(1);
}

const BASE = `https://${hostname}`;
const API = `${BASE}/admin/api/2024-10`;

// --- Rate-limited fetch wrapper ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, endpoint, body) {
  const url = `${API}/${endpoint}`;
  while (true) {
    const r = await fetch(url, {
      method,
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429) {
      const wait = parseFloat(r.headers.get('retry-after') || '2') * 1000;
      console.log(`  [rate-limit] waiting ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`${method} ${endpoint} ${r.status}: ${text.slice(0, 250)}`);
    }
    // Be polite to the bucket
    await sleep(60);
    return r.json();
  }
}

// --- Load seed.json ---
const seedPath = path.join(process.cwd(), 'seed.json');
if (!existsSync(seedPath)) {
  console.error('No seed.json in CWD. Run from the repo root.');
  process.exit(1);
}
const seed = JSON.parse(readFileSync(seedPath, 'utf-8'));

console.log(`\n${WRITE ? 'WRITE' : 'DRY-RUN'} mode → ${hostname}`);
console.log(`Will create up to ${LIMIT_PRODUCTS === Infinity ? 'all' : LIMIT_PRODUCTS} products, ${seed.collections.length} collections, ${seed.pages.length} pages, ${seed.articles.length} articles.\n`);
if (!WRITE) console.log('(Pass --write to actually create. Use --limit-products=20 to do a quick test first.)\n');

let created = { products: 0, collections: 0, pages: 0, blogs: 0, articles: 0 };

// --- PRODUCTS ---
const productHandleToId = new Map();
console.log('=== Products ===');
const productsToCreate = seed.products.slice(0, LIMIT_PRODUCTS);
for (const [i, p] of productsToCreate.entries()) {
  if (i % 10 === 0) console.log(`  ${i}/${productsToCreate.length}`);
  if (!WRITE) {
    created.products++;
    continue;
  }
  try {
    const resp = await api('POST', 'products.json', {
      product: {
        title: p.title,
        body_html: p.body_html,
        handle: p.handle,
        product_type: p.product_type,
        vendor: p.vendor,
        tags: p.tags,
        options: p.options,
        images: p.images.map((img) => ({ src: img.src, alt: img.alt, position: img.position })),
        variants: p.variants.map((v) => ({ ...v })),
      },
    });
    productHandleToId.set(p.handle, resp.product.id);
    created.products++;
  } catch (e) {
    console.log(`  [skip] product '${p.handle}': ${e.message.slice(0, 120)}`);
  }
}

// --- COLLECTIONS ---
console.log('\n=== Collections ===');
for (const c of seed.collections) {
  if (!WRITE) { created.collections++; continue; }
  try {
    if (c.type === 'smart') {
      await api('POST', 'smart_collections.json', {
        smart_collection: {
          title: c.title, handle: c.handle, body_html: c.body_html,
          sort_order: c.sort_order, image: c.image, disjunctive: c.disjunctive, rules: c.rules,
        },
      });
    } else {
      // Custom collection: we don't have product IDs in seed (it's by handle).
      // Create empty, applicant can populate manually if needed.
      await api('POST', 'custom_collections.json', {
        custom_collection: {
          title: c.title, handle: c.handle, body_html: c.body_html,
          sort_order: c.sort_order, image: c.image,
        },
      });
    }
    created.collections++;
  } catch (e) {
    console.log(`  [skip] collection '${c.handle}': ${e.message.slice(0, 120)}`);
  }
}

// --- PAGES ---
console.log('\n=== Pages ===');
for (const p of seed.pages) {
  if (!WRITE) { created.pages++; continue; }
  try {
    await api('POST', 'pages.json', { page: { title: p.title, handle: p.handle, body_html: p.body_html, published: true } });
    created.pages++;
  } catch (e) {
    console.log(`  [skip] page '${p.handle}': ${e.message.slice(0, 120)}`);
  }
}

// --- BLOGS + ARTICLES ---
console.log('\n=== Blogs + Articles ===');
const blogHandleToId = new Map();
for (const b of seed.blogs) {
  if (!WRITE) { created.blogs++; continue; }
  try {
    const resp = await api('POST', 'blogs.json', { blog: { title: b.title, handle: b.handle } });
    blogHandleToId.set(b.handle, resp.blog.id);
    created.blogs++;
  } catch (e) {
    console.log(`  [skip] blog '${b.handle}': ${e.message.slice(0, 120)}`);
  }
}
for (const a of seed.articles) {
  const blogId = blogHandleToId.get(a.blog_handle) || (await (async () => {
    if (!WRITE) return 'dry';
    // Fallback: create a "news" blog
    if (!blogHandleToId.has('news')) {
      const r = await api('POST', 'blogs.json', { blog: { title: 'News', handle: 'news' } });
      blogHandleToId.set('news', r.blog.id);
    }
    return blogHandleToId.get('news');
  })());
  if (!WRITE) { created.articles++; continue; }
  try {
    await api('POST', `blogs/${blogId}/articles.json`, {
      article: { title: a.title, handle: a.handle, body_html: a.body_html, tags: a.tags, image: a.image, published: true },
    });
    created.articles++;
  } catch (e) {
    console.log(`  [skip] article '${a.handle}': ${e.message.slice(0, 120)}`);
  }
}

console.log('\n=== Summary ===');
console.log(JSON.stringify(created, null, 2));
console.log(`\n${WRITE ? 'Done.' : 'DRY RUN — nothing was written. Pass --write to create.'}`);
console.log(`\nNext: push the Liquid theme to your dev store:`);
console.log(`  npm i -g @shopify/cli @shopify/theme`);
console.log(`  shopify theme push --store=${hostname} --live`);
