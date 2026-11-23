/* ============================================================
   study room · rewards page
   ============================================================ */

function renderBalance() {
  document.getElementById('bal').textContent = Store.points();
  const own = Store.vouchers().length;
  document.getElementById('balSub').textContent = own
    ? `已经兑了 ${own} 张券，记得用掉`
    : '攒够了就兑，别只学不玩';
}

function renderTickets() {
  const host = document.getElementById('tickets');
  const pts = Store.points();
  const owned = new Set(Store.vouchers().map(v => v.vid));

  host.innerHTML = VOUCHERS.map(v => {
    const isOwned = owned.has(v.id);
    const can = pts >= v.cost;
    return `
    <article class="ticket ${isOwned ? 'is-owned' : ''}" data-id="${v.id}">
      <div class="ticket__l">
        <p class="ticket__en">${v.en}</p>
        <h3 class="ticket__nm">${v.name}</h3>
        <p class="ticket__desc">${v.desc}</p>
      </div>
      <div class="ticket__r">
        <div class="ticket__cost">${v.cost}<small>积分</small></div>
        <button class="ticket__btn" type="button" ${(!can || isOwned) ? 'disabled' : ''}>
          ${isOwned ? '已兑' : (can ? '兑换' : '差 ' + (v.cost - pts))}
        </button>
      </div>
    </article>`;
  }).join('');

  host.querySelectorAll('.ticket').forEach(t => {
    const btn = t.querySelector('.ticket__btn');
    btn.addEventListener('click', () => {
      const v = VOUCHERS.find(x => x.id === t.dataset.id);
      if (!Store.redeem(v)) return;
      toast(`兑换成功 · ${v.name}`);
      renderBalance(); renderTickets(); refreshNav(); renderWallet();
    });
  });
}

function renderWallet() {
  const host = document.getElementById('wallet');
  const list = Store.vouchers();
  if (!list.length) {
    host.innerHTML = `<p style="font-size:13px;color:var(--ink-3)">还没有券。学够了再来兑。</p>`;
    return;
  }
  host.innerHTML = list.map(w => {
    const v = VOUCHERS.find(x => x.id === w.vid) || { name: w.vid, cost: 0 };
    const d = new Date(w.at);
    return `<span class="wchip"><b>${v.name}</b><i>${d.getMonth() + 1}/${d.getDate()} 兑</i></span>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  mountNav('rewards');
  renderBalance();
  renderTickets();
  renderWallet();

  addEventListener('store:change', e => {
    if (e.detail && e.detail.source === 'local') return;
    renderBalance();
    renderTickets();
    renderWallet();
    refreshNav();
  });
});
