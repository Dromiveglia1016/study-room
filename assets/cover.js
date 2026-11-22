/* ============================================================
   STUDY ROOM · 封面交互
   日历 / 时钟 / 播放器 / 语录 / 贴纸视差
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- 日历 ---------------- */
  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var grid = document.getElementById('calGrid');
  var calTitle = document.getElementById('calTitle');

  if (grid) {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    var today = now.getDate();

    if (calTitle) calTitle.textContent = MONTHS[m] + ' ' + y;

    var frag = document.createDocumentFragment();
    ['日', '一', '二', '三', '四', '五', '六'].forEach(function (w) {
      var s = document.createElement('span');
      s.className = 'wd';
      s.textContent = w;
      frag.appendChild(s);
    });

    var firstDow = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var prevMonthDays = new Date(y, m, 0).getDate();
    var cells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

    for (var i = 0; i < cells; i++) {
      var n = i - firstDow + 1;
      var cell = document.createElement('span');
      if (n < 1) {
        cell.className = 'out';
        cell.textContent = prevMonthDays + n;
      } else if (n > daysInMonth) {
        cell.className = 'out';
        cell.textContent = n - daysInMonth;
      } else {
        cell.textContent = n;
        if (n === today) cell.className = 'today';
      }
      frag.appendChild(cell);
    }
    grid.appendChild(frag);
  }

  /* ---------------- 时钟 ---------------- */
  var elTime = document.getElementById('clockTime');
  var elDate = document.getElementById('clockDate');
  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function pad(v) { return v < 10 ? '0' + v : '' + v; }

  function tickClock() {
    if (!elTime) return;
    var d = new Date();
    elTime.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    if (elDate) {
      elDate.textContent = d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' · ' + WEEK[d.getDay()];
    }
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* 资讯条日期跟随当天 */
  var elNewsDate = document.getElementById('newsDate');
  if (elNewsDate) {
    var nd = new Date();
    elNewsDate.textContent = nd.getFullYear() + '.' + pad(nd.getMonth() + 1) + '.' + pad(nd.getDate());
  }

  /* ---------------- 播放器 ---------------- */
  var musicCard = document.getElementById('music');
  var playBtn = document.getElementById('playBtn');
  var playIcon = document.getElementById('playIcon');

  if (playBtn && musicCard && playIcon) {
    playBtn.addEventListener('click', function () {
      var on = musicCard.classList.toggle('is-playing');
      var use = playIcon.querySelector('use');
      if (use) use.setAttribute('href', on ? '#i-pause' : '#i-play');
      playBtn.setAttribute('aria-label', on ? '暂停' : '播放');
    });
  }

  /* ---------------- 语录 ---------------- */
  var QUOTES = [
    '慢一点也没关系，只要今天翻了一页。',
    '先做十分钟，剩下的交给惯性。',
    '背不下来的词，多见几次就熟了。',
    '今天不追进度，只追一句读懂。',
    '把讨厌的科目，先改成"还没熟悉"。',
    '学累了就抬头看看窗外，不扣分。'
  ];
  var quoteText = document.getElementById('quoteText');
  var quoteBtn = document.getElementById('quoteBtn');
  var lastQuote = 0;

  if (quoteBtn && quoteText) {
    quoteBtn.addEventListener('click', function () {
      var i = lastQuote;
      while (i === lastQuote && QUOTES.length > 1) {
        i = Math.floor(Math.random() * QUOTES.length);
      }
      lastQuote = i;
      quoteText.textContent = QUOTES[i];
    });
  }

  /* ---------------- 贴纸视差 ---------------- */
  var decos = Array.prototype.slice.call(document.querySelectorAll('.deco'));

  if (decos.length && !reduce && window.matchMedia('(pointer: fine)').matches) {
    var targetX = 0, targetY = 0;
    var curX = 0, curY = 0;
    var raf = null;

    window.addEventListener('mousemove', function (e) {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    function loop() {
      curX += (targetX - curX) * 0.07;
      curY += (targetY - curY) * 0.07;

      for (var i = 0; i < decos.length; i++) {
        var el = decos[i];
        var depth = parseFloat(el.getAttribute('data-depth')) || 1;
        el.style.transform = 'translate3d(' +
          (-curX * depth * 15).toFixed(2) + 'px,' +
          (-curY * depth * 11).toFixed(2) + 'px,0)';
      }

      if (Math.abs(targetX - curX) > 0.001 || Math.abs(targetY - curY) > 0.001) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }
  }

  /* ---------------- 入场：拉链拉开 ---------------- */
  var intro = document.getElementById('intro');
  var pull = document.getElementById('introPull');

  if (intro) {
    var KEY = 'studyroom:intro-seen';
    var seen = false;
    try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    var force = /[?&]intro=1/.test(location.search);

    function killIntro() {
      if (intro.parentNode) intro.parentNode.removeChild(intro);
      document.body.classList.remove('intro-open-lock');
    }

    if (reduce || (seen && !force)) {
      killIntro();
    } else {
      document.body.classList.add('intro-open-lock');

      var p = 0;
      var dragging = false;
      var moved = false;
      var startY = 0;
      var startP = 0;

      var setP = function (v) {
        p = Math.max(0, Math.min(1, v));
        intro.style.setProperty('--zip', p.toFixed(4));
      };

      var finish = function () {
        intro.classList.add('is-done');
        document.body.classList.remove('intro-open-lock');
        try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
        window.setTimeout(killIntro, 520);
      };

      var animateTo = function (to, cb) {
        var from = p;
        var t0 = performance.now();
        var dur = 560;
        var step = function (t) {
          var k = Math.min(1, (t - t0) / dur);
          var e = 1 - Math.pow(1 - k, 3);
          setP(from + (to - from) * e);
          if (k < 1) {
            requestAnimationFrame(step);
          } else if (cb) {
            cb();
          }
        };
        requestAnimationFrame(step);
      };

      var release = function () {
        if (!dragging) return;
        dragging = false;
        if (!moved) {
          animateTo(1, finish);
        } else if (p > 0.4) {
          animateTo(1, finish);
        } else {
          animateTo(0);
        }
        moved = false;
      };

      if (pull) {
        pull.addEventListener('pointerdown', function (e) {
          dragging = true;
          moved = false;
          startY = e.clientY;
          startP = p;
          if (pull.setPointerCapture) {
            try { pull.setPointerCapture(e.pointerId); } catch (err) {}
          }
          e.preventDefault();
        });

        pull.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            animateTo(1, finish);
          }
        });

        pull.addEventListener('pointermove', function (e) {
          if (!dragging) return;
          var dy = e.clientY - startY;
          if (Math.abs(dy) > 4) moved = true;
          setP(startP + dy / (window.innerHeight * 0.52));
        });

        pull.addEventListener('pointerup', release);
        pull.addEventListener('pointercancel', release);
      }

      window.addEventListener('pointerup', function () {
        if (dragging) release();
      });

      intro.addEventListener('wheel', function (e) {
        if (dragging) return;
        setP(p + e.deltaY / 780);
        if (p >= 1) finish();
      }, { passive: true });

      // 触屏：向上滑动也能拉开
      var touchStart = 0;
      intro.addEventListener('touchstart', function (e) {
        if (e.touches.length) touchStart = e.touches[0].clientY;
      }, { passive: true });
      intro.addEventListener('touchmove', function (e) {
        if (!e.touches.length || dragging) return;
        var dy = e.touches[0].clientY - touchStart;
        if (dy > 0) setP(dy / (window.innerHeight * 0.52));
      }, { passive: true });
      intro.addEventListener('touchend', function () {
        if (dragging) return;
        if (p > 0.4) animateTo(1, finish);
        else animateTo(0);
      }, { passive: true });
    }
  }
})();
