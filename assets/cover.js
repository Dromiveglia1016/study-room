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
})();
