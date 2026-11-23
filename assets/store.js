/* ============================================================
   study room · store
   时间就是货币：下单 = 承诺一段学习时长
   ============================================================ */

const KEY = 'studyroom.v2';

const Store = (() => {
  const MAX_QTY = 9;
  const blank = () => ({ v: 2, points: 0, orders: [], history: [], vouchers: [], cart: [], updatedAt: 0 });
  const now = () => Date.now();
  const emit = (name, detail) => { try { dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {} };

  /* 老数据、云端数据、其它标签页写进来的数据都从这里过一遍 */
  function normalize(raw) {
    const d = (raw && typeof raw === 'object') ? raw : {};
    return {
      v: 2,
      points: Number.isFinite(+d.points) ? Math.max(0, +d.points) : 0,
      orders: Array.isArray(d.orders) ? d.orders.filter(o => o && o.id && o.mid) : [],
      history: Array.isArray(d.history) ? d.history : [],
      vouchers: Array.isArray(d.vouchers) ? d.vouchers : [],
      // 老数据是字符串数组，统一升级成 { id, qty }
      cart: (Array.isArray(d.cart) ? d.cart : [])
        .map(c => (typeof c === 'string' ? { id: c, qty: 1 } : c))
        .filter(c => c && c.id && MODULES.some(m => m.id === c.id))
        .map(c => ({ id: c.id, qty: Math.min(MAX_QTY, Math.max(1, parseInt(c.qty, 10) || 1)) })),
      updatedAt: Number.isFinite(+d.updatedAt) ? +d.updatedAt : 0
    };
  }

  let db;
  try { db = normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { db = blank(); }

  /* touch = 更新「最后修改时间」；notify = 通知 UI 和云同步 */
  function persist(touch = true, notify = true) {
    if (touch) db.updatedAt = now();
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
    if (notify) {
      emit('store:change', { source: 'local' });
      emit('store:dirty', { source: 'local' });
    }
  }
  const save = () => persist(true, true);
  const snapshot = () => JSON.parse(JSON.stringify(db));
  const mark = (ts) => { db.updatedAt = ts; persist(false, false); };

  /* 云端/别的标签页的数据整包换进来，不再触发上传 */
  function replace(next, source = 'cloud') {
    db = normalize(next);
    persist(false, false);
    emit('store:change', { source });
  }

  /* 同一台设备开两个标签页时，数据保持一致 */
  addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const next = normalize(JSON.parse(e.newValue));
      if (JSON.stringify(next) === JSON.stringify(db)) return;
      db = next;
      emit('store:change', { source: 'storage' });
    } catch (err) {}
  });

  const line = (id) => db.cart.find(c => c.id === id) || null;
  const qty = (id) => { const l = line(id); return l ? l.qty : 0; };
  const inCart = (id) => qty(id) > 0;
  const cart = () => db.cart
    .map(c => { const m = MODULES.find(x => x.id === c.id); return m ? { ...m, qty: c.qty } : null; })
    .filter(Boolean);
  const cartCount = () => db.cart.reduce((s, c) => s + c.qty, 0);

  function add(id, n = 1) {
    if (!MODULES.some(m => m.id === id)) return 0;
    const l = line(id);
    if (l) l.qty = Math.min(MAX_QTY, l.qty + n);
    else db.cart.push({ id, qty: Math.min(MAX_QTY, Math.max(1, n)) });
    save();
    return qty(id);
  }
  function dec(id) {
    const l = line(id);
    if (!l) return 0;
    l.qty -= 1;
    if (l.qty <= 0) db.cart = db.cart.filter(c => c.id !== id);
    save();
    return qty(id);
  }
  function removeItem(id) { db.cart = db.cart.filter(c => c.id !== id); save(); }
  function toggleCart(id) { return inCart(id) ? (dec(id), 0) : add(id); }
  function clearCart() { db.cart = []; save(); }

  /* ---------- 订单 ---------- */
  const hasActive = (mid) => db.orders.some(o => o.mid === mid && !o.done);
  const activeOrders = () => db.orders.filter(o => !o.done);
  const runningOrder = () => db.orders.find(o => o.runningAt) || null;

  function checkout() {
    const list = cart();
    if (!list.length) return [];
    const made = [];
    // 每份都是一个独立的计时单：买两份就背两轮，各自结算
    list.forEach(m => {
      for (let i = 0; i < m.qty; i++) {
        made.push({
          id: 'o' + now().toString(36) + Math.random().toString(36).slice(2, 5),
          mid: m.id, target: m.min * 60, accum: 0, runningAt: null,
          done: false, createdAt: now(), settledAt: null, earned: 0, jumpAsks: 0,
          qty: m.qty, seq: i + 1
        });
      }
    });
    db.orders.push(...made);
    // 只有第一单自动开始计时，其余待命
    made[0].runningAt = now();
    db.cart = [];
    save();
    return made;
  }

  const elapsed = (o) => o.accum + (o.runningAt ? (now() - o.runningAt) / 1000 : 0);
  const reached = (o) => elapsed(o) >= o.target;

  function start(id) {
    const o = db.orders.find(x => x.id === id);
    if (!o || o.done) return;
    db.orders.forEach(x => { if (x.runningAt && x.id !== id) { x.accum += (now() - x.runningAt) / 1000; x.runningAt = null; } });
    if (!o.runningAt) o.runningAt = now();
    save();
  }
  function pause(id) {
    const o = db.orders.find(x => x.id === id);
    if (!o || !o.runningAt) return;
    o.accum += (now() - o.runningAt) / 1000;
    o.runningAt = null;
    save();
  }
  const isRunning = (id) => { const o = db.orders.find(x => x.id === id); return !!(o && o.runningAt); };

  function settle(id) {
    const o = db.orders.find(x => x.id === id);
    if (!o || o.done) return null;
    const spent = elapsed(o);
    if (spent < o.target) return null;
    if (o.runningAt) { o.accum = spent; o.runningAt = null; }
    const base = Math.round(o.target / 60);
    const bonus = Math.floor(Math.max(0, spent - o.target) / 600) * 5;
    o.earned = base + bonus;
    o.done = true;
    o.settledAt = now();
    db.points += o.earned;
    const m = MODULES.find(x => x.id === o.mid) || { name: o.mid, catCn: '' };
    db.history.unshift({ mid: o.mid, name: m.name, cat: m.catCn, target: o.target, spent, pts: o.earned, at: now() });
    save();
    return { pts: o.earned, base, bonus, spent };
  }

  function drop(id) {
    db.orders = db.orders.filter(o => o.id !== id);
    save();
  }

  /* 这一单已经问过几次「要不要看视频」，同一单最多打扰两次 */
  function noteJumpAsk(id) {
    const o = db.orders.find(x => x.id === id);
    if (!o) return 0;
    o.jumpAsks = Math.min(2, (o.jumpAsks || 0) + 1);
    save();
    return o.jumpAsks;
  }

  /* ---------- 积分 / 券 ---------- */
  const points = () => db.points;
  const history = () => db.history;
  const vouchers = () => db.vouchers;

  function redeem(v) {
    if (db.points < v.cost) return false;
    db.points -= v.cost;
    db.vouchers.unshift({ vid: v.id, at: now() });
    save();
    return true;
  }

  /* ---------- 统计 ---------- */
  function stats() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const t0 = today.getTime();
    const doneToday = db.history.filter(h => h.at >= t0);
    const allMinutes = db.history.reduce((s, h) => s + h.spent, 0) / 60;
    const active = db.orders.filter(o => !o.done);
    // 今日学习 = 已结算 + 正在学的（和日历同一口径）
    const liveMin = active.reduce((s, o) => s + elapsed(o) / 60, 0);
    return {
      points: db.points,
      doneToday: doneToday.length,
      minToday: doneToday.reduce((s, h) => s + h.spent, 0) / 60 + liveMin,
      allMinutes,
      activeCount: active.length,
      streak: streakDays()
    };
  }

  function streakDays() {
    if (!db.history.length) return 0;
    const days = new Set(db.history.map(h => new Date(h.at).toDateString()));
    let n = 0; const d = new Date();
    for (;;) {
      if (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return n;
  }

  return {
    cart, cartCount, qty, inCart, add, dec, removeItem, toggleCart, clearCart, hasActive, MAX_QTY,
    activeOrders, runningOrder, checkout,
    elapsed, reached, start, pause, isRunning, settle, drop, noteJumpAsk,
    points, history, vouchers, redeem, stats, save,
    snapshot, replace, mark
  };
})();

/* ---------- 小工具 ---------- */
const fmtClock = (sec) => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
const fmtMin = (sec) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}min`;
};
const hhmm = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
