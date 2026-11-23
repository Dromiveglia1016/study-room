/* ============================================================
   study room · links
   每个模块的视频外链：data.js 里的只是出厂默认，
   页面右上角链环按钮打开的面板可以随时自己改，不用碰代码
   ============================================================ */

const Links = (() => {
  const KEY = 'studyroom.links';
  let custom = {};
  try { custom = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { custom = {}; }

  const def = (mid) => {
    const m = MODULES.find(x => x.id === mid);
    return (m && m.link) || '';
  };

  /* 现在生效的链接：自己填的优先，没填就用默认 */
  const get = (mid) => {
    if (Object.prototype.hasOwnProperty.call(custom, mid)) {
      return String(custom[mid] || '').trim();
    }
    return def(mid);
  };

  const set = (mid, url) => {
    url = String(url == null ? '' : url).trim();
    custom[mid] = url;
    try { localStorage.setItem(KEY, JSON.stringify(custom)); } catch (e) {}
    dispatchEvent(new CustomEvent('links:change', { detail: { mid, url: get(mid) } }));
    return get(mid);
  };

  const reset = () => {
    custom = {};
    try { localStorage.removeItem(KEY); } catch (e) {}
    dispatchEvent(new CustomEvent('links:change', {}));
  };

  return { get, set, reset };
})();

/* ---------------------------------------------------------------- panel */
const Settings = (() => {
  let scrim, root;

  function ensure() {
    if (root) return;
    scrim = document.createElement('div');
    scrim.className = 'set__scrim';
    scrim.addEventListener('click', close);

    root = document.createElement('div');
    root.className = 'set';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'setTitle');
    document.body.append(scrim, root);

    addEventListener('keydown', e => {
      if (e.key === 'Escape' && root.classList.contains('on')) close();
    });
  }

  function rowHTML(m) {
    return `
    <div class="set__row" data-id="${m.id}">
      <div class="set__id">
        <b>${m.name}</b>
        <span>${m.catCn} · ${m.min} min</span>
      </div>
      <div class="set__field">
        <input type="text" spellcheck="false" autocomplete="off"
          placeholder="没配视频 · 粘贴 B 站 / 百度网盘链接">
        <button class="set__clear" type="button" aria-label="清空这条链接">×</button>
      </div>
    </div>`;
  }

  /* 网盘分享常是一整段「链接: https://... 提取码: abcd」，直接把 URL 抠出来 */
  function normalize(raw) {
    raw = String(raw == null ? '' : raw).trim();
    if (!raw) return '';
    const hit = raw.match(/https?:\/\/[^\s，。；、"'）)]+/i);
    if (hit) return hit[0];
    if (/^[\w-]+(\.[\w-]+)+/i.test(raw)) return 'https://' + raw;
    return '';
  }

  function bindRow(row) {
    const mid = row.dataset.id;
    const input = row.querySelector('input');
    const clear = row.querySelector('.set__clear');
    input.value = Links.get(mid);

    const flash = () => {
      input.classList.add('is-saved');
      setTimeout(() => input.classList.remove('is-saved'), 1100);
    };
    const save = () => {
      const raw = input.value.trim();
      const url = normalize(raw);
      if (raw && !url) { toast('这看着不像链接，检查一下'); return; }
      input.value = url;
      Links.set(mid, url);
      flash();
    };

    input.addEventListener('change', save);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
    clear.addEventListener('click', () => {
      input.value = '';
      Links.set(mid, '');
      flash();
      input.focus();
    });
  }

  function open() {
    ensure();
    if (typeof Jump !== 'undefined') Jump.close(false);

    root.innerHTML = `
      <button class="set__x" type="button" aria-label="关掉">
        <svg viewBox="0 0 24 24"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3Z"/></svg>
      </button>
      <p class="set__kick"><i></i>settings</p>
      <h3 id="setTitle">视频链接</h3>
      <p class="set__sub">
        买完或按「继续」时问你要不要打开的，就是这里填的链接。
        B 站、百度网盘的分享链接都行，整段粘进来也行，会自动挑出地址。
      </p>
      <div class="set__body">${MODULES.map(rowHTML).join('')}</div>
      <div class="set__foot">
        <button class="set__reset" type="button">恢复默认</button>
        <span>改动只存在这台设备上</span>
        <button class="btn btn--ink" type="button" data-done>好了</button>
      </div>`;

    root.querySelectorAll('.set__row').forEach(bindRow);
    root.querySelector('.set__x').addEventListener('click', close);
    root.querySelector('[data-done]').addEventListener('click', close);
    root.querySelector('.set__reset').addEventListener('click', () => {
      Links.reset();
      root.querySelectorAll('.set__row').forEach(r => {
        const inp = r.querySelector('input');
        inp.value = Links.get(r.dataset.id);
        inp.classList.add('is-saved');
        setTimeout(() => inp.classList.remove('is-saved'), 1100);
      });
      toast('已恢复默认链接');
    });

    requestAnimationFrame(() => {
      scrim.classList.add('on');
      root.classList.add('on');
    });
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!root || !root.classList.contains('on')) return;
    scrim.classList.remove('on');
    root.classList.remove('on');
    document.body.style.overflow = '';
  }

  return { open, close };
})();
