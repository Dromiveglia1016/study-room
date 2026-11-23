/* ============================================================
   intro · 拉链拉开
   ============================================================ */

(() => {
  const el = document.getElementById('intro');
  if (!el) return;

  if (sessionStorage.getItem('sr.intro') === 'done') { el.remove(); return; }

  const pull = document.getElementById('introPull');
  let dragging = false, startY = 0, moved = 0, opened = false;

  const setZip = (v) => el.style.setProperty('--zip', Math.max(0, Math.min(1, v)));

  function open() {
    if (opened) return;
    opened = true;
    el.style.setProperty('--zip', 1);
    el.classList.add('is-open');
    sessionStorage.setItem('sr.intro', 'done');
    setTimeout(() => { el.classList.add('is-gone'); el.remove(); }, 1000);
  }

  const follow = (dy) => {
    pull.style.transform = `translate(-50%, calc(-50% + ${Math.max(0, Math.min(dy, 160))}px))`;
  };

  pull.addEventListener('pointerdown', (e) => {
    dragging = true; startY = e.clientY; moved = 0;
    pull.setPointerCapture(e.pointerId);
    pull.style.scale = '.94';
  });

  pull.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    moved = e.clientY - startY;
    if (moved > 0) setZip(moved / innerWidth);
    follow(moved);
    if (moved > innerWidth * 0.34) { dragging = false; open(); }
  });

  const release = () => {
    if (!dragging) return;
    dragging = false;
    pull.style.transform = '';
    pull.style.scale = '';
    const v = parseFloat(getComputedStyle(el).getPropertyValue('--zip')) || 0;
    if (v > 0.12 || Math.abs(moved) < 6) open();
    else setZip(0);
  };
  pull.addEventListener('pointerup', release);
  pull.addEventListener('pointercancel', release);
  pull.addEventListener('click', open);

  addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') open();
  });

  // 直接点也可以
  el.addEventListener('click', (e) => {
    if (e.target.closest('#introPull')) return;
    open();
  });
})();
