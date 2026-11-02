// 講義 08 的互動示範：compute space、image 範例、std430、粒子、race condition
const $ = id => document.getElementById(id);

// ---------- Compute space：點一個 invocation 看內建變數 ----------
(() => {
  const ids = ['spLx', 'spLy', 'spLz', 'spDx', 'spDy', 'spDz'];
  const cv = $('spCv'), g = cv.getContext('2d');
  const COL = ['#dbeafe', '#fde7b6', '#c6f0d6', '#fecaca', '#e9d5ff', '#fef08a', '#bae6fd', '#fbcfe8'];
  let sel = [2, 1, 1], geo = null;
  const val = id => Math.max(+$(id).min, Math.min(+$(id).max, Math.floor(+$(id).value) || 1));
  function draw() {
    const [lx, ly, lz, dx, dy, dz] = ids.map(val);
    const GX = lx * dx, GY = ly * dy, GZ = lz * dz;
    const zs = $('spZ'), zPrev = +zs.value || sel[2];
    zs.innerHTML = Array.from({ length: GZ }, (_, z) => `<option>${z}</option>`).join('');
    zs.value = Math.min(zPrev, GZ - 1);
    sel = [Math.min(sel[0], GX - 1), Math.min(sel[1], GY - 1), +zs.value];
    const pad = 30, cs = Math.max(14, Math.min(44, Math.floor(400 / GX), Math.floor(300 / GY)));
    cv.width = pad + GX * cs + 10; cv.height = pad + GY * cs + 10;
    geo = { pad, cs, GX, GY };
    g.clearRect(0, 0, cv.width, cv.height);
    g.font = '11px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
      const w = [Math.floor(x / lx), Math.floor(y / ly), Math.floor(sel[2] / lz)];
      const wi = w[0] + w[1] * dx + w[2] * dx * dy;
      g.fillStyle = COL[wi % COL.length];
      g.fillRect(pad + x * cs, pad + y * cs, cs, cs);
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(pad + x * cs + .5, pad + y * cs + .5, cs - 1, cs - 1);
    }
    g.strokeStyle = '#333'; g.lineWidth = 2.5;                       // work group 邊界
    for (let x = 0; x <= GX; x += lx) { g.beginPath(); g.moveTo(pad + x * cs, pad); g.lineTo(pad + x * cs, pad + GY * cs); g.stroke(); }
    for (let y = 0; y <= GY; y += ly) { g.beginPath(); g.moveTo(pad, pad + y * cs); g.lineTo(pad + GX * cs, pad + y * cs); g.stroke(); }
    g.strokeStyle = '#c53030'; g.lineWidth = 3; g.strokeRect(pad + sel[0] * cs + 2, pad + sel[1] * cs + 2, cs - 4, cs - 4);
    g.fillStyle = '#555';
    g.fillText('x →', pad + GX * cs / 2, 12); g.save(); g.translate(10, pad + GY * cs / 2); g.rotate(-Math.PI / 2); g.fillText('← y', 0, 0); g.restore();
    for (let x = 0; x < GX; x++) g.fillText(x, pad + x * cs + cs / 2, pad - 8);
    for (let y = 0; y < GY; y++) g.fillText(y, pad - 10, pad + y * cs + cs / 2);
    const L = [lx, ly, lz], D = [dx, dy, dz];
    const wg = sel.map((v, i) => Math.floor(v / L[i])), li = sel.map((v, i) => v % L[i]);
    const f = a => `(${a.join(', ')})`;
    $('spTbl').innerHTML = '<tr><th>變數</th><th>值</th></tr>' +
      [['gl_WorkGroupSize', f(L)], ['gl_NumWorkGroups', f(D)], ['gl_WorkGroupID', f(wg)], ['gl_LocalInvocationID', f(li)], ['gl_GlobalInvocationID', f(sel)]]
        .map(([n, v]) => `<tr><td><code>${n}</code></td><td><code>${v}</code></td></tr>`).join('') +
      `<tr><td colspan="2" class="mut">檢查：${f(wg)} × ${f(L)} + ${f(li)} = ${f(sel)}</td></tr>`;
    $('spSum').innerHTML = `一個 work group ${lx}×${ly}×${lz} = <b>${lx * ly * lz}</b> 個 invocation；共 ${dx}×${dy}×${dz} = <b>${dx * dy * dz}</b> 個 work group → 總共 <b>${lx * ly * lz * dx * dy * dz}</b> 個 invocation。` +
      (GZ > 1 ? ` 畫面只畫一層 z，用右上角的選單換層。` : '');
  }
  cv.onclick = e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * cv.width, y = (e.clientY - r.top) / r.height * cv.height;
    const gx = Math.floor((x - geo.pad) / geo.cs), gy = Math.floor((y - geo.pad) / geo.cs);
    if (gx >= 0 && gy >= 0 && gx < geo.GX && gy < geo.GY) { sel = [gx, gy, +$('spZ').value]; draw(); }
  };
  ids.forEach(id => $(id).oninput = draw);
  $('spZ').onchange = () => { sel[2] = +$('spZ').value; draw(); };
  $('spZ').innerHTML = '<option>1</option>'; $('spZ').value = '1';
  draw();
})();

