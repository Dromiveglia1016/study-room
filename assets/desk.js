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
      <h3>${m.name}<span class="cat">${m.catCn}</span>${o.qty > 1 ? `<span class="cat cat--seq">第 ${o.seq}/${o.qty} 次</span>` : ''}${Links.get(o.mid)
        ? `<a class="task__vid" href="${Links.get(o.mid)}" target="_blank" rel="noopener noreferrer" title="在新标签打开视频">▶ 看视频</a>`
        : ''}</h3>
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

/* 配了视频的模块，在「开始 / 继续」时问一次；同一单最多打扰两次 */
async function askJumpFor(id, title) {
  const o = Store.activeOrders().find(x => x.id === id);
  if (!o) return;
  const m = MODULES.find(x => x.id === o.mid);
  if (!m || !Links.get(m.id)) return;
  if ((o.jumpAsks || 0) >= 2) return;
  Store.noteJumpAsk(id);
  const go = await Jump.ask(m, { title: title || '开始前先看视频？' });
  if (go) {
    // 已经打开过了，就不再问第二遍
    Store.noteJumpAsk(id);
    toast('视频在新标签里 · 这边计时不停');
  }
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
        <a class="btn btn--ink" href="shop.html" style="margin-top:18px">去商店</a>
      </div>`;
    return;
  }
  host.innerHTML = list.map(taskHTML).join('');
  host.querySelectorAll('.task').forEach(card => {
    const id = card.dataset.id;
    card.querySelector('[data-act="toggle"]').addEventListener('click', () => {
      const wasRunning = Store.isRunning(id);
      if (wasRunning) Store.pause(id); else Store.start(id);
      paint();
      if (!wasRunning) askJumpFor(id);
    });
    card.querySelector('[data-act="settle"]').addEventListener('click', () => {
      const r = Store.settle(id);
      if (!r) { toast('还没学够，再撑一会儿'); return; }
      toast(`+${r.pts} 积分已入账${r.bonus ? ` · 超额奖励 +${r.bonus}` : ''}`);
      renderStats(); renderTasks(); renderHistory(); renderCal(); refreshNav(); Pop.update();
    });
    card.querySelector('[data-act="drop"]').addEventListener('click', () => {
      if (!confirm('这单不要了？已学的时间不会变成积分。')) return;
      Store.drop(id); renderTasks(); renderStats(); renderCal(); refreshNav(); Pop.update();
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

/* ============================================================
   学习日历
   ============================================================ */
const CAL = { y: 0, m: 0, sel: '' };
const DKEY = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function dayMap() {
  const map = {};
  const push = (t, item) => {
    const k = DKEY(new Date(t));
    (map[k] = map[k] || { min: 0, items: [] });
    map[k].min += item.min;
    map[k].items.push(item);
  };

  Store.history().forEach(h => push(h.at, {
    name: h.name, cat: h.cat, min: h.spent / 60, pts: h.pts, at: h.at, live: false
  }));

  // 正在学但还没结算的，也算进今天
  Store.activeOrders().forEach(o => {
    const sec = Store.elapsed(o);
    if (sec < 20) return;
    const m = MODULES.find(x => x.id === o.mid) || { name: o.mid, catCn: '' };
    push(Date.now(), {
      name: m.name, cat: m.catCn, min: sec / 60, pts: 0, at: Date.now(), live: true
    });
  });

  Object.values(map).forEach(v => v.items.sort((a, b) => b.at - a.at));
  return map;
}

function monthSummary(map) {
  let days = 0, min = 0, best = 0, bestDay = 0;
  Object.keys(map).forEach(k => {
    const [yy, mm, dd] = k.split('-').map(Number);
    if (yy !== CAL.y || mm !== CAL.m) return;
    days++;
    min += map[k].min;
    if (map[k].min > best) { best = map[k].min; bestDay = dd; }
  });
  return { days, min, best, bestDay };
}

function renderMonth(map) {
  const host = document.getElementById('calMonth');
  if (!host) return;
  const { days, min, best, bestDay } = monthSummary(map);
  host.innerHTML = `
    <h3>本月学习</h3>
    <dl class="cal__mstats">
      <div><dt>打卡</dt><dd>${days} 天</dd></div>
      <div><dt>累计</dt><dd>${fmtMin(min * 60)}</dd></div>
    </dl>
    <p class="cal__mbest">${best ? `最长一天 ${fmtMin(best * 60)} · ${bestDay} 日` : '这个月还没有记录'}</p>`;
}

function renderDay(key, map) {
  const host = document.getElementById('calDetail');
  if (!host) return;
  const db = map || dayMap();
  const rec = db[key];
  const [yy, mm, dd] = key.split('-').map(Number);
  const wd = '日一二三四五六'[new Date(yy, mm, dd).getDay()];
  const head = `${mm + 1} 月 ${dd} 日 · 周${wd}`;

  if (!rec || !rec.items.length) {
    host.innerHTML = `
      <p class="cal__d">${head}</p>
      <p class="cal__empty">这天没有学习记录。<br>空一天也没关系，明天再来。</p>`;
    return;
  }

  host.innerHTML = `
    <p class="cal__d">${head}</p>
    <p class="cal__min">${Math.round(rec.min)}<small>min</small></p>
    <ul class="cal__list">
      ${rec.items.map(it => `
        <li class="cal__item">
          <b>${it.name}</b>
          <em class="${it.live ? 'is-live' : ''}">${it.live ? '计时中' : '+' + it.pts}</em>
          <i>${it.cat || '学习'} · ${Math.round(it.min)} min</i>
        </li>`).join('')}
    </ul>`;
}

function renderCal() {
  const grid = document.getElementById('calGrid');
  if (!grid) return;

  const map = dayMap();
  const { y, m } = CAL;
  const start = (new Date(y, m, 1).getDay() + 6) % 7;   // 周一开头
  const total = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((start + total) / 7) * 7;

  const now = new Date();
  const todayK = DKEY(now);
  document.getElementById('calLabel').textContent = `${y} 年 ${m + 1} 月`;

  const next = document.getElementById('calNext');
  if (next) next.disabled = (y > now.getFullYear()) || (y === now.getFullYear() && m >= now.getMonth());

  let html = '';
  for (let i = 0; i < cells; i++) {
    const dnum = i - start + 1;
    const out = dnum < 1 || dnum > total;
    const d = new Date(y, m, dnum);
    const k = DKEY(d);
    const rec = map[k];
    const min = rec ? rec.min : 0;
    const lv = min >= 90 ? ' lv3' : (min >= 45 ? ' lv2' : '');
    const cls = ['day'];
    if (out) cls.push('is-out');
    else {
      if (rec) cls.push('has' + lv);
      if (k === todayK) cls.push('is-today');
      if (k === CAL.sel) cls.push('is-on');
      if (d > now) cls.push('is-future');
      if (rec && !rec.items.some(x => x.live) && d > now) cls.push('is-future');
    }
    const lab = min >= 60
      ? `${Math.floor(min / 60)}h${Math.round(min % 60) || ''}`
      : (min > 0 ? `${Math.round(min)}m` : '');
    html += `<button type="button" class="${cls.join(' ')}"${out
      ? ' disabled tabindex="-1"'
      : ` data-k="${k}" data-d="${dnum}"`}>
      <b>${d.getDate()}</b>${!out && lab ? `<small>${lab}</small>` : ''}
    </button>`;
  }

  grid.innerHTML = html;
  grid.querySelectorAll('.day[data-k]').forEach(b => {
    b.addEventListener('click', () => {
      CAL.sel = b.dataset.k;
      grid.querySelectorAll('.day').forEach(x => x.classList.remove('is-on'));
      b.classList.add('is-on');
      renderDay(b.dataset.k, map);
    });
  });

  // 选中日不在当前月时，回落到今天 / 月初
  if (!CAL.sel.startsWith(`${y}-${m}-`)) {
    CAL.sel = (y === now.getFullYear() && m === now.getMonth())
      ? todayK : DKEY(new Date(y, m, 1));
    renderCal();
    return;
  }
  renderDay(CAL.sel, map);
  renderMonth(map);
}

function shiftMonth(n) {
  const d = new Date(CAL.y, CAL.m + n, 1);
  CAL.y = d.getFullYear();
  CAL.m = d.getMonth();
  renderCal();
}

function initCal() {
  const t = new Date();
  CAL.y = t.getFullYear();
  CAL.m = t.getMonth();
  CAL.sel = DKEY(t);
  document.getElementById('calPrev').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('calNext').addEventListener('click', () => shiftMonth(1));
  renderCal();
}

document.addEventListener('DOMContentLoaded', () => {
  mountNav('desk');
  renderStats();
  renderTasks();
  renderHistory();
  initCal();

  // 刚从商店付款过来：问一次要不要打开视频
  const pend = Jump.takePending();
  if (pend) {
    const o = Store.activeOrders().find(x => x.mid === pend);
    if (o) setTimeout(() => askJumpFor(o.id, '视频现在打开吗？'), 650);
  }

  setInterval(paint, 500);
  // 日历里“今天”的进行中时长，每 30 秒补一次
  setInterval(() => {
    if (CAL.y === new Date().getFullYear() && CAL.m === new Date().getMonth()) renderCal();
  }, 30000);

  // 回到页面时补一次（后台标签页计时器会被节流）
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { paint(); renderStats(); } });

  // 设置面板里改了视频链接，任务卡上的「看视频」跟着变
  addEventListener('links:change', () => { renderTasks(); renderStats(); });

  // 云端/别的标签页把数据换掉时，整页重画
  addEventListener('store:change', e => {
    if (e.detail && e.detail.source === 'local') return;
    renderStats();
    renderTasks();
    renderHistory();
    renderCal();
    paint();
    refreshNav();
  });
});
