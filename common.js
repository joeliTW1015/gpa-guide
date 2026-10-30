// 共用：頂部導覽（依講義順序分組）、側欄目錄、標題錨點、表格外框、閱讀進度、上一頁 / 下一頁、code 複製按鈕、tabs
(function () {
  // 閱讀順序：講義 01 → 07 → 實作 / 附錄 → 作業 → 參考
  const groups = [['', [['index.html', '首頁']]],
    ['講義', [['l01-transform.html', '01 轉換'], ['l02-overview.html', '02 概觀'], ['01-pipeline.html', '03 Pipeline'],
      ['l04-objects.html', '04 Objects'], ['05-vertex-draw.html', '05 Vertex'], ['06-fragment-fbo.html', '06 Fragment'], ['07-mesh-rendering.html', '07 Mesh']]],
    ['實作', [['03-env-git.html', '環境 / 繳交'], ['02-project-syntax.html', '專案與語法']]],
    ['作業', [['as1-robot.html', 'AS1 機器人'], ['as2-postfx.html', 'AS2 後製']]],
    ['參考', [['04-api.html', 'API']]]];
  const pages = groups.flatMap(([, ps]) => ps);
  const cur = location.pathname.split('/').pop() || 'index.html';
  const nav = document.createElement('nav');
  nav.className = 'top';
  nav.innerHTML = groups.map(([g, ps]) => `<span class="grp">${g ? `<i>${g}</i>` : ''}` +
    ps.map(([h, t]) => `<a href="${h}" class="${h === cur ? 'on' : ''}">${t}</a>`).join('') + '</span>').join('');
  document.body.prepend(nav);
  const bar = document.createElement('div'); bar.id = 'readbar'; document.body.prepend(bar);

  const main = document.querySelector('main');
  const i = pages.findIndex(([h]) => h === cur);
  if (i >= 0 && main) {
    const pn = document.createElement('div');
    pn.className = 'pn';
    pn.innerHTML = (i > 0 ? `<a href="${pages[i - 1][0]}"><small>上一頁</small>← ${pages[i - 1][1]}</a>` : '<span></span>') +
      (i < pages.length - 1 ? `<a href="${pages[i + 1][0]}" style="text-align:right"><small>下一頁</small>${pages[i + 1][1]} →</a>` : '<span></span>');
    main.appendChild(pn);
  }

  // 表格包外框（可橫向捲動）
  document.querySelectorAll('main table').forEach(t => {
    if (t.parentElement.classList.contains('tw')) return;
    const w = document.createElement('div'); w.className = 'tw';
    t.parentNode.insertBefore(w, t); w.appendChild(t);
  });

  // h2 / h3 錨點
  document.querySelectorAll('main h2[id], main h3[id]').forEach(h => {
    const a = document.createElement('a'); a.className = 'anchor'; a.href = '#' + h.id; a.textContent = '#';
    h.appendChild(a);
  });

  // 側欄目錄：由 h2[id] 產生，寬螢幕才顯示；捲動時標出目前章節
  const hs = [...document.querySelectorAll('main h2[id]')];
  if (main && hs.length >= 3) {
    const side = document.createElement('aside'); side.className = 'side';
    side.innerHTML = '<div class="st">本頁目錄</div>' + hs.map(h => `<a href="#${h.id}">${h.textContent.replace(/#$/, '').trim()}</a>`).join('');
    document.body.appendChild(side); document.body.classList.add('has-side');
    const links = [...side.querySelectorAll('a')];
    const spy = () => {
      let k = 0;
      hs.forEach((h, j) => { if (h.getBoundingClientRect().top < 120) k = j; });
      links.forEach((a, j) => a.classList.toggle('on', j === k));
    };
    addEventListener('scroll', spy, { passive: true }); spy();
  }

  // 閱讀進度 + 回到頂端
  const top = document.createElement('button'); top.id = 'totop'; top.title = '回到頂端'; top.textContent = '↑';
  top.onclick = () => scrollTo({ top: 0 }); document.body.appendChild(top);
  const prog = () => {
    const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? h.scrollTop / max * 100 : 0) + '%';
    top.classList.toggle('show', h.scrollTop > 600);
  };
  addEventListener('scroll', prog, { passive: true }); prog();

  document.querySelectorAll('pre').forEach(pre => {
    const b = document.createElement('button');
    b.className = 'cp'; b.textContent = 'copy';
    b.onclick = () => navigator.clipboard.writeText(pre.querySelector('code')?.innerText ?? pre.innerText)
      .then(() => { b.textContent = 'copied'; setTimeout(() => b.textContent = 'copy', 1200); });
    pre.appendChild(b);
  });

  // <div class="tabs"><button data-pane="id">..</button></div> + <div class="pane" id="id">
  document.querySelectorAll('.tabs').forEach(tabs => {
    const btns = [...tabs.querySelectorAll('button')];
    if (!btns.length || !btns[0].dataset.pane) return;   // 由頁面自己的程式處理的 tab 列
    const show = id => btns.forEach(b => {
      b.classList.toggle('on', b.dataset.pane === id);
      document.getElementById(b.dataset.pane).classList.toggle('on', b.dataset.pane === id);
    });
    btns.forEach(b => b.onclick = () => show(b.dataset.pane));
    show(btns[0].dataset.pane);
  });
})();

