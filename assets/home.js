/* ============================================================
   study room · home
   视差 / 玩偶倾斜 / 纸片拖拽带惯性 / 纸卡展开 / 今日数据
   ============================================================ */
(() => {
  const q = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => matchMedia('(max-width: 860px)').matches;

  /* ---------------------------------------------------- 入场 */
  requestAnimationFrame(() => {
    document.body.classList.add('is-ready');
    // 入场动画结束把控制权交回 JS，避免 transform 互相覆盖
    setTimeout(() => {
      document.querySelectorAll('.toy').forEach(t => {
        t.style.animation = 'none';
        t.style.opacity = '1';
      });
    }, 1300);
  });

  /* ---------------------------------------------------- 视差 */
  const bgImg = q('#bgImg');
  const hero = q('#hero');
  const bunny = q('#bunny');
  const cat = q('#cat');
  const notes = [q('#noteShop'), q('#noteEn')];
  const toys = [bunny, cat];

  let tx = 0, ty = 0, cx = 0, cy = 0, raf = null, active = false, gate = false;
  setTimeout(() => { gate = true; }, 1200);

  function loop() {
    cx += (tx - cx) * 0.07;
    cy += (ty - cy) * 0.07;
    if (bgImg) bgImg.style.transform = `translate3d(${cx * 9}px,${cy * 7}px,0) scale(1.045)`;
    toys.forEach((t, i) => {
      if (!t) return;
      const k = i ? 1.25 : 1;
      t.style.transform = `translate3d(${cx * 15 * k}px,${cy * 10 * k}px,0)`;
    });
    if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
      raf = requestAnimationFrame(loop);
    } else { raf = null; }
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  if (!reduced && !narrow()) {
    addEventListener('pointermove', e => {
      if (!gate) return;
      tx = (e.clientX / innerWidth - 0.5) * 2;
      ty = (e.clientY / innerHeight - 0.5) * 2;
      active = true;
      kick();
    }, { passive: true });
    addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  }

  /* ---------------------------------------------------- 玩偶：3D 倾斜 + 说话 */
  const bubble = q('#bubble');
  const lines = [
    '今天想先学哪一科？',
    '学 25 分钟就够，真的。',
    '积分都记着呢，别慌。',
    '纸袋有点闷，但值得。'
  ];
  let bubbleTimer = null;

  toys.forEach((toy, i) => {
    if (!toy) return;
    const base = () => (i ? 'translate3d(' + (cx * 18) + 'px,' + (cy * 12) + 'px,0)' : 'translate3d(' + (cx * 15) + 'px,' + (cy * 10) + 'px,0)');

    toy.addEventListener('pointermove', e => {
      if (reduced || narrow() || e.pointerType !== 'mouse') return;
      const r = toy.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      toy.style.transform = `${base()} perspective(700px) rotateY(${px * 15}deg) rotateX(${-py * 12}deg) translateZ(14px)`;
      toy.classList.add('is-hot');
    });
    toy.addEventListener('pointerleave', () => {
      toy.classList.remove('is-hot');
      toy.style.transform = base();
    });
    toy.addEventListener('click', () => {
      toy.classList.remove('is-wiggle');
      void toy.offsetWidth;
      toy.classList.add('is-wiggle');
      setTimeout(() => toy.classList.remove('is-wiggle'), 700);

      if (bubble) {
        bubble.textContent = lines[Math.floor(Math.random() * lines.length)];
        const r = toy.getBoundingClientRect();
        const sr = scene ? scene.getBoundingClientRect() : { left: 0, top: 0 };
        bubble.style.left = Math.round(r.left - sr.left + r.width * 0.58) + 'px';
        bubble.style.top = Math.round(r.top - sr.top - bubble.offsetHeight - 12) + 'px';
        bubble.classList.remove('on');
        requestAnimationFrame(() => bubble.classList.add('on'));
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => bubble.classList.remove('on'), 2800);
      }
    });
  });

  /* ---------------------------------------------------- 今日数据 */
  (function today() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem('studyroom.v2') || 'null'); } catch (e) { data = null; }
    if (!data || typeof data !== 'object') return;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const t0 = startOfDay.getTime();
    let sec = 0;
    (data.history || []).forEach(h => {
      const at = h.at || h.settledAt || 0;
      if (at >= t0) sec += Number(h.spent) || 0;
    });
    (data.orders || []).forEach(o => {
      if (o.done) return;
      sec += Number(o.accum) || 0;
      if (o.runningAt) sec += (Date.now() - o.runningAt) / 1000;
    });
    const min = Math.round(sec / 60);
    const minEl = q('#dcardMin');
    const tagEl = q('#dcardTag');
    if (minEl) minEl.textContent = min;
    if (tagEl) {
      tagEl.textContent = min === 0
        ? '还没开始，第一段总是最难'
        : min < 25 ? '刚热起来，再坐一会儿'
        : min < 60 ? '今天已经很够了'
        : '今天超额完成，去换点甜的';
    }
  })();

  /* ---------------------------------------------------- 纸片：拖拽 + 惯性 */
  const scene = q('#scene');

  function dragNote(el) {
    if (!el) return;
    let down = false, moved = false;
    let sx = 0, sy = 0, ox = 0, oy = 0, rot = 0;
    let vx = 0, vy = 0, lastX = 0, lastY = 0, lastT = 0;
    let anim = null;

    const stopAnim = () => { if (anim) cancelAnimationFrame(anim); anim = null; };

    el.addEventListener('pointerdown', e => {
      if (narrow() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      stopAnim();
      const cs = getComputedStyle(el);
      const m = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform);
      ox = m.e; oy = m.f;
      rot = Math.atan2(m.b, m.a) * 180 / Math.PI;
      el.style.animation = 'none';
      el.style.opacity = '1';
      el.style.transition = 'none';
      down = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
      vx = vy = 0;
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('is-drag');
    });

    el.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      const now = performance.now();
      const dt = Math.max(16, now - lastT);
      vx = (e.clientX - lastX) / dt * 16;
      vy = (e.clientY - lastY) / dt * 16;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      el.style.transform = `translate(${ox + dx}px,${oy + dy}px) rotate(${rot + clamp(vx * 0.35, -7, 7)}deg)`;
    });

    const release = () => {
      if (!down) return;
      down = false;
      el.classList.remove('is-drag');
      if (!moved) return;
      // 惯性滑行
      const r = el.getBoundingClientRect();
      let x = 0, y = 0;
      const read = getComputedStyle(el).transform;
      if (read !== 'none') {
        const m = new DOMMatrixReadOnly(read);
        x = m.e; y = m.f;
      }
      let f = 0.9;
      const step = () => {
        vx *= f; vy *= f;
        x += vx; y += vy;
        const maxX = Math.max(0, scene.clientWidth * 0.36);
        const maxY = Math.max(0, scene.clientHeight * 0.3);
        if (Math.abs(x) > maxX) { x = clamp(x, -maxX, maxX); vx *= -0.35; }
        if (Math.abs(y) > maxY) { y = clamp(y, -maxY, maxY); vy *= -0.35; }
        el.style.transform = `translate(${x}px,${y}px) rotate(${rot + clamp(vx * 0.5, -8, 8)}deg)`;
        if (Math.abs(vx) > 0.12 || Math.abs(vy) > 0.12) {
          anim = requestAnimationFrame(step);
        } else {
          anim = null;
          el.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg)`;
        }
      };
      anim = requestAnimationFrame(step);
    };

    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('click', e => {
      if (moved) { e.preventDefault(); moved = false; return; }
      e.preventDefault();
      openSheet(el);
    });
    el.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); openSheet(el); }
    });
  }

  notes.forEach(dragNote);

  /* 双击直接走 */
  notes.forEach(el => {
    el.addEventListener('dblclick', e => {
      e.preventDefault();
      location.href = el.getAttribute('href');
    });
  });

  /* ---------------------------------------------------- 纸卡 */
  const SHEETS = {
    shop: {
      k: '01 / shop',
      t: '学科商店',
      d: '这里不用付钱，用学习时间买单。挑一个模块，学够它，积分才到账。',
      list: [
        ['在架', '11 个模块：英语 5 个、数学 1 个、政治 3 个、遗传学 2 个'],
        ['付款', '按分钟计价，学完才结算；超出的时间每 10 分钟再加 5 分'],
        ['视频', '数学和遗传学配了网课，买完可以直接跳去 B 站']
      ],
      go: 'shop.html',
      cta: '进商店'
    },
    en: {
      k: '02 / english',
      t: 'Word Journey',
      d: '每天一个单词故事。不是背清单，是把词放进句子里读一遍。',
      list: [
        ['进度', '153 个章节，一天一段，读完自动打勾'],
        ['拆解', '生词、句子结构、翻译摊在同一页，不用来回跳'],
        ['回头', '学过的词会隔几天再来找你一次']
      ],
      go: 'subjects/english/index.html',
      cta: '去读一段'
    }
  };

  const sheet = q('#sheet');
  let lastFocus = null;

  function openSheet(el) {
    const key = el?.dataset.sheet;
    const data = SHEETS[key];
    if (!data || !sheet) return;
    lastFocus = document.activeElement;
    q('#sheetK').textContent = data.k;
    q('#sheetT').textContent = data.t;
    q('#sheetD').textContent = data.d;
    q('#sheetL').innerHTML = data.list.map(([b, t]) => `<li><b>${b}</b><span>${t}</span></li>`).join('');
    const go = q('#sheetGo');
    go.href = data.go;
    go.firstChild.textContent = data.cta + ' ';
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('on'));
    setTimeout(() => q('.sheet__close')?.focus({ preventScroll: true }), 320);
  }

  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('on');
    setTimeout(() => { sheet.hidden = true; lastFocus?.focus?.({ preventScroll: true }); }, 300);
  }

  if (sheet) {
    sheet.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) closeSheet();
    });
    addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSheet();
    });
  }

  /* 触屏上轻点纸片也走同一套 */
  addEventListener('resize', () => {
    if (narrow()) notes.forEach(n => { n.style.animation = ''; n.style.transform = ''; });
  });
})();
