/* ============================================================
   study room · jump
   带视频的模块，问一句「要不要现在跳过去看」
   跳转用新标签，书桌留在原地，计时不受影响
   ============================================================ */

const PEND_KEY = 'studyroom.jump';
const PEND_TTL = 5 * 60 * 1000;   // 付款后 5 分钟内进书桌才弹

const Jump = (() => {
  let scrim, root, done = null;

  function ensure() {
    if (root) return;
    scrim = document.createElement('div');
    scrim.className = 'jump__scrim';
    scrim.addEventListener('click', () => close(false));

    root = document.createElement('div');
    root.className = 'jump';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'jumpTitle');
    document.body.append(scrim, root);

    addEventListener('keydown', e => {
      if (e.key === 'Escape' && root.classList.contains('on')) close(false);
    });
  }

  function close(go) {
    if (!root || !root.classList.contains('on')) return;
    scrim.classList.remove('on');
    root.classList.remove('on');
    document.body.style.overflow = '';
    const fn = done; done = null;
    if (fn) fn(!!go);
  }

  /* 返回 Promise<boolean>：去了 = true，没去 = false */
  function ask(mod, opt) {
    opt = opt || {};
    if (!mod || !mod.link) return Promise.resolve(false);
    ensure();

    root.innerHTML = `
      <button class="jump__x" type="button" aria-label="关掉">
        <svg viewBox="0 0 24 24"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3Z"/></svg>
      </button>
      <p class="jump__kick"><i></i>bilibili · 外部视频</p>
      <div class="jump__row">
        <span class="jump__thumb"><img src="assets/shop/${mod.img || 'video'}.webp" alt=""></span>
        <div class="jump__id">
          <h3 id="jumpTitle">${opt.title || '这节课配了视频'}</h3>
          <p>${mod.catCn || ''} · ${mod.name || ''} · ${mod.min || 0} min</p>
        </div>
      </div>
      <p class="jump__body">
        视频在 B 站。点下面会<b>新开一个标签</b>打开它，这边的书桌别关——
        计时照常走，看完回来收积分。
      </p>
      <div class="jump__acts">
        <a class="btn btn--ink" href="${mod.link}" target="_blank" rel="noopener noreferrer">去 B 站看 ↗</a>
        <button class="btn" type="button" data-no>先不去</button>
      </div>
      <p class="jump__hint">${opt.hint || '同一个视频看到一半关了，回来还能从头点开。'}</p>`;

    root.querySelector('.jump__x').addEventListener('click', () => close(false));
    root.querySelector('[data-no]').addEventListener('click', () => close(false));
    root.querySelector('.jump__acts a').addEventListener('click', () => {
      // 先让浏览器把新标签开出来，再收起弹层
      setTimeout(() => close(true), 80);
    });

    requestAnimationFrame(() => {
      scrim.classList.add('on');
      root.classList.add('on');
    });
    document.body.style.overflow = 'hidden';
    // 只在有鼠标的设备上抢焦点，手机上弹出就聚焦会带出一圈描边
    if (matchMedia('(pointer:fine)').matches) {
      setTimeout(() => {
        const b = root.querySelector('.jump__acts .btn--ink');
        if (b && root.classList.contains('on')) b.focus({ preventScroll: true });
      }, 340);
    }

    return new Promise(res => { done = res; });
  }

  /* 付款后把「要看视频的那一单」带到书桌页 */
  function markPending(mid) {
    try { sessionStorage.setItem(PEND_KEY, JSON.stringify({ mid, at: Date.now() })); } catch (e) {}
  }
  function takePending() {
    try {
      const raw = sessionStorage.getItem(PEND_KEY);
      sessionStorage.removeItem(PEND_KEY);
      if (!raw) return '';
      const o = JSON.parse(raw);
      if (!o || !o.mid) return '';
      if (Date.now() - (o.at || 0) > PEND_TTL) return '';
      return o.mid;
    } catch (e) { return ''; }
  }

  return { ask, close, markPending, takePending };
})();