// 全站搜尋：索引由 tools/build-search.py 產生（search-index.js）
(function () {
  const nav = document.querySelector('nav.top');
  if (!nav) return;
  const box = document.createElement('div');
  box.className = 'sbox';
  box.innerHTML = '<input type="search" placeholder="搜尋全站（按 / ）" aria-label="全站搜尋" autocomplete="off"><div class="sres" hidden></div>';
  nav.appendChild(box);
  const input = box.querySelector('input'), res = box.querySelector('.sres');
  let loaded = null, sel = -1, hits = [];

  const load = () => loaded || (loaded = new Promise(ok => {
    const s = document.createElement('script');
    s.src = 'search-index.js'; s.onload = () => ok(window.SEARCH_INDEX || []); s.onerror = () => ok([]);
    document.head.appendChild(s);
  }));
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mark = (s, toks) => {
    let out = esc(s);
    toks.forEach(t => { out = out.replace(new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`); });
    return out;
  };
  function search(q, idx) {
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) return { toks, list: [] };
    const list = [];
    for (const e of idx) {
      const h = e.h.toLowerCase(), t = e.t.toLowerCase(), id = e.i.toLowerCase();
      let score = 0, ok = true;
      for (const k of toks) {
        const inH = h.includes(k), inI = id.includes(k), n = t.split(k).length - 1;
        if (!inH && !inI && !n) { ok = false; break; }
        score += (inH ? 10 : 0) + (h.startsWith(k) ? 6 : 0) + (h === k ? 10 : 0) + (inI ? 4 : 0) + Math.min(n, 5);
      }
      if (ok) list.push({ e, score });
    }
    list.sort((a, b) => b.score - a.score);
    return { toks, list: list.slice(0, 12).map(x => x.e), total: list.length };
  }
  function snippet(e, toks) {
    const t = e.t, low = t.toLowerCase();
    let pos = -1;
    for (const k of toks) { const p = low.indexOf(k); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
    if (pos < 0) return esc(t.slice(0, 100));
    const a = Math.max(0, pos - 40), b = Math.min(t.length, pos + 100);
    return (a ? '…' : '') + mark(t.slice(a, b), toks) + (b < t.length ? '…' : '');
  }
  async function run() {
    const q = input.value.trim();
    if (!q) { res.hidden = true; return; }
    const { toks, list, total } = search(q, await load());
    hits = list; sel = list.length ? 0 : -1;
    res.hidden = false;
    res.innerHTML = list.length
      ? list.map((e, i) => `<a href="${e.p}${e.i ? '#' + e.i : ''}" data-i="${i}" class="${i === 0 ? 'sel' : ''}"><b>${mark(e.h || e.pt, toks)}</b> <span class="pg">${esc(e.pt)}</span><div class="sn">${snippet(e, toks)}</div></a>`).join('') +
        (total > list.length ? `<div class="more">還有 ${total - list.length} 筆，請輸入更多關鍵字</div>` : '')
      : '<div class="more">找不到符合的內容</div>';
  }
  const mv = d => {
    if (!hits.length) return;
    sel = (sel + d + hits.length) % hits.length;
    res.querySelectorAll('a').forEach((a, i) => { a.classList.toggle('sel', i === sel); if (i === sel) a.scrollIntoView({ block: 'nearest' }); });
  };
  input.addEventListener('focus', load);
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mv(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mv(-1); }
    else if (e.key === 'Enter' && hits[sel]) { const h = hits[sel]; location.href = h.p + (h.i ? '#' + h.i : ''); }
    else if (e.key === 'Escape') { res.hidden = true; input.blur(); }
  });
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); input.focus(); input.select(); }
  });
  document.addEventListener('click', e => { if (!box.contains(e.target)) res.hidden = true; });
  input.addEventListener('focus', () => { if (input.value.trim()) run(); });
})();
