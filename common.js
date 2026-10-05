// 共用：頂部導覽、code 複製按鈕、tabs
(function () {
  const pages = [['index.html', '首頁'], ['01-pipeline.html', '1. Rendering Pipeline'],
    ['02-project-syntax.html', '2. 專案結構與語法'], ['03-env-git.html', '3. 環境 / 繳交 / Git'], ['04-api.html', '4. API 參考'], ['05-vertex-draw.html', '5. Vertex & Draw']];
  const cur = location.pathname.split('/').pop() || 'index.html';
  const nav = document.createElement('nav');
  nav.className = 'top';
  nav.innerHTML = pages.map(([h, t]) => `<a href="${h}" class="${h === cur ? 'on' : ''}">${t}</a>`).join('');
  document.body.prepend(nav);

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
