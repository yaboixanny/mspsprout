#!/usr/bin/env node
/**
 * Regenerates sitemap.xml, robots.txt and llms.txt from whatever index.html files
 * actually exist in the repo. Runs as the Netlify build command, so it
 * re-runs — and the sitemap stays current — on every deploy.
 *
 * Site URL is the canonical custom domain. Netlify's URL env var is
 * deliberately NOT used: it can resolve to the netlify.app address, which
 * would put the wrong host in sitemap.xml and robots.txt. Override with
 * SITE_URL only if the primary domain ever changes.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = (process.env.SITE_URL || 'https://mspsprout.com').replace(/\/$/, '');

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

function decodeEntities(str) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…', nbsp: ' ' };
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => (name in named ? named[name] : m));
}

function pageMeta(file) {
  const html = fs.readFileSync(file, 'utf8');
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '';
  return {
    title: decodeEntities(title).replace(/\s*\|\s*MSP Sprout\s*$/, '').trim(),
    desc: decodeEntities(desc).replace(/\s+/g, ' ').trim(),
  };
}

// llms.txt: a plain-text map of the site for AI tools. Built from each page's
// <title> and meta description, so new pages and blog posts show up on deploy.
function buildLlms(pages) {
  const sections = [
    ['Services', ['/seo/', '/ai-seo/', '/google-ads-ppc/', '/bing-ads/', '/chatgpt-ads/', '/facebook-ads/', '/linkedin-ads/', '/linkedin-lead-generation/', '/cold-email-outreach/', '/appointment-setting/', '/msp-lead-generation/', '/demand-generation/', '/content-marketing/', '/google-business-profile/', '/web-design/', '/fractional-cmo/']],
    ['Industries we serve', ['/cybersecurity-mssp-marketing/', '/it-services-marketing/', '/saas-software-marketing/', '/telecom-voip-marketing/', '/var-reseller-marketing/']],
    ['Company', ['/', '/about/', '/pricing/', '/results/', '/case-studies/', '/contact/']],
  ];
  const known = new Set(sections.flatMap(([, list]) => list));
  const byPath = new Map(pages.map(p => [p.urlPath, p]));
  const line = ({ file, urlPath }) => {
    const { title, desc } = pageMeta(file);
    return `- [${title}](${SITE_URL}${urlPath})${desc ? `: ${desc}` : ''}`;
  };
  const blog = pages.filter(p => p.urlPath.startsWith('/blog/') && p.urlPath !== '/blog/').sort((a, b) => a.urlPath.localeCompare(b.urlPath));
  const other = pages.filter(p => !known.has(p.urlPath) && !p.urlPath.startsWith('/blog/') && p.urlPath !== '/privacy-policy/');

  let out = '# MSP Sprout\n\n';
  out += '> MSP Sprout is a marketing agency built specifically for managed service providers (MSPs) and IT companies. It runs SEO, AI search visibility, paid ads, web design, and outbound as one connected lead generation system that turns traffic into booked sales calls. It works with only 2-3 new MSPs per month.\n\n';
  out += `Website: ${SITE_URL}/\nBook a discovery call: https://cal.com/alexanderstefanseo/mspsprout\n\n`;
  for (const [name, list] of sections) {
    const items = list.map(u => byPath.get(u)).filter(Boolean);
    if (items.length) out += `## ${name}\n\n${items.map(line).join('\n')}\n\n`;
  }
  if (other.length) out += `## Other pages\n\n${other.map(line).join('\n')}\n\n`;
  if (blog.length) out += `## Blog\n\nGuides on MSP marketing, SEO, AI search, paid ads, and lead generation. Index: ${SITE_URL}/blog/\n\n${blog.map(line).join('\n')}\n\n`;
  return out.replace(/\n+$/, '\n');
}

try {
  const pages = findPages(ROOT);
  if (pages.length === 0) {
    console.warn('[sitemap] No index.html pages found — skipping sitemap.xml write.');
  } else {
    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), buildSitemap(pages));
    fs.writeFileSync(path.join(ROOT, 'robots.txt'), buildRobots());
    fs.writeFileSync(path.join(ROOT, 'llms.txt'), buildLlms(pages));
    console.log(`[sitemap] Wrote sitemap.xml with ${pages.length} page(s) for ${SITE_URL}:`);
    pages.forEach(p => console.log(`  - ${SITE_URL}${p.urlPath}`));
  }
} catch (err) {
  // Never fail the whole deploy over the sitemap — the site itself still
  // needs to publish even if this step trips on something unexpected.
  console.error('[sitemap] Generation failed, continuing deploy anyway:', err.message);
}
