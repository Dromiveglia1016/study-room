/* ============================================================
   study room · ui  (nav / cart drawer / toast)
   ============================================================ */

const NAV_ITEMS = [
  { id: 'home', href: 'index.html', label: 'home' },
  { id: 'shop', href: 'shop.html', label: 'shop' },
  { id: 'english', href: 'subjects/english/index.html', label: 'english' },
  { id: 'desk', href: 'desk.html', label: 'my desk' },
  { id: 'rewards', href: 'rewards.html', label: 'rewards' }
];

function mountNav(active) {
  const pts = Store.points();
  const n = Store.cartCount();
  const el = document.createElement('nav');
  el.className = 'nav';
  el.innerHTML = `
    <div class="nav__l">
      ${NAV_ITEMS.map(i => `<a class="nav__link ${i.id === active ? 'is-on' : ''}" href="${i.href}">${i.label}</a>`).join('')}
    </div>
    <a class="logo" href="index.html" title="回到主页">study<i>room</i><b>time is money</b></a>
    <div class="nav__r">
      <span class="pts-chip" title="我的积分">
        <svg viewBox="0 0 24 24"><path d="M12 0c.9 7.4 4.6 11.1 12 12-7.4.9-11.1 4.6-12 12-.9-7.4-4.6-11.1-12-12C7.4 11.1 11.1 7.4 12 0Z"/></svg>
        <b id="navPts">${pts}</b>pts
      </span>
      <button class="set-btn" id="setBtn" type="button" aria-label="视频链接设置" title="视频链接">
        <svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1ZM8 13h8v-2H8v2Zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5Z"/></svg>
      </button>
      <button class="cart-btn" id="cartBtn" type="button" aria-label="打开学习清单">
        <svg viewBox="0 0 24 24"><path d="M7 5.5h14l-1.7 9.2a2 2 0 0 1-2 1.6H10a2 2 0 0 1-2-1.6L6.2 3.6H3V1.4h4.6L8 3.6Zm1.2 12.6a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2Zm9.4 0a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2Z"/></svg>
        <span class="cart-btn__dot ${n ? 'on' : ''}" id="cartDot">${n}</span>
      </button>
    </div>`;
  document.body.prepend(el);
  el.querySelector('#cartBtn').addEventListener('click', () => Drawer.open());
  el.querySelector('#setBtn').addEventListener('click', () => Settings.open());

  // 滚动时给 nav 一点收起的呼吸感
  let last = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    el.style.transform = y > last && y > 140 ? 'translateY(-6px)' : '';
    last = y;
  }, { passive: true });
}

addEventListener('store:change', () => refreshNav());

function refreshNav() {
  const p = document.getElementById('navPts');
  const d = document.getElementById('cartDot');
  if (p) p.textContent = Store.points();
  if (d) {
    const n = Store.cartCount();
    d.textContent = n;
    d.classList.toggle('on', n > 0);
  }
}

/* ---------------------------------------------------------------- toast */
let toastTimer;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.style.cssText = `position:fixed;left:50%;bottom:28px;transform:translate(-50%,20px);z-index:120;
      padding:11px 22px;border-radius:999px;background:var(--ink);color:var(--cream);
      font-size:13px;font-weight:500;box-shadow:0 6px 0 rgba(59,30,18,.25);
      opacity:0;transition:.3s cubic-bezier(.16,1,.3,1);pointer-events:none`;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = 1; t.style.transform = 'translate(-50%,0)'; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = 0; t.style.transform = 'translate(-50%,20px)'; }, 1900);
}

