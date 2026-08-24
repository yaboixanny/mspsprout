#!/usr/bin/env node
/**
 * Regenerates sitemap.xml (and robots.txt) from whatever index.html files
 * actually exist in the repo. Runs as the Netlify build command, so it
 * re-runs — and the sitemap stays current — on every deploy.
 *
 * Site URL comes from Netlify's own env vars at build time (URL /
 * DEPLOY_PRIME_URL), so it never needs hand-editing if a custom domain
 * gets attached later. Falls back to the known netlify.app URL for local
 * runs.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = (process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://mspsprout.netlify.app').replace(/\/$/, '');

const IGNORE_DIRS = new Set(['.git', 'node_modules', 'scripts', '.netlify']);

function findPages(dir, base = '') {
  let pages = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      pages = pages.concat(findPages(path.join(dir, entry.name), `${base}/${entry.name}`));
    } else if (entry.isFile() && entry.name === 'index.html') {
      pages.push({ file: path.join(dir, entry.name), urlPath: base === '' ? '/' : `${base}/` });
    }
  }
  return pages;
}

function lastModFor(file) {
  const rel = path.relative(ROOT, file);
  try {
    const out = execSync(`git log -1 --format=%cI -- "${rel}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (out) return out.slice(0, 10); // YYYY-MM-DD
  } catch (err) {
    // Not fatal — e.g. file not committed yet, or no git history available.
  }
  return new Date().toISOString().slice(0, 10);
}

function buildSitemap(pages) {
  const urls = pages
    .sort((a, b) => a.urlPath.localeCompare(b.urlPath))
    .map(({ file, urlPath }) => {
      const loc = `${SITE_URL}${urlPath}`;
      const lastmod = lastModFor(file);
      const priority = urlPath === '/' ? '1.0' : '0.8';
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function buildRobots() {
  // Standard crawlers get a blanket allow. AI/answer-engine crawlers are
  // listed explicitly (rather than relying on the wildcard) so it's clear
  // and future-proof that this marketing site wants to be indexed by them
  // too — being cited in AI answers is part of 2026 SEO, not just classic
  // organic search.
  const aiBots = ['GPTBot', 'OAI-SearchBot', 'Google-Extended', 'PerplexityBot', 'ClaudeBot', 'CCBot', 'anthropic-ai'];
  const aiBlock = aiBots.map(bot => `User-agent: ${bot}\nAllow: /\n`).join('\n');
  return `User-agent: *\nAllow: /\n\n${aiBlock}\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

try {
  const pages = findPages(ROOT);
  if (pages.length === 0) {
    console.warn('[sitemap] No index.html pages found — skipping sitemap.xml write.');
  } else {
    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), buildSitemap(pages));
    fs.writeFileSync(path.join(ROOT, 'robots.txt'), buildRobots());
    console.log(`[sitemap] Wrote sitemap.xml with ${pages.length} page(s) for ${SITE_URL}:`);
    pages.forEach(p => console.log(`  - ${SITE_URL}${p.urlPath}`));
  }
} catch (err) {
  // Never fail the whole deploy over the sitemap — the site itself still
  // needs to publish even if this step trips on something unexpected.
  console.error('[sitemap] Generation failed, continuing deploy anyway:', err.message);
}
