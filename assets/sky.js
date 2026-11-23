/* ============================================================
   study room · home
   入场、云与漂浮物视差、滚动显现、今日数据
   ============================================================ */

(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 入场 ---------- */
  const ready = () => document.body.classList.add('is-ready');
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ready);
    setTimeout(ready, 700); /* 字体慢也不拖着 */
  } else {
    requestAnimationFrame(ready);
  }

  /* ---------- 视差（用 translate，避免和 keyframes 打架） ---------- */
  const items = [...document.querySelectorAll('[data-depth]')];
  let mx = 0, my = 0, sy = 0, raf = 0;

  const paint = () => {
    raf = 0;
    for (const el of items) {
      const d = +el.dataset.depth;
      const x = mx * d * 0.55;
      const y = my * d * 0.35 - sy * d * 0.5;
      el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    }
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };

  if (!reduce) {
    addEventListener('pointermove', (e) => {
      mx = (e.clientX / innerWidth - 0.5) * 2;
      my = (e.clientY / innerHeight - 0.5) * 2;
      queue();
    }, { passive: true });

    addEventListener('scroll', () => { sy = scrollY; queue(); }, { passive: true });
  }

  /* ---------- 导航：下滑收起，上滑回来 ---------- */
  const nav = document.getElementById('nav');
  let lastY = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (y > 120 && y > lastY + 4) nav.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 120) nav.classList.remove('is-hidden');
    nav.classList.toggle('is-crisp', y > 10);
    lastY = y;
  }, { passive: true });

  /* ---------- 滚动显现 ---------- */
  const risers = [...document.querySelectorAll('.rise')];
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((list) => {
      list.forEach((en) => {
        if (!en.isIntersecting) return;
        const sibs = [...en.target.parentElement.children].filter(n => n.classList.contains('rise'));
        const i = Math.max(0, sibs.indexOf(en.target));
        en.target.style.transitionDelay = `${Math.min(i * 90, 360)}ms`;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    risers.forEach(el => io.observe(el));
  } else {
    risers.forEach(el => el.classList.add('is-in'));
  }

  /* ---------- 今日数据 ---------- */
  const put = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  try {
    const s = Store.stats();
    put('tMin', Math.round(s.minToday));
    put('tPts', s.points);
    put('tStreak', s.streak);
  } catch (e) { /* 首次来没有数据也算正常 */ }
})();
