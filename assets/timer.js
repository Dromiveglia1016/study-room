/* ============================================================
   study room · floating timer
   任何页面都能看到「还欠自己多少分钟」
   ============================================================ */

function ringEl(r, extra) {
  const c = 2 * Math.PI * r;
  return `<circle class="ring__bg" cx="25" cy="25" r="${r}"/>
    <circle class="ring__fg ${extra || ''}" cx="25" cy="25" r="${r}"
      stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 25 25)"/>`;
}

function setRing(circle, pct) {
  if (!circle) return;
  const r = parseFloat(circle.getAttribute('r'));
  const len = 2 * Math.PI * r;
  circle.setAttribute('stroke-dasharray', len);
  circle.setAttribute('stroke-dashoffset', len * (1 - Math.max(0, Math.min(1, pct))));
}

const Pop = (() => {
  let el, t, nm, sub, fg;

  function ensure() {
    if (el) return;
    el = document.createElement('a');
    el.className = 'pop';
    el.href = 'desk.html';
    el.innerHTML = `
      <span class="pop__ring">
        <svg viewBox="0 0 50 50">${ringEl(21)}</svg>
        <i class="pop__t">—</i>
      </span>
      <span class="pop__txt"><b>—</b><small>—</small></span>`;
    document.body.appendChild(el);
    t = el.querySelector('.pop__t');
    nm = el.querySelector('.pop__txt b');
    sub = el.querySelector('.pop__txt small');
    fg = el.querySelector('.ring__fg');
  }

  function update() {
    if (document.body.dataset.page === 'desk') { if (el) el.classList.remove('on'); return; }
    ensure();
    const o = Store.runningOrder() || Store.activeOrders()[0];
    if (!o) { el.classList.remove('on'); return; }
    const m = MODULES.find(x => x.id === o.mid) || { name: '学习' };
    const cur = Store.elapsed(o);
    const over = cur >= o.target;

    el.classList.add('on');
    el.classList.toggle('is-live', !!o.runningAt);
    setRing(fg, cur / o.target);
    fg.style.stroke = over ? '#3F7B3A' : 'var(--ink)';
    t.textContent = over ? '+' + fmtClock(cur - o.target) : fmtClock(o.target - cur);
    t.style.fontSize = over ? '10.5px' : '13px';
    nm.textContent = m.name;
    sub.textContent = !o.runningAt ? '已暂停 · 点开继续' : (over ? '达标了，可以收积分' : '正在计时');
  }

  setInterval(update, 500);
  document.addEventListener('DOMContentLoaded', update);
  addEventListener('storage', update);
  return { update };
})();
