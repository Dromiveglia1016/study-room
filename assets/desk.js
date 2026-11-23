/* ============================================================
   study room · desk page
   ============================================================ */

const DESK_R = 82;
const DESK_C = 2 * Math.PI * DESK_R;

function taskHTML(o) {
  const m = MODULES.find(x => x.id === o.mid) || { name: o.mid, catCn: '', pts: 0, min: 0 };
  return `
  <article class="task" data-id="${o.id}">
    <div class="task__ring">
      <svg viewBox="0 0 186 186">
        <circle class="ring__bg" cx="93" cy="93" r="${DESK_R}"/>
        <circle class="ring__fg" cx="93" cy="93" r="${DESK_R}"
          stroke-dasharray="${DESK_C}" stroke-dashoffset="${DESK_C}" transform="rotate(-90 93 93)"/>
      </svg>
      <div class="task__clock">00:00<small>已学</small></div>
    </div>
    <div class="task__body">
      <h3>${m.name}<span class="cat">${m.catCn}</span></h3>
      <p class="task__target">目标 <b>${m.min} min</b> · 达标 <b>+${m.pts} pts</b> · 每超 10 分钟再 +5</p>
      <dl class="task__nums">
        <div><dt>目标</dt><dd data-k="target">${m.min}min</dd></div>
        <div><dt>已学</dt><dd data-k="spent">00:00</dd></div>
        <div><dt>还差</dt><dd data-k="left">${m.min}:00</dd></div>
        <div><dt>可得</dt><dd data-k="earn">${m.pts}</dd></div>
      </dl>
      <div class="task__bar"><i></i></div>
      <div class="task__acts">
        <button class="btn btn--ink" data-act="toggle" type="button">暂停</button>
        <button class="btn btn--pink" data-act="settle" type="button" disabled>收下积分</button>
        <button class="btn" data-act="drop" type="button">放弃这单</button>
        <span class="task__note">—</span>
      </div>
    </div>
  </article>`;
}

function renderStats() {
  const s = Store.stats();
  document.getElementById('stPts').textContent = s.points;
  document.getElementById('stMin').innerHTML = Math.round(s.minToday) + '<small>min</small>';
  document.getElementById('stStreak').innerHTML = s.streak + '<small>天</small>';
  document.getElementById('headline').textContent = headlineText();
}

function renderTasks() {
  const host = document.getElementById('tasks');
  const list = Store.activeOrders();
  if (!list.length) {
    host.innerHTML = `
      <div class="empty" style="border:2.5px dashed rgba(59,30,18,.3);border-radius:30px;padding:56px 20px">
        <div class="empty__face">0</div>
        <p>桌上没有正在学的模块。<br>去商店下第一单，用 30 分钟换 30 积分。</p>
        <a class="btn btn--ink" href="index.html" style="margin-top:18px">去商店</a>
      </div>`;
    return;
  }
  host.innerHTML = list.map(taskHTML).join('');
  host.querySelectorAll('.task').forEach(card => {
    const id = card.dataset.id;
    card.querySelector('[data-act="toggle"]').addEventListener('click', () => {
      if (Store.isRunning(id)) Store.pause(id); else Store.start(id);
      paint();
    });
    card.querySelector('[data-act="settle"]').addEventListener('click', () => {
      const r = Store.settle(id);
      if (!r) { toast('还没学够，再撑一会儿'); return; }
      toast(`+${r.pts} 积分已入账${r.bonus ? ` · 超额奖励 +${r.bonus}` : ''}`);
      renderStats(); renderTasks(); renderHistory(); refreshNav(); Pop.update();
    });
    card.querySelector('[data-act="drop"]').addEventListener('click', () => {
      if (!confirm('这单不要了？已学的时间不会变成积分。')) return;
      Store.drop(id); renderTasks(); renderStats(); refreshNav(); Pop.update();
    });
  });
  paint();
}

/* 只更新数字，不重建 DOM —— 否则按钮会失焦 */
function paint() {
  document.querySelectorAll('.task').forEach(card => {
    const o = Store.activeOrders().find(x => x.id === card.dataset.id);
    if (!o) return;
    const m = MODULES.find(x => x.id === o.mid) || { min: 1 };
    const cur = Store.elapsed(o);
    const over = cur >= o.target;
    const fg = card.querySelector('.ring__fg');
    const pct = cur / o.target;

    const len = DESK_C;
    fg.setAttribute('stroke-dashoffset', len * (1 - Math.min(1, pct)));

    const clock = card.querySelector('.task__clock');
    clock.innerHTML = over
      ? `+${fmtClock(cur - o.target)}<small>超额</small>`
      : `${fmtClock(cur)}<small>已学</small>`;
    clock.style.color = over ? '#2F6B2A' : '';

    card.classList.toggle('is-reached', over);
    card.querySelector('.task__bar i').style.width = Math.min(100, pct * 100) + '%';

    const q = (k) => card.querySelector(`[data-k="${k}"]`);
    q('spent').textContent = fmtClock(cur);
    q('left').textContent = over ? '达标' : fmtClock(o.target - cur);
    q('left').style.color = over ? '#2F6B2A' : '';
    q('earn').textContent = Math.round(o.target / 60) + Math.floor(Math.max(0, cur - o.target) / 600) * 5;

    const note = card.querySelector('.task__note');
    note.textContent = !o.runningAt
      ? '已暂停'
      : (over ? `够 ${m.min} 分钟了，继续学还算超额分` : `还差 ${fmtClock(o.target - cur)}`);

    const toggle = card.querySelector('[data-act="toggle"]');
    toggle.textContent = o.runningAt ? '暂停' : '继续';

    const settle = card.querySelector('[data-act="settle"]');
    settle.disabled = !over;
    if (over) {
      const bonus = Math.floor((cur - o.target) / 600) * 5;
      settle.textContent = `收下 ${Math.round(o.target / 60) + bonus} 积分`;
    } else {
      settle.textContent = '收下积分';
    }
  });
  document.getElementById('headline').textContent = headlineText();
}

function headlineText() {
  const s = Store.stats();
  if (!s.activeCount) return '没有欠账，去挑一个新模块？';
  const left = Math.round(Store.activeOrders()
    .reduce((a, o) => a + Math.max(0, o.target - Store.elapsed(o)), 0) / 60);
  if (left <= 0) return `${s.activeCount} 单都学够了，去收积分`;
  return `还有 ${s.activeCount} 单没结，欠自己 ${left} 分钟`;
}

function renderHistory() {
  const host = document.getElementById('history');
  const list = Store.history().slice(0, 8);
  if (!list.length) {
    host.innerHTML = `<p style="font-size:13px;color:var(--ink-3);padding:10px 2px">还没有结算记录。第一笔会出现在这里。</p>`;
    return;
  }
  host.innerHTML = list.map(h => `
    <div class="hrow">
      <div>
        <p class="hrow__nm">${h.name}</p>
        <p class="hrow__meta">${h.cat} · 学够 ${fmtMin(h.target)}，实付 ${fmtMin(h.spent)}</p>
      </div>
      <span class="hrow__meta">${hhmm(h.at)}</span>
      <span class="hrow__pts" style="color:#2F6B2A">+${h.pts}</span>
    </div>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  mountNav('desk');
  renderStats();
  renderTasks();
  renderHistory();

  setInterval(paint, 500);

  // 回到页面时补一次（后台标签页计时器会被节流）
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { paint(); renderStats(); } });
});
