/* ============================================================
   報名人數計數器 — 進場滾動（11a 依序滾入）
   ------------------------------------------------------------
   規則（重要）：
   1. 只在「頁面載入」時播放一次。之後的即時數值更新用 setSignupCount()，
      直接改數字、不再滾動 —— 每次輪詢都重滾會很吵。
   2. 位數無關：任何數字都補零成 5 碼；前導零維持淡色（.odo__d--lead）。
   3. 無外部依賴、無 build。ES5 語法，webview 相容。
   ============================================================ */
(function () {
  var PAD = 5;
  var LOOPS = 2;                                  // 進場前空轉兩圈
  var EASE = 'cubic-bezier(.16,.84,.3,1)';
  var DUR = function (i) { return 900 + i * 180; };  // 右邊比左邊晚停
  var DELAY = function (i) { return i * 70; };

  function pad(v) {
    var s = String(Math.max(0, parseInt(v, 10) || 0));
    while (s.length < PAD) s = '0' + s;
    return s.slice(-PAD);
  }

  function cell(ch) {
    var c = document.createElement('span');
    c.className = 'odo__c';
    c.textContent = ch;
    return c;
  }

  /* 建一條「0-9 × LOOPS + 目標數字」的帶子，回傳目標索引 */
  function buildReel(tile, digit) {
    var reel = document.createElement('span');
    reel.className = 'odo__reel';
    for (var l = 0; l < LOOPS; l++) {
      for (var n = 0; n < 10; n++) reel.appendChild(cell(String(n)));
    }
    reel.appendChild(cell(digit));
    tile.textContent = '';
    tile.appendChild(reel);
    return reel.children.length - 1;
  }

  /* 進場：只呼叫一次 */
  function roll(root) {
    var value = root.getAttribute('data-value') || root.textContent.replace(/\D/g, '');
    var digits = pad(value).split('');
    var tiles = root.querySelectorAll('.odo__d');
    if (tiles.length !== PAD) return;

    var lead = PAD - String(parseInt(value, 10) || 0).length;
    var reels = [];
    for (var i = 0; i < PAD; i++) {
      tiles[i].classList.toggle('odo__d--lead', i < lead);
      var n = buildReel(tiles[i], digits[i]);
      var el = tiles[i].firstChild;
      el.style.transition = 'none';
      el.style.transform = 'translateY(0)';
      // 一格的高度直接量測，手機（vw 換算）與桌機（固定 px）都正確
      reels.push({ el: el, n: n, cell: tiles[i].getBoundingClientRect().height });
    }

    // 起點與終點必須分兩個 tick 設定，否則瀏覽器會合併成「沒有動畫」。
    // 這裡用 setTimeout 而非 requestAnimationFrame：部分 webview（LINE / IG 內建瀏覽器、
    // 背景分頁）會延後或丟棄 rAF 回呼，導致滾輪永遠停在起點。
    setTimeout(function () {
      for (var i = 0; i < PAD; i++) {
        var r = reels[i];
        r.el.style.transition = 'transform ' + DUR(i) + 'ms ' + EASE + ' ' + DELAY(i) + 'ms';
        r.el.style.transform = 'translateY(' + (-r.n * r.cell) + 'px)';
      }
      // 動畫結束後把帶子收成單一數字，DOM 保持乾淨（也讓後續更新更便宜）
      setTimeout(function () { settle(root, digits, lead); }, DUR(PAD - 1) + DELAY(PAD - 1) + 60);
    }, 50);
  }

  function settle(root, digits, lead) {
    var tiles = root.querySelectorAll('.odo__d');
    for (var i = 0; i < tiles.length; i++) {
      tiles[i].textContent = digits[i];
      tiles[i].classList.toggle('odo__d--lead', i < lead);
    }
  }

  /* 之後的即時更新走這裡：直接換數字，不滾動 */
  window.setSignupCount = function (value) {
    var root = document.getElementById('signupNumber');
    if (!root) return;
    root.setAttribute('data-value', value);
    var digits = pad(value).split('');
    settle(root, digits, PAD - String(Math.max(0, parseInt(value, 10) || 0)).length);
  };

  function init() {
    var root = document.getElementById('signupNumber');
    if (!root) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    roll(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