/* ---------------------------------------------------------------- drawer */
const Drawer = (() => {
  let root, scrim, body, foot, openState = false;

  function ensure() {
    if (root) return;
    scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.addEventListener('click', close);

    root = document.createElement('aside');
    root.className = 'drawer';
    root.setAttribute('aria-label', '学习清单');
    root.innerHTML = `
      <div class="drawer__head">
        <h3>学习清单</h3>
        <button class="x" type="button" aria-label="关闭">
          <svg viewBox="0 0 24 24"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3Z"/></svg>
        </button>
      </div>
      <div class="drawer__body"></div>
      <div class="drawer__foot"></div>`;
    document.body.append(scrim, root);
    body = root.querySelector('.drawer__body');
    foot = root.querySelector('.drawer__foot');
    root.querySelector('.x').addEventListener('click', close);
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  function render() {
    const list = Store.cart();
    if (!list.length) {
      body.innerHTML = `
        <div class="empty">
          <div class="empty__face">:(</div>
          <p>清单还是空的。<br>挑一个模块，用时间把它买下来。</p>
        </div>`;
      foot.innerHTML = `<a class="btn btn--ink btn--wide" href="shop.html">去挑一个</a>`;
      foot.querySelector('a').addEventListener('click', close);
      return;
    }
    const totalMin = list.reduce((s, m) => s + m.min * m.qty, 0);
    const totalPts = list.reduce((s, m) => s + m.pts * m.qty, 0);
    const totalQty = list.reduce((s, m) => s + m.qty, 0);

    body.innerHTML = list.map(m => `
      <div class="ci" data-id="${m.id}">
        <span class="ci__img"><img src="assets/shop/${m.img}.webp" alt=""></span>
        <div>
          <p class="ci__nm">${m.name}</p>
          <p class="ci__meta">${m.catCn} · ${m.min} min × ${m.qty} · +${m.pts * m.qty} pts</p>
          <div class="ci__qty">
            <button type="button" data-act="dec" aria-label="减一份">−</button>
            <span>${m.qty}</span>
            <button type="button" data-act="inc" aria-label="加一份">+</button>
          </div>
        </div>
        <button class="ci__rm" type="button" aria-label="移除">×</button>
      </div>`).join('');

    foot.innerHTML = `
      <div class="sum"><span>一共 ${totalQty} 份</span><b>${totalMin} min</b></div>
      <div class="sum"><span>结算可得</span><b>${totalPts} pts</b></div>
      <div class="sum sum--big"><span>现在要付的</span><b>${totalMin} 分钟</b></div>
      <button class="btn btn--ink btn--wide" id="payBtn">用时间支付 · 开始学习</button>
      <p style="margin-top:10px;font-size:11.5px;color:var(--ink-3);text-align:center;line-height:1.6">
        钱不收，只收时间。计时达标才算付款成功。
      </p>`;

    body.querySelectorAll('.ci').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('.ci__rm').addEventListener('click', () => {
        Store.removeItem(id);
        render(); refreshNav(); syncCards();
      });
      row.querySelectorAll('[data-act]').forEach(b => {
        b.addEventListener('click', () => {
          if (b.dataset.act === 'inc') {
            if (Store.qty(id) >= Store.MAX_QTY) toast(`一种最多 ${Store.MAX_QTY} 份`);
            else Store.add(id);
          } else {
            Store.dec(id);
          }
          render(); refreshNav(); syncCards();
        });
      });
    });
    foot.querySelector('#payBtn').addEventListener('click', pay);
  }

  function pay() {
    const list = Store.cart();
    const totalMin = list.reduce((s, m) => s + m.min * m.qty, 0);
    body.innerHTML = `
      <div class="paying">
        <div class="paying__ring"></div>
        <p>正在锁定 <b>${totalMin}</b> 分钟…</p>
        <p style="margin-top:8px;font-size:11.5px;color:var(--ink-3)">别切走，马上好</p>
      </div>`;
    foot.innerHTML = '';
    setTimeout(() => {
      const made = Store.checkout();
      // 这单里如果有配视频的模块，把它的 mid 带到书桌页去弹一次
      const pick = made.map(o => MODULES.find(m => m.id === o.mid)).find(m => m && Links.get(m.id));
      if (pick) Jump.markPending(pick.id);

      body.innerHTML = `
        <div class="paying">
          <div class="empty__face" style="background:var(--lime);border-style:solid">✓</div>
          <p style="font-family:var(--f-cn);font-weight:900;font-size:18px;color:var(--ink)">付款成功</p>
          <p style="margin-top:8px">你欠自己 <b>${totalMin}</b> 分钟。<br>计时开始，学够了再来领积分。</p>
          ${pick ? `<p class="paying__tip">《${pick.catCn} · ${pick.name}》配了视频，<br>到书桌会问你要不要打开。</p>` : ''}
        </div>`;
      foot.innerHTML = `<a class="btn btn--ink btn--wide" href="desk.html">去书桌 · 开始计时</a>`;
      refreshNav();
      setTimeout(() => { location.href = 'desk.html'; }, 1400);
    }, 950);
  }

  function open() {
    ensure(); render();
    requestAnimationFrame(() => { scrim.classList.add('on'); root.classList.add('on'); });
    document.body.style.overflow = 'hidden';
    openState = true;
  }
  function close() {
    if (!root) return;
    scrim.classList.remove('on'); root.classList.remove('on');
    document.body.style.overflow = '';
    openState = false;
  }
  return { open, close, render, isOpen: () => openState };
})();

/* 卡片上的 add / 份数与清单同步 */
function syncCards() {
  document.querySelectorAll('.crate').forEach(c => {
    const id = c.dataset.id;
    const add = c.querySelector('.add');
    const box = c.querySelector('.qty');
    if (!add || !box) return;
    const q = Store.qty(id);
    c.classList.toggle('is-in', q > 0);
    add.hidden = q > 0;
    box.hidden = q === 0;
    box.querySelector('b').textContent = q;

    const live = c.querySelector('.crate__live');
    if (Store.hasActive(id) && !live) {
      const tag = document.createElement('span');
      tag.className = 'crate__live';
      tag.textContent = '已经在学';
      c.appendChild(tag);
    } else if (!Store.hasActive(id) && live) {
      live.remove();
    }
  });
}