// ---------- Image 範例：JS 逐 pixel 跑講義的 compute shader ----------
(() => {
  const N = 512, cv = $('imCv'), g = cv.getContext('2d');
  // source texture：image 座標 (x, y)，y = 0 在下面
  const src = new Float32Array(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = (y * N + x) * 3, u = x / N, v = y / N;
    const ring = Math.sin(Math.hypot(u - 0.5, v - 0.5) * 40) * 0.5 + 0.5;
    src[k] = 0.3 + 0.7 * u; src[k + 1] = 0.3 + 0.6 * v * ring; src[k + 2] = 0.9 - 0.6 * u * v;
  }
  const img = g.createImageData(N, N);
  let mouse = { px: [256, 256], img: [256, 255] };   // 預設在中間
  function run() {
    const mc = mouse ? mouse.img : [-1000, -1000];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {      // 每個 (x, y) = 一個 invocation
      const s = (y * N + x) * 3;
      const d = Math.hypot(x - mc[0], y - mc[1]);
      const m = Math.max(100 - d, 0) / 100;
      const o = ((N - 1 - y) * N + x) * 4;                         // 畫到 canvas 時 image 的 y = 0 放最下面
      img.data[o] = 255 * (0.2 + (src[s] - 0.2) * m);
      img.data[o + 1] = 255 * (0.2 + (src[s + 1] - 0.2) * m);
      img.data[o + 2] = 255 * (0.2 + (src[s + 2] - 0.2) * m);
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    if ($('imGrid').checked) {
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath();
      for (let k = 0; k <= N; k += 16) { g.moveTo(k + .5, 0); g.lineTo(k + .5, N); g.moveTo(0, k + .5); g.lineTo(N, k + .5); }
      g.stroke();
    }
    if (mouse) {
      const [px, py] = mouse.px, iy = N - 1 - py;                   // 滑鼠所在 pixel 的 image 座標
      const wg = [Math.floor(px / 16), Math.floor(iy / 16)];
      g.strokeStyle = '#ff3b30'; g.lineWidth = 2; g.strokeRect(wg[0] * 16, N - (wg[1] + 1) * 16, 16, 16);
      const d = Math.hypot(px - mc[0], iy - mc[1]), m = Math.max(100 - d, 0) / 100;
      $('imInfo').innerHTML =
        `滑鼠（GLFW，原點左上）：<code>(${px}, ${py})</code><br>傳給 shader 的 <code>mouseCursor.xy</code> = <code>(${mc[0]}, ${mc[1]})</code>${$('imFlip').checked ? '（y 翻轉過）' : '（沒翻轉）'}<br><br>` +
        `滑鼠下的 pixel 由這個 invocation 處理：<br><code>gl_GlobalInvocationID</code> = <code>(${px}, ${iy}, 0)</code><br>` +
        `<code>gl_WorkGroupID</code> = <code>(${wg[0]}, ${wg[1]}, 0)</code>（紅框）<br><code>gl_LocalInvocationID</code> = <code>(${px % 16}, ${iy % 16}, 0)</code><br><br>` +
        `<code>d</code> = ${d.toFixed(1)}，<code>m</code> = ${m.toFixed(2)} → ${m >= 0.99 ? '原圖' : m > 0 ? '原圖與灰色混合' : '灰色 (0.2)'}<br>` +
        `<span class="mut">共 32 × 32 = 1024 個 work group、每個 256 個 invocation。</span>`;
    } else $('imInfo').innerHTML = '<span class="mut">把滑鼠移到左邊的圖上。</span>';
  }
  cv.onmousemove = e => {
    const r = cv.getBoundingClientRect();
    const px = Math.min(N - 1, Math.floor((e.clientX - r.left) / r.width * N)), py = Math.min(N - 1, Math.floor((e.clientY - r.top) / r.height * N));
    mouse = { px: [px, py], img: [px, $('imFlip').checked ? N - 1 - py : py] };
    run();
  };
  cv.onmouseleave = () => { mouse = null; run(); };
  $('imGrid').onchange = run;
  $('imFlip').onchange = () => { if (mouse) mouse.img[1] = $('imFlip').checked ? N - 1 - mouse.px[1] : mouse.px[1]; run(); };
  run();
})();

// ---------- std430 計算器 ----------
(() => {
  const PRE = [
    ['講義：int + 不定長 float 陣列', 'int foo;\nfloat data[];'],
    ['講義：struct { int; uint; } 陣列', 'struct SSBO_DATA { int data0; uint data1; };\nSSBO_DATA data[];'],
    ['講義：struct { vec4; ivec4; } 陣列', 'struct SSBO_DATA { vec4 data0; ivec4 data1; };\nSSBO_DATA data[];'],
    ['講義：vec3（單一）', 'vec3 data;'],
    ['講義：vec3 陣列', 'vec3 data[];'],
    ['講義：struct { vec3; } 陣列', 'struct SSBO_DATA { vec3 data0; };\nSSBO_DATA data[];'],
    ['講義：struct { vec4; int; } 陣列', 'struct SSBO_DATA { vec4 data0; int data1; };\nSSBO_DATA data[];'],
    ['陷阱：float、vec3、float', 'float f;\nvec3 v;\nfloat g;'],
    ['粒子：4 個 vec4', 'struct ParticleProties { vec4 position; vec4 velocity; vec4 color; vec4 properties; };\nParticleProties particleProps[];'],
    ['DrawCommand', 'struct DrawCommand { uint count; uint instanceCount; uint firstIndex; uint baseVertex; uint baseInstance; };\nDrawCommand commands[];'],
  ];
  // [GLSL 大小, GLSL 對齊, C++ glm 大小, C++ 對齊, C++ 型別名]
  const T = { float: [4, 4, 4, 4, 'float'], int: [4, 4, 4, 4, 'int'], uint: [4, 4, 4, 4, 'unsigned'], bool: [4, 4, 4, 4, 'int'] };
  for (const [p, b, c] of [['', 'float', 'vec'], ['i', 'int', 'ivec'], ['u', 'uint', 'uvec']]) {
    T[p + 'vec2'] = [8, 8, 8, 4, 'glm::' + c + '2']; T[p + 'vec3'] = [12, 16, 12, 4, 'glm::' + c + '3']; T[p + 'vec4'] = [16, 16, 16, 4, 'glm::' + c + '4'];
  }
  T.mat4 = [64, 16, 64, 4, 'glm::mat4'];
  const up = (x, a) => Math.ceil(x / a) * a;
  const sel = $('laPre'), ta = $('laSrc');
  sel.innerHTML = PRE.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('');
  sel.onchange = () => { ta.value = PRE[sel.value][1]; calc(); };
  ta.oninput = calc;
  function parseMembers(body) {          // "type name;" 或 "type name[N];" / "type name[];"
    return body.split(';').map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^(\w+)\s+(\w+)\s*(\[\s*(\d*)\s*\])?$/);
      if (!m) throw new Error('看不懂：' + s);
      return { type: m[1], name: m[2], arr: m[3] ? (m[4] ? +m[4] : -1) : 0 };
    });
  }
  function calc() {
    let out = '';
    try {
      let src = ta.value, structs = {};
      src = src.replace(/struct\s+(\w+)\s*\{([^}]*)\}\s*;?/g, (_, n, b) => { structs[n] = parseMembers(b); return ''; });
      const mem = parseMembers(src);
      // 型別資訊：[glslSize, glslAlign, cppSize, cppAlign, 成員展開]
      const info = t => {
        if (T[t]) return { gs: T[t][0], ga: T[t][1], cs: T[t][2], ca: T[t][3] };
        if (!structs[t]) throw new Error('未知型別：' + t);
        let go = 0, ga = 4, co = 0, ca = 4;
        for (const m of structs[t]) {
          const s = info(m.type), n = Math.max(1, m.arr);
          const gst = m.arr ? up(s.gs, s.ga) : s.gs, cst = s.cs;
          go = up(go, s.ga) + (m.arr ? gst * n : s.gs); ga = Math.max(ga, s.ga);
          co = up(co, s.ca) + cst * n; ca = Math.max(ca, s.ca);
        }
        return { gs: up(go, ga), ga, cs: up(co, ca), ca };
      };
      // 展開成要畫的欄位（陣列只畫前 2 個元素）
      const rows = [];
      let go = 0, co = 0;
      const place = (prefix, type, isArr, n, base) => {
        const s = info(type);
        const gstride = isArr ? up(s.gs, s.ga) : s.gs;
        base.go = up(base.go, s.ga); base.co = up(base.co, s.ca);
        const cnt = isArr ? (n < 0 ? 2 : Math.min(n, 2)) : 1;
        for (let i = 0; i < cnt; i++) {
          const nm = prefix + (isArr ? `[${i}]` : '');
          const g0 = base.go + i * gstride, c0 = base.co + i * s.cs;
          if (structs[type]) {
            const sub = { go: g0, co: c0 };
            for (const m of structs[type]) place(nm + '.' + m.name, m.type, !!m.arr, m.arr, sub);
          } else rows.push({ nm, type, g: g0, c: c0, size: T[type][0] });
        }
        const total = isArr ? (n < 0 ? 2 : n) : 1;
        base.go += gstride * total; base.co += s.cs * total;
        return { gstride, cstride: s.cs };
      };
      const base = { go: 0, co: 0 }, strides = [];
      mem.forEach((m, i) => {
        if (m.arr === -1 && i !== mem.length - 1) throw new Error(`不定長陣列 ${m.name}[] 必須是 block 的最後一個成員`);
        const r = place(m.name, m.type, !!m.arr, m.arr, base);
        if (m.arr) strides.push(`<code>${m.name}[]</code> 的 stride：GLSL <b>${r.gstride}</b>、C++ <b>${r.cstride}</b>` + (r.gstride !== r.cstride ? ' <span class="bad">← 不同</span>' : ' <span class="ok">✓</span>'));
      });
      const end = Math.max(...rows.map(r => Math.max(r.g, r.c) + r.size), 16);
      const COL = ['#dbeafe', '#fde7b6', '#c6f0d6', '#e9d5ff', '#fecaca', '#bae6fd', '#fef08a', '#fbcfe8'];
      const bar = key => {
        const slots = Array(Math.ceil(up(end, 16) / 4)).fill(null);
        rows.forEach((r, i) => { for (let b = 0; b < r.size; b += 4) slots[(r[key] + b) / 4] = { r, i, first: b === 0 }; });
        return '<div class="lay">' + slots.map((s, k) => s ? `<div style="background:${COL[s.i % COL.length]}" title="${s.r.nm} @ ${s.r[key]}">${s.first ? s.r.nm : ''}</div>` : `<div class="pad">${k * 4 % 16 === 0 ? k * 4 : ''}</div>`).join('') + '</div>';
      };
      const bad = rows.filter(r => r.g !== r.c);
      out += '<b>GLSL（std430）</b>' + bar('g') + '<b>C++（直接換成 glm 型別）</b>' + bar('c');
      out += '<table><tr><th>成員</th><th>GLSL offset</th><th>C++ offset</th></tr>' + rows.map(r => `<tr><td><code>${r.nm}</code></td><td>${r.g}</td><td class="${r.g === r.c ? '' : 'bad'}">${r.c}</td></tr>`).join('') + '</table>';
      if (strides.length) out += '<p style="margin:4px 0">' + strides.join('<br>') + '</p>';
      out += bad.length ? `<p class="bad" style="margin:4px 0">對不上：${bad.map(r => r.nm).join('、')}。修法：把 vec3 改成 vec4（C++ 用 glm::vec4），或在 C++ 手動補 padding。</p>`
        : '<p class="ok" style="margin:4px 0">✓ 每個欄位的 offset 都一樣，C++ struct 可以直接上傳。</p>';
    } catch (e) { out = `<p class="bad">${e.message}</p>`; }
    $('laOut').innerHTML = out;
  }
  sel.value = 7; ta.value = PRE[7][1]; calc();
})();

