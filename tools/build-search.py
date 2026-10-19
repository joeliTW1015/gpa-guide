#!/usr/bin/env python3
"""產生 search-index.js：用 headless Chrome 取得渲染後的 DOM（含 JS 產生的內容），
依 h2 / h3 / API 卡片切成區段。新增或修改頁面後重新執行：python3 -I tools/build-search.py"""
import json, os, re, subprocess, sys, tempfile
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ['01-pipeline', '05-vertex-draw', '06-fragment-fbo', '07-mesh-rendering',
         '03-env-git', '02-project-syntax', 'as1-robot', '04-api']

def dump(page):
    prof = tempfile.mkdtemp()
    r = subprocess.run(['google-chrome', '--headless=new', '--disable-gpu', '--no-sandbox', f'--user-data-dir={prof}',
                        '--virtual-time-budget=4000', '--dump-dom', f'file://{ROOT}/{page}.html'],
                       capture_output=True, text=True, timeout=120)
    if '<main' not in r.stdout:
        sys.exit(f'{page}: no DOM')
    return r.stdout

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ''; self.in_title = False; self.skip = 0
        self.h2 = ('', ''); self.cur = None; self.out = []; self.hbuf = None; self.card = None
    def new(self, anchor, heading):
        self.cur = {'id': anchor, 'h': heading, 't': []}; self.out.append(self.cur)
    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag in ('script', 'style', 'nav', 'button', 'select', 'option', 'textarea') or (tag == 'div' and a.get('class') == 'pn'):
            self.skip += 1; return
        if tag == 'title': self.in_title = True
        cls = a.get('class', '')
        if tag == 'div' and 'api' in cls.split() and a.get('id'):
            self.card = a['id']
        if tag in ('h1', 'h2', 'h3'):
            self.hbuf = (tag, a.get('id', ''), [])
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'nav', 'button', 'select', 'option', 'textarea'):
            self.skip = max(0, self.skip - 1)
        if tag == 'title': self.in_title = False
        if tag in ('h1', 'h2', 'h3') and self.hbuf and self.hbuf[0] == tag:
            t, i, buf = self.hbuf; text = ' '.join(''.join(buf).split()); self.hbuf = None
            if t == 'h1': self.title = text; self.new('', text)
            elif t == 'h2': self.h2 = (i, text); self.new(i, text)
            else:
                if self.card: self.new(self.card, text)
                else: self.new(self.h2[0], f'{self.h2[1]} › {text}' if self.h2[1] else text)
    def handle_data(self, d):
        if self.in_title: return
        if self.hbuf is not None: self.hbuf[2].append(d)
        if self.skip or self.cur is None: return
        if d.strip(): self.cur['t'].append(d)

def build():
    idx = []
    for p in PAGES:
        parser = P(); parser.feed(dump(p))
        for s in parser.out:
            text = ' '.join(' '.join(s['t']).split())
            if not text and not s['h']: continue
            if s['h'] == parser.title and not s['id'] and len(text) < 20: continue
            idx.append({'p': p + '.html', 'pt': parser.title, 'i': s['id'], 'h': s['h'], 't': text[:4000]})
        print(p, len(parser.out))
    with open(os.path.join(ROOT, 'search-index.js'), 'w', encoding='utf-8') as f:
        f.write('window.SEARCH_INDEX=' + json.dumps(idx, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('entries', len(idx), 'bytes', os.path.getsize(os.path.join(ROOT, 'search-index.js')))

build()
