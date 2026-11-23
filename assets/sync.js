/* ============================================================
   study room · cloud sync
   同步码就是钥匙：PBKDF2 派生密钥 → AES-GCM 加密整包数据
   → 只把密文交给 Cloudflare Worker，云端看不到积分和订单。
   本机始终是主副本，断网照常用，联网后自动补传。
   ============================================================ */

const Sync = (() => {
  const CFG = 'studyroom.sync';
  const META = 'studyroom.sync.meta';
  const SALT = new TextEncoder().encode('studyroom-sync-v1');
  const ITER = 120000;
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  /* ---------------------------------------------------------- 小工具 */
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const cleanCode = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const prettyCode = (s) => (cleanCode(s).match(/.{1,5}/g) || []).join('-');

  const toB64 = (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const fromB64 = (str) => {
    const bin = atob(str), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  };

  function makeCode() {
    const r = crypto.getRandomValues(new Uint8Array(20));
    return [...r].map(b => ALPHABET[b % ALPHABET.length]).join('');
  }

  async function hashCode(code) {
    const buf = await crypto.subtle.digest('SHA-256', enc.encode('studyroom:' + code));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  let keyCache = { code: '', key: null };
  async function deriveKey(code) {
    if (keyCache.code === code && keyCache.key) return keyCache.key;
    const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: SALT, iterations: ITER, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
    keyCache = { code, key };
    return key;
  }

  async function seal(doc, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(doc)));
    const all = new Uint8Array(iv.length + buf.byteLength);
    all.set(iv, 0);
    all.set(new Uint8Array(buf), iv.length);
    return toB64(all);
  }
  async function unseal(blob, key) {
    try {
      const all = fromB64(blob);
      const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12));
      return JSON.parse(dec.decode(buf));
    } catch (e) { return null; }
  }

  /* -------------------------------------- 免注册搬运：整包压成一段文字 */
  const BAK = 'studyroom.v2.bak';
  const b64u = (u8) => toB64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => {
    let t = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    return fromB64(t);
  };

  /* SR1. 开头 = deflate 压缩过；SR0. = 没压缩（老浏览器兜底） */
  async function pack() {
    const doc = { v: 1, t: Date.now(), db: Store.snapshot() };
    const raw = enc.encode(JSON.stringify(doc));
    let body = raw, tag = 'SR0.';
    if (typeof CompressionStream === 'function') {
      try {
        const cs = new CompressionStream('deflate-raw');
        const w = cs.writable.getWriter();
        const out = new Response(cs.readable).arrayBuffer();
        w.write(raw).catch(() => {});
        w.close().catch(() => {});
        body = new Uint8Array(await out);
        tag = 'SR1.';
      } catch (e) { /* 压缩失败就发原文，顶多长一点 */ }
    }
    return tag + b64u(body);
  }

  async function unpack(str) {
    const s = String(str || '').replace(/\s+/g, '');
    const m = s.match(/^SR([01])\.([A-Za-z0-9\-_]+)$/i);
    if (!m) throw new Error('这串不是学习数据，确认整段都复制了');
    let bytes = unb64u(m[2]);
    if (m[1] === '1') {
      if (typeof DecompressionStream !== 'function') throw new Error('这台设备的浏览器太旧，换个新的再来');
      try {
        const ds = new DecompressionStream('deflate-raw');
        const w = ds.writable.getWriter();
        const out = new Response(ds.readable).arrayBuffer();
        w.write(bytes).catch(() => {});
        w.close().catch(() => {});
        bytes = new Uint8Array(await out);
      } catch (e) { throw new Error('这串数据不完整，重新复制一次'); }
    }
    let doc;
    try { doc = JSON.parse(dec.decode(bytes)); } catch (e) { throw new Error('这串数据不完整，重新复制一次'); }
    if (!doc || !doc.db || typeof doc.db !== 'object') throw new Error('这串数据里没有学习记录');
    return doc;
  }

  const sizeTxt = (s) => {
    const n = new Blob([s]).size;
    return n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';
  };

  /* ---------------------------------------------------------- 状态 */
  let cfg = null, meta = null;
  let hash = '', key = null, rev = -1, lastSync = 0, dirty = false, busy = false;
  let status = 'off', errMsg = '', pushTimer = null;

  function load() {
    const c = read(CFG);
    cfg = (c && c.url && c.code) ? { url: String(c.url).trim().replace(/\/+$/, ''), code: cleanCode(c.code) } : null;
    meta = read(META) || {};
    lastSync = +meta.lastSync || 0;
    status = cfg ? 'idle' : 'off';
    const device = meta.device || (Math.random().toString(36).slice(2, 8));
    meta.device = device;
    write(META, meta);
    return device;
  }
  const device = load();

  const setStatus = (s, msg = '') => { status = s; errMsg = msg; paintState(); };

  /* ---------------------------------------------------------- 网络 */
  async function api(method, body) {
    const url = cfg.url + '/sync?k=' + hash;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, {
        method,
        mode: 'cors',
        cache: 'no-store',
        signal: ctrl.signal,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 409) return { conflict: true, ...data };
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return data;
    } finally { clearTimeout(to); }
  }

  function markSynced(newRev) {
    rev = newRev;
    dirty = false;
    lastSync = Date.now();
    meta.lastSync = lastSync;
    write(META, meta);
    setStatus('ok');
  }

  /* 核心：拉一次云端，比较后决定覆盖本机还是上传本机 */
  async function syncNow(opt = {}) {
    if (!cfg || busy) return;
    if (!crypto.subtle) { setStatus('error', '需要 HTTPS 页面才能加密'); return; }
    if (!navigator.onLine) { setStatus('offline'); return; }

    busy = true;
    paintState();
    try {
      if (!key || keyCache.code !== cfg.code) {
        hash = await hashCode(cfg.code);
        key = await deriveKey(cfg.code);
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await api('GET');
        const cloudDoc = remote.blob ? await unseal(remote.blob, key) : null;
        if (remote.blob && !cloudDoc) {
          setStatus('error', '同步码不对，云端数据解不开');
          return;
        }
        const local = Store.snapshot();
        const localT = +local.updatedAt || 0;
        const cloudT = cloudDoc ? (+cloudDoc.updatedAt || +remote.updatedAt || 0) : 0;
        // 别的设备有更新的数据 → 以云端为准
        if (cloudDoc && cloudT > localT && !opt.forceLocal) {
          Store.replace(Object.assign({}, cloudDoc.db, { updatedAt: cloudT }), 'cloud');
          markSynced(+remote.rev);
          notify('云端有更新 · ' + Store.points() + ' pts');
          return;
        }
        // 两边一致：只记住版本号，不重复上传（省下每天 1000 次写入）
        if (cloudDoc && cloudT === localT && !dirty && !opt.force && !opt.forceLocal) {
          rev = +remote.rev;
          setStatus('ok');
          return;
        }

        // 上传本机（云端为空 / 本机更新 / 手动强制）
        const ts = Date.now();
        Store.mark(ts);
        const doc = { v: 1, updatedAt: ts, device, db: Store.snapshot() };
        const blob = await seal(doc, key);
        const res = await api('PUT', { baseRev: +remote.rev || 0, updatedAt: ts, blob });
        if (res.conflict) continue;           // 有人抢先写了，重来一次
        markSynced(+res.rev);
        if (opt.force) notify('同步好了');
        return;
      }
      setStatus('error', '两台设备同时改了，稍后再试');
    } catch (e) {
      let msg = e && e.message ? e.message : '网络出错';
      if (e && e.name === 'AbortError') msg = '连接超时，检查 Worker 地址';
      else if (e instanceof TypeError) msg = '连不上 Worker，检查地址或是否已部署';
      else if (/^HTTP 404/.test(msg)) msg = '地址不对（404），确认填的是 Worker 网址';
      else if (/^HTTP 5/.test(msg)) msg = 'Worker 内部出错（' + msg + '），看下它的日志';
      setStatus('error', msg);
    } finally {
      busy = false;
      paintState();
    }
  }

  function schedulePush() {
    dirty = true;
    clearTimeout(pushTimer);
    const wait = Math.max(2200, 9000 - (Date.now() - lastSync));
    pushTimer = setTimeout(() => syncNow(), wait);
  }

  /* ---------------------------------------------------------- 界面 */
  let fab, scrim, panel;

  const CSS = `
.sy__fab{position:fixed;left:18px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:86;
  width:46px;height:46px;border-radius:50%;background:#fffdf7;border:2px solid #2b1b12;
  box-shadow:0 4px 0 rgba(43,27,18,.22);display:grid;place-items:center;cursor:pointer;
  padding:0;transition:transform .2s cubic-bezier(.16,1,.3,1)}
.sy__fab:hover{transform:translateY(-3px)}
.sy__fab:focus-visible{outline:3px solid #2f74f2;outline-offset:3px}
.sy__fab svg{width:22px;height:22px;fill:none;stroke:#2b1b12;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.sy__fab.is-busy svg{animation:sy__pulse 1s ease-in-out infinite}
@keyframes sy__pulse{50%{opacity:.3}}
/* 连上之后缩成安静的小圆点，不挡内容 */
.sy__fab.is-quiet{width:36px;height:36px;opacity:.55;box-shadow:0 3px 0 rgba(43,27,18,.16)}
.sy__fab.is-quiet svg{width:17px;height:17px}
.sy__fab.is-quiet .sy__dot{width:9px;height:9px;right:-2px;top:-2px}
.sy__fab.is-quiet:hover{width:46px;height:46px;opacity:1;box-shadow:0 4px 0 rgba(43,27,18,.22)}
.sy__fab.is-quiet:hover svg{width:22px;height:22px}
.sy__dot{position:absolute;right:-3px;top:-3px;width:13px;height:13px;border-radius:50%;
  background:#cfc7b8;border:2px solid #fffdf7;transition:background .2s}
.sy__fab.is-on .sy__dot{background:#5ab552}
.sy__fab.is-bad .sy__dot{background:#f1662a}
.sy__scrim{position:fixed;inset:0;z-index:140;background:rgba(43,27,18,.34);backdrop-filter:blur(2px);
  opacity:0;visibility:hidden;transition:.25s}
.sy__scrim.on{opacity:1;visibility:visible}
.sy__panel{position:fixed;z-index:141;left:50%;top:50%;
  transform:translate(-50%,-46%) scale(.97);width:min(92vw,486px);max-height:min(88vh,760px);
  overflow:auto;background:#fffdf7;border:2px solid #2b1b12;border-radius:20px;
  box-shadow:0 12px 0 rgba(43,27,18,.2);padding:26px 24px 22px;
  opacity:0;visibility:hidden;transition:.25s cubic-bezier(.16,1,.3,1);
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#2b1b12}
.sy__panel.on{opacity:1;visibility:visible;transform:translate(-50%,-50%) scale(1)}
.sy__x{position:absolute;right:16px;top:16px;width:30px;height:30px;border:1.5px solid #2b1b12;
  border-radius:50%;background:#fff;cursor:pointer;display:grid;place-items:center;line-height:1;font-size:17px}
.sy__kick{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:800;letter-spacing:.18em;
  text-transform:uppercase;color:#8a7c6c;margin:0 0 6px}
.sy__kick i{width:7px;height:7px;border-radius:50%;background:#f1662a;display:inline-block}
.sy__panel h3{margin:0;font-size:24px;font-weight:900;letter-spacing:-.03em}
.sy__sub{font-size:12.5px;line-height:1.75;color:#6d5f50;margin:9px 0 16px}
.sy__state{display:flex;align-items:center;gap:9px;padding:10px 13px;border-radius:12px;
  background:#f6efe2;border:1.5px solid rgba(43,27,18,.14);font-size:12.5px;font-weight:600;margin-bottom:16px}
.sy__state i{width:9px;height:9px;border-radius:50%;background:#cfc7b8;flex:none}
.sy__state.is-ok i{background:#5ab552}
.sy__state.is-bad i{background:#f1662a}
.sy__state span{color:#8a7c6c;font-weight:400;font-size:11px;margin-left:auto}
.sy__lbl{display:block;font-size:11.5px;font-weight:800;letter-spacing:.04em;margin:14px 0 6px}
.sy__inp{width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1.5px solid #2b1b12;
  border-radius:10px;background:#fff;font-size:13px;color:#2b1b12;font-family:inherit;outline:none}
.sy__inp:focus{box-shadow:0 0 0 3px rgba(47,116,242,.18)}
.sy__inp::placeholder{color:#b3a89a}
.sy__code{display:flex;gap:6px}
.sy__code .sy__inp{letter-spacing:.12em;font-weight:700;flex:1;min-width:0}
.sy__mini{height:40px;padding:0 11px;border:1.5px solid #2b1b12;border-radius:10px;background:#fff;
  font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit}
.sy__mini:hover{background:#ffe7a3}
.sy__hint{font-size:11px;line-height:1.65;color:#8a7c6c;margin:8px 0 0}
.sy__acts{display:flex;gap:8px;margin-top:18px}
.sy__btn{flex:1;height:42px;border:2px solid #2b1b12;border-radius:999px;cursor:pointer;
  font-size:13px;font-weight:800;font-family:inherit;transition:transform .15s,box-shadow .15s}
.sy__btn:hover{transform:translateY(-2px);box-shadow:0 4px 0 #2b1b12}
.sy__primary{background:#2f74f2;color:#fff;box-shadow:0 4px 0 #2b1b12}
.sy__ghost{background:#fff;color:#2b1b12;box-shadow:0 4px 0 #2b1b12}
.sy__row2{display:flex;justify-content:space-between;gap:10px;margin-top:14px}
.sy__row2[hidden]{display:none}
.sy__link{background:none;border:0;padding:0;font-size:11.5px;color:#8a7c6c;text-decoration:underline;
  text-underline-offset:3px;cursor:pointer;font-family:inherit}
.sy__link:hover{color:#f1662a}
.sy__note{margin-top:18px;padding:13px;border-radius:12px;background:#f6efe2;
  font-size:11px;line-height:1.8;color:#6d5f50}
.sy__note b{color:#2b1b12}
.sy__toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,16px);z-index:160;
  padding:10px 20px;border-radius:999px;background:#2b1b12;color:#fffdf7;font-size:12.5px;
  font-weight:600;opacity:0;pointer-events:none;transition:.3s cubic-bezier(.16,1,.3,1);
  max-width:min(86vw,420px);text-align:center;line-height:1.5;
  box-shadow:0 6px 0 rgba(43,27,18,.22)}
.sy__toast.on{opacity:1;transform:translate(-50%,0)}
/* 免注册 · 打包搬运 */
.sy__sec{display:flex;align-items:center;gap:7px;margin:20px 0 10px;font-size:10.5px;
  font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a7c6c}
.sy__sec::after{content:"";flex:1;height:1px;background:rgba(43,27,18,.13)}
.sy__sec b{color:#f1662a;letter-spacing:0}
.sy__pack{padding:14px;border:1.5px dashed rgba(43,27,18,.32);border-radius:14px;background:#fff}
.sy__pack>p{margin:0 0 11px;font-size:12px;line-height:1.7;color:#6d5f50}
.sy__pack>p b{color:#2b1b12}
.sy__packacts{display:flex;gap:8px;flex-wrap:wrap}
.sy__packacts .sy__mini{flex:1;min-width:132px}
.sy__ta{width:100%;box-sizing:border-box;height:74px;resize:vertical;padding:9px 11px;margin-top:10px;
  border:1.5px solid #2b1b12;border-radius:10px;background:#fdfaf3;color:#2b1b12;outline:none;
  font-size:11px;line-height:1.55;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.sy__ta:focus{box-shadow:0 0 0 3px rgba(47,116,242,.18)}
.sy__ta::placeholder{color:#b3a89a;font-family:inherit;word-break:normal}
.sy__meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:7px;font-size:10.5px;color:#8a7c6c}
.sy__meta .sy__link[hidden]{display:none}
/* 进阶：折叠起来，不吵人 */
.sy__adv{margin-top:20px;padding-top:14px;border-top:1.5px solid rgba(43,27,18,.12)}
.sy__adv>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;
  font-size:12px;font-weight:800;color:#2b1b12}
.sy__adv>summary::-webkit-details-marker{display:none}
.sy__adv>summary::before{content:"+";display:grid;place-items:center;width:17px;height:17px;flex:none;
  border-radius:50%;background:#ffe7a3;font-size:12px;font-weight:900;line-height:1}
.sy__adv[open]>summary::before{content:"−"}
.sy__adv>summary:focus-visible{outline:3px solid #2f74f2;outline-offset:3px;border-radius:6px}
@media (max-width:520px){
  .sy__panel{padding:22px 18px 18px;width:calc(100vw - 24px)}
  .sy__fab{left:12px;width:42px;height:42px}
  .sy__fab.is-quiet{width:36px;height:36px}
  .sy__acts{flex-wrap:wrap}
  .sy__btn{min-width:calc(50% - 4px)}
  /* 同步码单独占一行，免得被两个按钮挤到看不全 */
  .sy__code{flex-wrap:wrap}
  .sy__code .sy__inp{flex:1 1 100%;letter-spacing:.06em}
  .sy__mini{flex:1;height:36px}
  .sy__packacts .sy__mini{flex:1 1 0;min-width:0;padding:0 4px;font-size:11.5px}
  .sy__ta{height:88px;font-size:10.5px}
}
`;

  function ensure() {
    if (panel) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'sy__fab';
    fab.setAttribute('aria-label', '云同步设置');
    fab.title = '云同步 · 积分跨设备互通';
    fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6.5 18a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.4A3.7 3.7 0 0 1 17.5 18H6.5Z"/><path d="M12 11v6m0 0-2.2-2.2M12 17l2.2-2.2"/></svg><i class="sy__dot"></i>`;
    fab.addEventListener('click', open);
    document.body.appendChild(fab);

    scrim = document.createElement('div');
    scrim.className = 'sy__scrim';
    scrim.addEventListener('click', close);
    panel = document.createElement('div');
    panel.className = 'sy__panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', '云同步设置');
    document.body.append(scrim, panel);
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    paintState();
  }

  function ago(ts) {
    if (!ts) return '还没同步过';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    return Math.floor(s / 86400) + ' 天前';
  }

  function paintState() {
    if (!fab) return;
    fab.classList.toggle('is-on', !!cfg && (status === 'ok' || status === 'idle'));
    fab.classList.toggle('is-bad', status === 'error' || status === 'offline');
    fab.classList.toggle('is-busy', busy);
    fab.classList.toggle('is-quiet', status === 'ok' && !busy);
    fab.title = !cfg ? '云同步 · 积分跨设备互通'
      : (status === 'ok' ? '云同步 · 已连接 · ' + ago(lastSync) : '云同步 · 点击查看状态');
    if (!panel) return;
    const box = panel.querySelector('.sy__state');
    if (box) {
      const map = {
        off: ['自动同步没开 · 数据只在本机', ''],
        idle: ['已连接 · 等待第一次同步', cfg ? ago(lastSync) : ''],
        ok: ['已同步 · ' + Store.points() + ' pts', ago(lastSync)],
        offline: ['离线中 · 本机照常用，联网后自动补', ago(lastSync)],
        error: ['连不上：' + (errMsg || '未知错误'), ago(lastSync)],
        busy: ['正在同步…', ago(lastSync)]
      };
      const [txt, sub] = map[busy ? 'busy' : status] || map.off;
      box.className = 'sy__state' + (status === 'ok' ? ' is-ok' : (status === 'error' || status === 'offline' ? ' is-bad' : ''));
      box.innerHTML = `<i></i><span style="margin:0;color:inherit;font-size:12.5px">${txt}</span>${sub ? `<span>${sub}</span>` : ''}`;
    }
  }

  function notify(msg) {
    let t = document.querySelector('.sy__toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'sy__toast';
      document.body.appendChild(t);
      t._timer = null;
    }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('on'), 2100);
  }

  function open() {
    ensure();
    panel.innerHTML = `
      <button class="sy__x" type="button" aria-label="关掉">×</button>
      <p class="sy__kick"><i></i>cloud sync</p>
      <h3>积分跨设备同步</h3>
      <p class="sy__sub">换设备、换浏览器，积分和订单都能带走。先试 ① 这一招，不用注册。</p>
      <div class="sy__state"></div>

      <p class="sy__sec"><b>①</b>打包带走 · 不用注册</p>
      <div class="sy__pack">
        <p>点<b>「复制本机数据」</b>，把这串发到微信「文件传输助手」；在另一台设备打开本站，粘进来点<b>「粘贴恢复」</b>。</p>
        <div class="sy__packacts">
          <button class="sy__mini" type="button" id="syPack">复制本机数据</button>
          <button class="sy__mini" type="button" id="syUnpack">粘贴恢复</button>
        </div>
        <textarea class="sy__ta" id="syText" spellcheck="false" autocomplete="off"
          placeholder="点上面的「复制本机数据」生成一串，或把另一台设备那串粘到这里"></textarea>
        <div class="sy__meta">
          <span id="sySize">还没生成</span>
          <button class="sy__link" type="button" id="syUndo" hidden>撤销上次恢复</button>
        </div>
      </div>

      <details class="sy__adv" ${cfg ? 'open' : ''}>
        <summary>② 自动同步 · 要部署一次（选做）</summary>
        <p class="sy__hint" style="margin-top:11px">上面那招够用就不用管这里。部署完一次之后，两台设备打开就自动对齐，不用再复制粘贴。</p>

        <label class="sy__lbl" for="syUrl">Worker 地址</label>
        <input class="sy__inp" id="syUrl" type="url" spellcheck="false" autocomplete="off"
          placeholder="https://xxxx.workers.dev">

        <label class="sy__lbl" for="syCode">同步码</label>
        <div class="sy__code">
          <input class="sy__inp" id="syCode" type="text" spellcheck="false" autocomplete="off" placeholder="XXXXX-XXXXX-XXXXX-XXXXX">
          <button class="sy__mini" type="button" id="syGen">生成</button>
          <button class="sy__mini" type="button" id="syCopy">复制</button>
        </div>
        <p class="sy__hint">同步码就是钥匙，别发给别人。两台设备填同一个码。</p>

        <div class="sy__acts">
          <button class="sy__btn sy__primary" type="button" id="syConnect">连接并同步</button>
          <button class="sy__btn sy__ghost" type="button" id="syNow">立即同步</button>
        </div>
        <div class="sy__row2" ${cfg ? '' : 'hidden'}>
          <button class="sy__link" type="button" id="syForce">用本机覆盖云端</button>
          <button class="sy__link" type="button" id="syOff">断开同步</button>
        </div>
      </details>

      <div class="sy__note">
        <b>带得走</b>　积分 · 计时订单 · 学时记录 · 兑换券 · 学习清单<br>
        <b>带不走</b>　视频链接（每台设备自己填）<br>
        打包时会压缩，用一年也只有几 KB；恢复前自动备份，点错了能撤销。同一时刻最好只在一台设备上计时。
      </div>`;

    const $ = (id) => panel.querySelector('#' + id);
    $('syUrl').value = cfg ? cfg.url : '';
    $('syCode').value = cfg ? prettyCode(cfg.code) : '';

    /* ---- 打包带走 ---- */
    const bakFresh = () => {
      try {
        const b = JSON.parse(localStorage.getItem(BAK));
        return !!(b && b.db && b.at && Date.now() - b.at < 86400000);
      } catch (e) { return false; }
    };
    if (bakFresh()) $('syUndo').hidden = false;

    $('syPack').addEventListener('click', async () => {
      const btn = $('syPack');
      btn.disabled = true;
      btn.textContent = '打包中…';
      try {
        const s = await pack();
        $('syText').value = s;
        $('sySize').textContent = '已生成 ' + sizeTxt(s) + ' · 发给自己就行';
        try {
          await navigator.clipboard.writeText(s);
          notify('已复制到剪贴板，去粘给另一台设备');
        } catch (e) {
          $('syText').focus();
          $('syText').select();
          notify('已生成，按 Ctrl/Cmd + C 复制');
        }
      } catch (e) {
        notify('打包失败：' + (e && e.message ? e.message : '未知错误'));
      } finally {
        btn.disabled = false;
        btn.textContent = '复制本机数据';
      }
    });

    $('syUnpack').addEventListener('click', async () => {
      let s = $('syText').value.trim();
      if (!s) {
        try {
          const clip = await navigator.clipboard.readText();
          if (clip && /^SR[01]\./i.test(clip.trim())) { s = clip.trim(); $('syText').value = s; }
        } catch (e) { /* 没给剪贴板权限就算了 */ }
      }
      if (!s) return notify('先把另一台设备那串粘到框里');

      let doc;
      try { doc = await unpack(s); }
      catch (e) { return notify(e && e.message ? e.message : '这串数据看不懂'); }

      const cur = Store.snapshot();
      const inc = doc.db;
      const when = doc.t ? new Date(doc.t).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未知时间';
      const nOrders = Array.isArray(inc.orders) ? inc.orders.length : 0;
      const ok = confirm(
        '本机现在：' + cur.points + ' pts · ' + cur.orders.length + ' 个订单\n' +
        '要恢复的：' + (inc.points || 0) + ' pts · ' + nOrders + ' 个订单\n' +
        '（打于 ' + when + '）\n\n' +
        '恢复会用这份数据覆盖本机。覆盖前自动备份，点错了能撤销。继续？'
      );
      if (!ok) return;

      try { localStorage.setItem(BAK, JSON.stringify({ at: Date.now(), db: cur })); } catch (e) {}
      Store.replace(inc, 'import');
      Store.mark(Date.now());
      dispatchEvent(new CustomEvent('store:dirty', { detail: { source: 'import' } }));
      $('syUndo').hidden = false;
      $('sySize').textContent = '已恢复 · ' + Store.points() + ' pts';
      paintState();
      notify('恢复好了 · ' + Store.points() + ' pts · ' + Store.snapshot().orders.length + ' 个订单');
    });

    $('syUndo').addEventListener('click', () => {
      let b = null;
      try { b = JSON.parse(localStorage.getItem(BAK)); } catch (e) {}
      if (!b || !b.db) return notify('没有可撤销的备份了');
      if (!confirm('回到恢复前的数据？现在的数据会被换掉。')) return;
      Store.replace(b.db, 'import');
      Store.mark(Date.now());
      dispatchEvent(new CustomEvent('store:dirty', { detail: { source: 'import' } }));
      try { localStorage.removeItem(BAK); } catch (e) {}
      $('syUndo').hidden = true;
      $('sySize').textContent = '已撤销 · ' + Store.points() + ' pts';
      paintState();
      notify('已回到恢复前 · ' + Store.points() + ' pts');
    });

    panel.querySelector('.sy__x').addEventListener('click', close);
    $('syGen').addEventListener('click', () => { $('syCode').value = prettyCode(makeCode()); notify('生成好了，记得复制保存'); });
    $('syCopy').addEventListener('click', async () => {
      const v = cleanCode($('syCode').value);
      if (!v) return notify('先生成或填一个同步码');
      try { await navigator.clipboard.writeText(prettyCode(v)); notify('同步码已复制'); }
      catch (e) { $('syCode').select(); notify('按 Ctrl/Cmd + C 复制'); }
    });
    $('syConnect').addEventListener('click', async () => {
      const url = $('syUrl').value.trim().replace(/\/+$/, '');
      const code = cleanCode($('syCode').value);
      if (!/^https?:\/\/[^\s]+$/i.test(url)) return notify('Worker 地址看着不对');
      if (code.length < 8) return notify('同步码至少 8 位');
      cfg = { url, code };
      write(CFG, cfg);
      key = null; rev = -1; dirty = false;
      setStatus('idle');
      notify('正在连接…');
      await syncNow({ force: true });
      const row = panel.querySelector('.sy__row2');
      if (row && cfg) row.hidden = false;
      paintState();
    });
    $('syNow').addEventListener('click', async () => {
      if (!cfg) return notify('先填地址和同步码，点「连接并同步」');
      await syncNow({ force: true });
    });
    $('syForce').addEventListener('click', async () => {
      if (!cfg) return notify('还没连接');
      await syncNow({ force: true, forceLocal: true });
      notify('已用本机数据覆盖云端');
    });
    $('syOff').addEventListener('click', () => {
      try { localStorage.removeItem(CFG); localStorage.removeItem(META); } catch (e) {}
      cfg = null; key = null; rev = -1; dirty = false; lastSync = 0;
      clearTimeout(pushTimer);
      setStatus('off');
      $('syUrl').value = ''; $('syCode').value = '';
      const row = panel.querySelector('.sy__row2');
      if (row) row.hidden = true;
      notify('已断开，本机数据没动');
    });

    paintState();
    requestAnimationFrame(() => { scrim.classList.add('on'); panel.classList.add('on'); });
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!panel || !panel.classList.contains('on')) return;
    scrim.classList.remove('on');
    panel.classList.remove('on');
    document.body.style.overflow = '';
  }

  /* ---------------------------------------------------------- 自动触发 */
  function boot() {
    ensure();
    addEventListener('online', () => syncNow());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !busy) syncNow();
    });
    if (!cfg) return;
    // 首次拉取稍等一下，别跟页面渲染抢时间
    setTimeout(() => syncNow(), 900);
  }

  // 本机有改动 → 排队上传；UI 各自监听 store:change 刷新
  addEventListener('store:dirty', schedulePush);
  addEventListener('store:change', () => paintState());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return {
    open, close, syncNow,
    status: () => ({ connected: !!cfg, status, rev, lastSync, dirty, busy, errMsg }),
    code: () => cfg ? prettyCode(cfg.code) : ''
  };
})();
