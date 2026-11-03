#!/usr/bin/env python3
"""Replace the closing CTA section(s) of a service page with the core discovery-call banner.
Usage: python3 scripts/apply-service-cta.py <page> "<eyebrow>" "<heading>" "<middle bullet>"
"""
import html as H, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
css = open(os.path.join(here, 'blog-cta.css')).read()
tpl = open(os.path.join(here, 'blog-cta.html')).read()
path, eyebrow, head, bullet = sys.argv[1:5]
e = lambda t: H.escape(t, quote=False).replace('’', '&rsquo;')
banner = (tpl.replace('{{MIDDLE_BULLET}}', e(bullet))
          .replace('See what&rsquo;s possible', e(eyebrow))
          .replace('Ready to grow your MSP?', e(head)))
s = open(path).read()
foot = s.index('<footer class="footer-legal">')
if '<section class="disc-cta"' in s:
    s = re.sub(r'<section class="disc-cta".*?</section>\n', lambda m: banner, s, count=1, flags=re.S)
else:
    pre = s[:foot]
    tail = re.compile(r'<section class="(?:cta-dark|footer-fail)\b[^>]*>(?:(?!</section>).)*</section>\s*$', re.S)
    removed = 0
    while True:
        m = tail.search(pre)
        if not m: break
        pre = pre[:m.start()]; removed += 1
    s = pre + banner + '\n' + s[foot:]
    print(path, 'removed', removed)
if '.disc-cta{' not in s:
    s = s.replace('  /* ---------- footer', css + '\n  /* ---------- footer', 1)
open(path, 'w').write(s)
