/* ============================================================
   study room · store
   时间就是货币：下单 = 承诺一段学习时长
   ============================================================ */

const KEY = 'studyroom.v2';

const Store = (() => {
  const blank = () => ({ v: 2, points: 0, orders: [], history: [], vouchers: [], cart: [] });

  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch (e) { db = blank(); }
  if (!db.orders) db = blank();

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const now = () => Date.now();

  /* ---------- 购物车 ---------- */
  const inCart = (id) => db.cart.includes(id);
  const cart = () => db.cart.map(mid => MODULES.find(m => m.id === mid)).filter(Boolean);

  function toggleCart(id) {
    const i = db.cart.indexOf(id);
    if (i > -1) db.cart.splice(i, 1);
    else if (!hasActive(id)) db.cart.push(id);
    save();
    return inCart(id);
  }
  function clearCart() { db.cart = []; save(); }

  /* ---------- 订单 ---------- */
  const hasActive = (mid) => db.orders.some(o => o.mid === mid && !o.done);
  const activeOrders = () => db.orders.filter(o => !o.done);
  const runningOrder = () => db.orders.find(o => o.runningAt) || null;

  function checkout() {
    const list = cart();
    if (!list.length) return [];
    const made = list.map(m => ({
      id: 'o' + now().toString(36) + Math.random().toString(36).slice(2, 5),
      mid: m.id, target: m.min * 60, accum: 0, runningAt: null,
      done: false, createdAt: now(), settledAt: null, earned: 0
    }));
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
    cart, inCart, toggleCart, clearCart, hasActive,
    activeOrders, runningOrder, checkout,
    elapsed, reached, start, pause, isRunning, settle, drop,
    points, history, vouchers, redeem, stats, save
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