// ---------- 粒子模擬：講義 compute shader 的 JS 版 ----------
(() => {
  const cv = $('paCv'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  let n, P, V, C, L, run = true, mouse = [0, 0], last = performance.now(), fps = 0;
  const rnd = (x, y) => { const f = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return (f - Math.floor(f)) * 2 - 1; };   // virtualRand：-1 ~ 1
  function reset() {
    n = +$('paN').value;
    P = new Float32Array(n * 2); V = new Float32Array(n * 2); C = new Float32Array(n * 3); L = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      P[i * 2] = Math.random() * 2 - 1; P[i * 2 + 1] = Math.random() * 2 - 1;
      C.set([0.4 + 0.6 * Math.random(), 0.3 + 0.5 * Math.random(), 1], i * 3);
      L[i * 2] = L[i * 2 + 1] = (Math.random() + 1.1) * 5 * 0.1;   // 壽命縮短（講義的要跑很久才會重生）
    }
  }
  const DT = 0.00002, INV_MASS = 1 / 0.1;
  function step() {                                // = glDispatchCompute 一次：每顆粒子跑一次 main()
    const [mx, my] = mouse;
    for (let i = 0; i < n; i++) {
      let px = P[i * 2], py = P[i * 2 + 1], vx = V[i * 2], vy = V[i * 2 + 1], life = L[i * 2 + 1];
      if (life <= 0) {                             // 重生
        px = rnd(px, py); py = rnd(vx, vy); vx = 0; vy = 0;
        L[i * 2] = (rnd(px, py) + 1.1) * 5 * 0.1; life = L[i * 2];
      }
      const dx = mx - px, dy = my - py, dis = Math.hypot(dx, dy);
      const f = dis > 0.00001 ? 100 / dis : 0;
      const ax = (dis > 0 ? dx / dis : 0) * f * INV_MASS, ay = (dis > 0 ? dy / dis : 0) * f * INV_MASS;
      P[i * 2] = px + vx * DT + 0.5 * ax * DT * DT; P[i * 2 + 1] = py + vy * DT + 0.5 * ay * DT * DT;
      V[i * 2] = (vx + ax * DT) * 0.99993; V[i * 2 + 1] = (vy + ay * DT) * 0.99993;
      L[i * 2 + 1] = life - DT;
    }
  }
  const img = g.createImageData(W, H);
  function render() {                              // = VS（位置是 NDC）+ FS + 加法混色
    const d = img.data; d.fill(0); for (let k = 3; k < d.length; k += 4) d[k] = 255;
    for (let i = 0; i < n; i++) {
      const x = Math.floor((P[i * 2] * 0.5 + 0.5) * W), y = Math.floor((0.5 - P[i * 2 + 1] * 0.5) * H);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const a = Math.max(0, L[i * 2 + 1] / L[i * 2]) * 255;
      for (const o of [(y * W + x) * 4, (y * W + Math.min(W - 1, x + 1)) * 4, (Math.min(H - 1, y + 1) * W + x) * 4]) {   // 每顆畫 3 個 pixel，比較看得到
        d[o] = Math.min(255, d[o] + C[i * 3] * a); d[o + 1] = Math.min(255, d[o + 1] + C[i * 3 + 1] * a); d[o + 2] = Math.min(255, d[o + 2] + C[i * 3 + 2] * a);
      }
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc((mouse[0] * 0.5 + 0.5) * W, (0.5 - mouse[1] * 0.5) * H, 5, 0, 7); g.stroke();
  }
  let visible = false;                             // 不在畫面上時不跑，省 CPU
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  function loop(t) {
    if (run && visible) {
      const k = +$('paK').value;
      for (let s = 0; s < k; s++) step();
      render();
      fps = 0.9 * fps + 0.1 * (1000 / Math.max(1, t - last));
      $('paFps').textContent = `${fps.toFixed(0)} FPS（每幀 ${k} 次 × ${n} 顆 = ${(k * n / 1e6).toFixed(2)} M 次 main()）`;
    }
    last = t;
    requestAnimationFrame(loop);
  }
  cv.onmousemove = e => { const r = cv.getBoundingClientRect(); mouse = [((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2]; };
  $('paK').oninput = () => $('paKV').textContent = $('paK').value;
  $('paRun').onclick = () => { run = !run; $('paRun').textContent = run ? '暫停' : '繼續'; };
  $('paReset').onclick = $('paN').onchange = reset;
  $('paKV').textContent = $('paK').value;
  reset(); render();
  requestAnimationFrame(loop);
})();

// ---------- Race condition：8 個 invocation 同時執行 ----------
(() => {
  const K = 8, NAMES = 'ABCDEFGH';
  let step = 0, st;
  const mode = () => document.querySelector('input[name=rcM]:checked').value;
  function reset() { step = 0; st = { cnt: 0, buf: Array(K).fill(null), read: Array(K).fill(null), slot: Array(K).fill(null) }; render(); }
  // atomicAdd 的順序由硬體決定，這裡用一個打亂的順序
  const ORDER = [3, 0, 6, 1, 7, 4, 2, 5];
  const STEPS = {
    race: [
      ['① 8 個 invocation 同時讀 instanceCount', s => { for (let i = 0; i < K; i++) s.read[i] = s.cnt; }],
      ['② 同時把自己的 instance 寫到 currValid[TARGET_IDX]', s => { for (let i = 0; i < K; i++) { s.slot[i] = s.read[i]; s.buf[s.read[i]] = NAMES[i]; } }],
      ['③ 同時寫回 instanceCount = 讀到的值 + 1', s => { for (let i = 0; i < K; i++) s.cnt = s.read[i] + 1; }],
    ],
    atomic: [
      ['① atomicAdd：硬體一次處理一個，回傳加之前的值', s => { ORDER.forEach(i => { s.read[i] = s.cnt; s.cnt++; }); }],
      ['② 各自寫到 currValid[UNIQUE_IDX]', s => { for (let i = 0; i < K; i++) { s.slot[i] = s.read[i]; s.buf[s.read[i]] = NAMES[i]; } }],
    ],
  };
  function render() {
    const S = STEPS[mode()];
    $('rcCnt').innerHTML = `<div class="${step === S.length ? (st.cnt === K ? 'g' : 'x') : 'w'}">${st.cnt}</div>`;
    $('rcBuf').innerHTML = st.buf.map((v, i) => `<div class="${v ? 'w' : ''}"><small>${i}</small>${v || ''}</div>`).join('');
    $('rcTbl').innerHTML = '<tr><th>invocation</th>' + NAMES.split('').map(c => `<th>${c}</th>`).join('') + '</tr>' +
      `<tr><td>${mode() === 'race' ? '讀到 TARGET_IDX' : 'atomicAdd 回傳'}</td>` + st.read.map(v => `<td>${v ?? '–'}</td>`).join('') + '</tr>' +
      '<tr><td>寫到第幾格</td>' + st.slot.map(v => `<td>${v ?? '–'}</td>`).join('') + '</tr>';
    $('rcTxt').innerHTML = step === 0 ? '<span class="mut">8 個 instance 都在視野內，正確答案是 instanceCount = 8、0 ~ 7 格各放一個。</span>'
      : step < S.length ? `<b>${S[step - 1][0]}</b>`
      : mode() === 'race' ? `<b>${S[step - 1][0]}</b><br><span class="bad">結果 instanceCount = ${st.cnt}，只有第 0 格有資料（最後寫的人蓋掉其他人）→ 只會畫 1 個 instance。</span>`
      : `<b>${S[step - 1][0]}</b><br><span class="ok">結果 instanceCount = 8，每個 instance 各有一格。</span>（誰拿到哪一格不固定，但不會重複）`;
    $('rcStep').disabled = step >= S.length;
  }
  $('rcStep').onclick = () => { const S = STEPS[mode()]; if (step < S.length) { S[step][1](st); step++; render(); } };
  $('rcReset').onclick = reset;
  document.querySelectorAll('input[name=rcM]').forEach(r => r.onchange = reset);
  reset();
})();
