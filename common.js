// 共用：頂部導覽（分組）、上一頁 / 下一頁、code 複製按鈕、tabs
(function () {
  // 閱讀順序：觀念 → 實作 → 作業 → 參考
  const groups = [['', [['index.html', '首頁']]],
    ['觀念', [['01-pipeline.html', 'Pipeline'], ['05-vertex-draw.html', 'Vertex & Draw'], ['06-fragment-fbo.html', 'Fragment & FBO'], ['07-mesh-rendering.html', 'Mesh & 加速']]],
    ['實作', [['03-env-git.html', '環境 / 繳交'], ['02-project-syntax.html', '專案與語法']]],
    ['作業', [['as1-robot.html', 'AS1 機器人']]],
    ['參考', [['04-api.html', 'API 參考']]]];
  const pages = groups.flatMap(([, ps]) => ps);
  const cur = location.pathname.split('/').pop() || 'index.html';
  const nav = document.createElement('nav');
  nav.className = 'top';
  nav.innerHTML = groups.map(([g, ps]) => `<span class="grp">${g ? `<i>${g}</i>` : ''}` +
    ps.map(([h, t]) => `<a href="${h}" class="${h === cur ? 'on' : ''}">${t}</a>`).join('') + '</span>').join('');
  document.body.prepend(nav);

  const i = pages.findIndex(([h]) => h === cur), main = document.querySelector('main');
  if (i >= 0 && main) {
    const pn = document.createElement('div');
    pn.className = 'pn';
    pn.innerHTML = (i > 0 ? `<a href="${pages[i - 1][0]}">← ${pages[i - 1][1]}</a>` : '<span></span>') +
      (i < pages.length - 1 ? `<a href="${pages[i + 1][0]}">${pages[i + 1][1]} →</a>` : '<span></span>');
    main.appendChild(pn);
  }

  document.querySelectorAll('pre').forEach(pre => {
    const b = document.createElement('button');
    b.className = 'cp'; b.textContent = 'copy';
    b.onclick = () => navigator.clipboard.writeText(pre.querySelector('code')?.innerText ?? pre.innerText)
      .then(() => { b.textContent = 'copied'; setTimeout(() => b.textContent = 'copy', 1200); });
    pre.appendChild(b);
  });

  // <div class="tabs" data-group="x"><button data-pane="id">..</button></div> + <div class="pane" id="id">
  document.querySelectorAll('.tabs').forEach(tabs => {
    const btns = [...tabs.querySelectorAll('button')];
    const show = id => btns.forEach(b => {
      b.classList.toggle('on', b.dataset.pane === id);
      document.getElementById(b.dataset.pane).classList.toggle('on', b.dataset.pane === id);
    });
    btns.forEach(b => b.onclick = () => show(b.dataset.pane));
    show(btns[0].dataset.pane);
  });
})();
