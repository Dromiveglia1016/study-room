/* ============================================================
   study room · shop page
   ============================================================ */

let curCat = 'all';

function cardHTML(m) {
  return `
  <article class="crate" data-id="${m.id}" data-cat="${m.cat}" data-theme="${m.theme}">
    <span class="crate__tag">${m.tag}</span>
    <div class="crate__box"><img src="assets/shop/${m.img}.webp" alt="${m.name}"></div>
    <p class="crate__cat">${m.en}</p>
    <h3 class="crate__name">${m.name}</h3>
    <p class="crate__desc">${m.desc}</p>
    <div class="crate__foot">
      <span class="price">
        <b>${m.min}</b><small>min</small>
        <span class="price__pts"><i>+${m.pts} 积分</i></span>
      </span>
      <button class="add" type="button">add +</button>
    </div>
  </article>`;
}

function renderGrid() {
  const host = document.getElementById('grid');
  const list = MODULES.filter(m => curCat === 'all' || m.cat === curCat);
  host.innerHTML = list.map(cardHTML).join('');

  host.querySelectorAll('.crate').forEach(c => {
    const id = c.dataset.id;
    const btn = c.querySelector('.add');
    btn.addEventListener('click', () => {
      const on = Store.toggleCart(id);
      syncCards(); refreshNav();
      toast(on ? '已放进清单 · 待会儿用时间付' : '拿出来了');
    });

    // 已在学习中的模块，加一层锁定
    if (Store.hasActive(id)) {
      const lock = document.createElement('div');
      lock.className = 'crate__lock';
      lock.innerHTML = `<div><span>正在学习</span>这一单还没结算<br><a href="desk.html">去书桌看看 →</a></div>`;
      c.appendChild(lock);
    }
  });
  syncCards();

  const n = list.length;
  document.getElementById('count').innerHTML =
    `<b>${n}</b> 个模块 · 平均 <b>${Math.round(list.reduce((s, m) => s + m.min, 0) / n)}</b> 分钟一个`;
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

  document.getElementById('bundle').addEventListener('click', () => {
    const pack = ['vocab-basic', 'listening', 'classical'];
    pack.forEach(id => { if (!Store.inCart(id) && !Store.hasActive(id)) Store.toggleCart(id); });
    refreshNav(); renderGrid();
    Drawer.open();
  });
});
