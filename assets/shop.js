/* ============================================================
   study room · shop page
   ============================================================ */

let curCat = 'all';

function cardHTML(m) {
  return `
  <article class="crate" data-id="${m.id}" data-cat="${m.cat}" data-theme="${m.theme}">
    <span class="crate__tag">${m.tag}</span>
    <div class="crate__box"><img class="${m.flip ? 'is-flip' : ''}" src="assets/shop/${m.img}.webp" alt="${m.name}"></div>
    <p class="crate__cat">${m.en}</p>
    <h3 class="crate__name">${m.name}</h3>
    <p class="crate__desc">${m.desc}</p>
    <div class="crate__foot">
      <span class="price">
        <b>${m.min}</b><small>min</small>
        <span class="price__pts"><i>+${m.pts} 积分</i></span>
      </span>
      <div class="crate__buy">
        <button class="add" type="button" data-act="add" aria-label="加入清单">add +</button>
        <div class="qty" hidden>
          <button type="button" data-act="dec" aria-label="减一份">−</button>
          <b>1</b>
          <button type="button" data-act="inc" aria-label="加一份">+</button>
        </div>
      </div>
    </div>
  </article>`;
}

function renderGrid() {
  const host = document.getElementById('grid');
  const list = MODULES.filter(m => curCat === 'all' || m.cat === curCat);
  host.innerHTML = list.map(cardHTML).join('');

  syncCards();

  const n = list.length;
  // 最后一行若只剩两张，各占一半，避免右侧空一格
  if (n > 2 && n % 3 === 2) {
    host.querySelectorAll('.crate').forEach((c, i) => {
      if (i >= n - 2) c.classList.add('is-wide');
    });
  }

  document.getElementById('count').innerHTML =
    `<b>${n}</b> 个模块 · 平均 <b>${Math.round(list.reduce((s, m) => s + m.min, 0) / n)}</b> 分钟一个`;
}

/* 卡片上的加购 / 加减份数 */
function bindGrid() {
  const host = document.getElementById('grid');
  host.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.crate');
    if (!card) return;
    const id = card.dataset.id;
    const act = btn.dataset.act;

    if (act === 'add') {
      Store.add(id);
      toast('放进清单 · 待会儿用时间付');
    } else if (act === 'inc') {
      if (Store.qty(id) >= Store.MAX_QTY) toast(`一种最多 ${Store.MAX_QTY} 份`);
      else Store.add(id);
    } else if (act === 'dec') {
      Store.dec(id);
    }
    syncCards();
    refreshNav();
    if (Drawer.isOpen()) Drawer.render();
  });
}

function mountPills() {
  const host = document.getElementById('pills');
  host.innerHTML = CATS.map(c =>
    `<button class="pill ${c.id === 'all' ? 'is-on' : ''}" type="button" data-cat="${c.id}">${c.label}</button>`
  ).join('');
  host.addEventListener('click', e => {
    const b = e.target.closest('.pill');
    if (!b) return;
    curCat = b.dataset.cat;
    host.querySelectorAll('.pill').forEach(p => p.classList.toggle('is-on', p === b));
    renderGrid();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  mountNav('shop');
  mountPills();
  renderGrid();
  bindGrid();

  document.getElementById('bundle').addEventListener('click', () => {
    const pack = ['vocab-basic', 'listening', 'politics-recite'];
    pack.forEach(id => { if (!Store.inCart(id)) Store.add(id); });
    syncCards(); refreshNav();
    Drawer.open();
  });
});
