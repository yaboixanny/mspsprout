#!/usr/bin/env python3
"""Add a table of contents (sticky sidebar on desktop, card on mobile) to blog posts.

Usage:
  python3 scripts/apply-blog-toc.py                   # every post under blog/*/index.html
  python3 scripts/apply-blog-toc.py blog/<slug>/index.html [...]
  python3 scripts/apply-blog-toc.py --force [paths]   # rebuild TOCs that already exist

It gives every H2 in the post body an id, builds the TOC from the H2s, adds the
has-toc layout class, the CSS (scripts/blog-toc.css) and the scroll-highlight JS
(scripts/blog-toc.js). Posts that already have a TOC are left alone unless --force
(their labels may be hand-shortened). Run it on every new post before opening the PR.
Safe to re-run.
"""
import glob, html as htmllib, os, re, sys

here = os.path.dirname(os.path.abspath(__file__))
css = open(os.path.join(here, 'blog-toc.css')).read()
js = open(os.path.join(here, 'blog-toc.js')).read()

def slugify(t):
    t = htmllib.unescape(t).lower().replace('&', ' and ')
    t = re.sub(r"[’'`]", '', t)
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:60].strip('-') or 'section'

def label(inner):
    inner = re.sub(r'<span class="mistake-num">.*?</span>', '', inner, flags=re.S)
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', inner)).strip()

def process(path, force):
    s = open(path).read()
    m = re.search(r'<section class="post-body[^"]*">\n  <div class="wrap">\n', s)
    if not m:
        return 'no post-body'
    has_toc = 'class="toc"' in s
    if has_toc and not force:
        return 'already has TOC'
    end = s.index('</section>', m.end())
    close = s.rindex('  </div>\n', m.end(), end)
    inner = s[m.end():close]
    # unwrap an existing TOC/post-content so we can rebuild cleanly
    inner = re.sub(r'\s*<aside class="toc".*?</aside>\n?', '', inner, flags=re.S)
    if '<div class="post-content">' in inner:
        inner = inner.replace('<div class="post-content">\n', '', 1).replace('<div class="post-content">', '', 1)
        inner = inner[:inner.rindex('</div>')] + inner[inner.rindex('</div>') + 6:]
    used, items = set(re.findall(r'<h2[^>]*\sid="([^"]+)"', inner)), []
    def fix(h):
        attrs, body = h.group(1), h.group(2)
        im = re.search(r'\sid="([^"]+)"', attrs)
        if im:
            hid = im.group(1)
        else:
            base = slugify(label(body)); hid = base; n = 2
            while hid in used:
                hid = '%s-%d' % (base, n); n += 1
            used.add(hid)
            attrs += ' id="%s"' % hid
        items.append((hid, label(body)))
        return '<h2%s>%s</h2>' % (attrs, body)
    inner = re.sub(r'<h2([^>]*)>(.*?)</h2>', fix, inner, flags=re.S)
    if len(items) < 3:
        return 'fewer than 3 H2s'
    toc = '<aside class="toc" aria-label="Table of contents"><span class="toc-label">In this post</span><ol>%s</ol></aside>' % ''.join(
        '<li><a href="#%s">%s</a></li>' % (i, htmllib.escape(t, quote=False)) for i, t in items)
    new = '%s\n    <div class="post-content">\n%s    </div>\n' % ('    ' + toc, inner.lstrip('\n'))
    s = s[:m.start()] + '<section class="post-body has-toc">\n  <div class="wrap">\n' + new + s[close:]
    if '.post-body.has-toc' not in s:
        s = s.replace('</style>', css + '</style>', 1)
    if "querySelectorAll('.toc a')" not in s:
        s = s.replace('</body>', js + '</body>', 1)
    open(path, 'w').write(s)
    return 'TOC added (%d sections)' % len(items)

args = [a for a in sys.argv[1:] if not a.startswith('--')]
force = '--force' in sys.argv
paths = args or sorted(glob.glob(os.path.join(here, '..', 'blog', '*', 'index.html')))
for p in paths:
    print(os.path.relpath(p), '->', process(p, force))
