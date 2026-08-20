/* ------------------------------------------------------------------
   預覽用替身（PREVIEW STUB）— 不是交付檔案
   CC 請沿用 repo 內原本的 assets/join.js；這支只是為了讓設計稿能單獨
   打開來看互動視覺回饋（計數、輪播圓點、展開收合、旗標開關）。
   網址加上 ?flags=on 可以看到三個旗標區塊開啟時的樣子。
------------------------------------------------------------------ */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 旗標：預覽用
  if (/[?&]flags=on/.test(location.search)) {
    ['genderRatio', 'pricingSection', 'countdownSection'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.removeAttribute('hidden');
    });
  }

  // 報名人數：五位計數器（補零），輕微計數動畫；reduced-motion 直接跳終值
  var odo = document.getElementById('signupNumber');
  if (odo) {
    var digits = odo.querySelectorAll('.odo__d');
    var target = parseInt(odo.getAttribute('data-value'), 10) || 0;
    var paint = function (v) {
      var str = String(v).padStart(digits.length, '0');
      for (var i = 0; i < digits.length; i++) {
        digits[i].textContent = str.charAt(i);
        // 前導零淡化：只有真正的前導零套 --lead
        var lead = i < str.length - String(v).length;
        digits[i].classList.toggle('odo__d--lead', lead);
      }
    };
    if (reduce) {
      paint(target);
    } else {
      var s0 = performance.now(), dur = 900, from = Math.max(0, target - 60);
      var tick = function (now) {
        var t = Math.min(1, (now - s0) / dur);
        paint(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
      };
      paint(from);
      requestAnimationFrame(tick);
    }
  }

  // 怎麼玩：IG Story 式輪播。四張無限循環 —— 做法是 DOM 上放三份複本，
  // 指標永遠停在中間那一份，滑完在 transitionend 靜默回中，所以兩個方向都能一直滑。
  var reel = document.getElementById('howTrack');
  var bars = document.getElementById('howDots');
  if (reel) {
    var DWELL = 7000;   // Instagram 照片故事約 7 秒換下一張
    var TICK = 50;
    var base = Array.prototype.slice.call(reel.children);
    var N = base.length;
    base.forEach(function (n) { reel.appendChild(n.cloneNode(true)); });
    base.forEach(function (n) { reel.appendChild(n.cloneNode(true)); });
    var idx = N, drag = null, prog = 0;
    var act = function () { return ((idx % N) + N) % N; };
    var paintBars = function () {
      if (!bars) return;
      var a = act();
      Array.prototype.forEach.call(bars.children, function (s, i) {
        s.firstElementChild.style.width = i < a ? '100%' : i === a ? (prog * 100).toFixed(1) + '%' : '0%';
      });
    };
    var paint = function (dx) {
      reel.style.transform = 'translateX(calc(' + (-idx * 100) + '% + ' + (dx || 0) + 'px))';
      paintBars();
    };
    var goStep = function (dir) {
      reel.classList.remove('is-static');
      idx += dir;
      prog = 0;
      paint(0);
    };
    reel.addEventListener('transitionend', function () {
      if (idx >= N && idx < N * 2) return;
      reel.classList.add('is-static');
      idx = N + act();
      paint(0);
    });
    var prevBtn = document.querySelector('.how__arrow--prev');
    var nextBtn = document.querySelector('.how__arrow--next');
    if (prevBtn) prevBtn.addEventListener('click', function () { goStep(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goStep(1); });

    var stage = reel.parentNode;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      drag = e.clientX;
      reel.classList.add('is-static');
    });
    stage.addEventListener('pointermove', function (e) {
      if (drag !== null) paint(e.clientX - drag);
    });
    stage.addEventListener('pointerup', function (e) {
      if (drag === null) return;
      var dx = e.clientX - drag;
      drag = null;
      reel.classList.remove('is-static');
      if (dx < -56) goStep(1);
      else if (dx > 56) goStep(-1);
      else paint(0);
    });
    stage.addEventListener('pointercancel', function () { drag = null; reel.classList.remove('is-static'); paint(0); });

    reel.classList.add('is-static');
    paint(0);
    requestAnimationFrame(function () { reel.classList.remove('is-static'); });

    // 自動輪播：進度條跑滿就換下一張。按住／拖曳中、分頁在背景、reduced-motion 都不跑。
    if (!reduce) {
      setInterval(function () {
        if (document.hidden || drag !== null) return;
        prog += TICK / DWELL;
        if (prog >= 1) { goStep(1); return; }
        paintBars();
      }, TICK);
    } else {
      prog = 1;
      paintBars();
    }
  }

  // 倒數：dd:hh:mm:ss，每秒更新（正式版請由 join.js 的目標日推算）
  var cdDays = document.getElementById('countdownDays');
  if (cdDays) {
    var target = Date.now() + ((32 * 24 + 8) * 60 + 14) * 60 * 1000 + 27000;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    var tickCd = function () {
      var left = Math.max(0, target - Date.now());
      var sec = Math.floor(left / 1000);
      set('countdownDays', String(Math.floor(sec / 86400)));
      set('countdownHours', pad(Math.floor(sec / 3600) % 24));
      set('countdownMinutes', pad(Math.floor(sec / 60) % 60));
      set('countdownSeconds', pad(sec % 60));
    };
    tickCd();
    setInterval(tickCd, 1000);
  }

  // 沒有免費版本：展開 / 收合
  var toggle = document.getElementById('pricingToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  }
})();
