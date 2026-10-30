#!/usr/bin/env python3
"""Apply the core blog CTA (discovery call banner) to a blog post.

Usage: python3 scripts/apply-blog-cta.py blog/<slug>/index.html "Middle bullet text"

The middle bullet is the only per-post line; make it relevant to the post's topic
(e.g. "Review your Google Ads strategy"). The first and third bullets stay fixed.
Safe to re-run: it updates the bullet if the banner is already on the page.
Source of truth: scripts/blog-cta.html (markup) and scripts/blog-cta.css (styles).
"""
import html as htmllib, os, re, sys

here = os.path.dirname(os.path.abspath(__file__))
css = open(os.path.join(here, 'blog-cta.css')).read()
tpl = open(os.path.join(here, 'blog-cta.html')).read()
path, bullet = sys.argv[1], htmllib.escape(sys.argv[2], quote=False)
s = open(path).read()

banner = tpl.replace('{{MIDDLE_BULLET}}', bullet)
if '<section class="disc-cta"' in s:
    s = re.sub(r'<section class="disc-cta".*?</section>\n', lambda m: banner, s, count=1, flags=re.S)
else:
    # drop the old inline box and dark closing banner, then add the new one before the footer
    s = re.sub(r'\n    <div class="post-cta">.*?</div>\n(?=  </div>\n</section>)', '\n', s, count=1, flags=re.S)
    s = re.sub(r'<section class="cta-dark" id="cta">.*?</section>\n\n', '', s, count=1, flags=re.S)
    s = s.replace('<footer class="footer-legal">', banner + '\n<footer class="footer-legal">', 1)
    # old CSS
    s = re.sub(r'  \.post-cta\{.*?\n  \}\n(?:  \.post-cta[^\n]*\n)*', '', s, count=1, flags=re.S)
    s = re.sub(r'  /\* -+ CTA dark -+ \*/\n(?:  \.cta-dark[^\n]*\n|    [^\n]*\n|  \}\n)+', '', s, count=1)
if '.disc-cta{' not in s:
    s = s.replace('  /* ---------- footer', css + '\n  /* ---------- footer', 1)
if 'family=Caveat' not in s:
    s = s.replace('&display=swap" rel="stylesheet">', '&family=Caveat:wght@600&display=swap" rel="stylesheet">', 1)
open(path, 'w').write(s)
