/* =========================================================================
   Treehouse /join — 資料層、報名人數看板、輪播、CTA/UTM、GA4

   載入順序要求：join.config.js → join.js（defer） → app.js（defer）。
   本檔開頭第一件事是把語言鎖定為 zh，必須在 app.js 的 init() 讀 localStorage
   之前跑完，見下方說明。
   ========================================================================= */
(function () {
  "use strict";

  // ---- 語言鎖定：/join 只做中文，主動蓋掉可能殘留的 en 偏好，避免共用 footer 洩出英文 ----
  try { localStorage.setItem("th-lang", "zh"); } catch (e) {}

  // ---- Config：內建預設值 + 淺合併 window.JOIN_CONFIG，任一欄位打錯只影響該欄位 ----
  var DEFAULTS = {
    signup: { mode: "mock", baseValue: 298, round: "floor", sheetUrl: null, pollMs: 600000 },
    genderRatio: { enabled: false, mode: "policy", femaleMin: 47, femaleMax: 53, changeEverySignups: 5, femaleBias: 0.5, csvUrl: null, pauseThreshold: 0.55, pollMs: 600000 },
    pricing: { enabled: false, amountLabel: "NT$240", trialDuration: "30 天" },
    countdown: { enabled: false, targetIso: null },
    cta: { mode: "form", formBaseUrl: "https://forms.gle/oKRJeB39md3gFTvH9", iosUrl: null, androidUrl: null },
    footer: { enabled: false },
    ga4: { measurementId: null }
  };

  function mergeSection(name) {
    var out = {};
    var d = DEFAULTS[name];
    for (var k in d) { if (d.hasOwnProperty(k)) out[k] = d[k]; }
    var user;
    try { user = window.JOIN_CONFIG && window.JOIN_CONFIG[name]; } catch (e) { user = null; }
    if (user) {
      for (var k2 in user) { if (user.hasOwnProperty(k2)) out[k2] = user[k2]; }
    }
    return out;
  }

  var CFG = {
    signup: mergeSection("signup"),
    genderRatio: mergeSection("genderRatio"),
    pricing: mergeSection("pricing"),
    countdown: mergeSection("countdown"),
    cta: mergeSection("cta"),
    footer: mergeSection("footer"),
    ga4: mergeSection("ga4")
  };

  // ---- 對稿／預覽開關：?flags=on ----
  // handoff/ 的三支驗收工具（compare、spec-check、fold-test）都用這個參數載入本頁，
  // 才量得到三個旗標區塊開啟時的版面。只吃網址參數，不動 join.config.js，
  // 正式流量沒有這個參數 = 完全沒有作用。
  if (/[?&]flags=on(&|$)/.test(location.search)) {
    CFG.genderRatio.enabled = true;
    CFG.pricing.enabled = true;
    CFG.countdown.enabled = true;
    if (!CFG.countdown.targetIso) {
      // 對稿只需要「有東西可以顯示」，給一個固定偏移的假目標日
      CFG.countdown.targetIso = new Date(Date.now() + ((32 * 24 + 8) * 60 + 14) * 60000 + 27000).toISOString();
    }
  }

  window.__JOIN_DEBUG__ = { config: CFG, lastGoodFetch: {}, lastError: {}, roll: null, reduceMotion: null };

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  window.__JOIN_DEBUG__.reduceMotion = reduceMotion;   // 使用者系統有沒有關動畫（除錯用）

  // =========================================================================
  // Analytics — gtag.js 是刻意的外連例外（見 join/index.html 內註解），只在
  // 設定了 measurementId 時才動態載入；所有呼叫走 gaSafe，涵蓋「沒設定 ID」
  // 跟「gtag.js 被廣告攔截器擋掉」兩種情況，不直接裸呼叫 gtag()。
  // =========================================================================
  function gaSafe() {
    if (typeof window.gtag === "function") {
      window.gtag.apply(null, arguments);
    }
  }

  function loadGA4() {
    if (!CFG.ga4.measurementId) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", CFG.ga4.measurementId);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CFG.ga4.measurementId);
    document.head.appendChild(s);
  }

  var failingSources = {};
  function reportFetchFailure(source, err) {
    window.__JOIN_DEBUG__.lastError[source] = { message: String((err && err.message) || err), at: new Date().toISOString() };
    if (!failingSources[source]) {
      failingSources[source] = true;
      gaSafe("event", "data_fetch_error", { source: source });
    }
    if (window.console && console.warn) console.warn("[join] " + source + " fetch failed, keeping last known value:", err);
  }
  function reportFetchSuccess(source, value) {
    failingSources[source] = false;
    window.__JOIN_DEBUG__.lastGoodFetch[source] = { value: value, at: new Date().toISOString() };
  }

  // =========================================================================
  // UTM — 從目前網址擷取 utm_* 參數（前綴比對，不寫死特定幾個 key），
  // 附加到 outbound 表單連結，並隨 cta_click 事件一起送出。
  // =========================================================================
  function getUtmParams() {
    var out = {};
    try {
      var params = new URLSearchParams(window.location.search);
      params.forEach(function (v, k) {
        if (/^utm_/.test(k)) out[k] = v;
      });
    } catch (e) {}
    return out;
  }
  var UTM = getUtmParams();

  function appendUtm(url) {
    var keys = [];
    for (var k in UTM) { if (UTM.hasOwnProperty(k)) keys.push(k); }
    if (!keys.length) return url;
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    var qs = keys.map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(UTM[k]); }).join("&");
    return url + sep + qs;
  }

  // =========================================================================
  // 報名人數 — Google Sheet（gviz，range=B1 直接取儲存格，避開表頭猜測）
  // =========================================================================
  function extractSheetId(url) {
    var m = /\/d\/([a-zA-Z0-9-_]+)/.exec(url || "");
    return m ? m[1] : null;
  }

  function parseGvizResponse(text) {
    // gviz 回應包了一層 google.visualization.Query.setResponse({...}); 外殼，不是純 JSON
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("gviz: no JSON payload in response");
    return JSON.parse(text.slice(start, end + 1));
  }

  function fetchSignupCount() {
    if (CFG.signup.mode !== "sheet") return Promise.resolve(null);
    var id = extractSheetId(CFG.signup.sheetUrl);
    if (!id) return Promise.resolve(null); // 網址還沒填，維持 baseValue，不算錯誤
    var url = "https://docs.google.com/spreadsheets/d/" + id + "/gviz/tq?tqx=out:json&range=B1&t=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("sheet http " + res.status);
        return res.text();
      })
      .then(function (text) {
        var data = parseGvizResponse(text);
        var row = data.table && data.table.rows && data.table.rows[0];
        var cell = row && row.c && row.c[0];
        var val = cell ? cell.v : null;
        var num = Number(val);
        if (!isFinite(num)) throw new Error("sheet: B1 not numeric (" + val + ")");
        return num;
      });
  }

  // =========================================================================
  // 男女人數 — 外包 CSV（統計時間, 異性戀男性人數, 異性戀女性人數, 總註冊人數）
  // 分母＝異性戀男+異性戀女，status 由本檔自行推算，兩者原因見 join.config.js 註解
  // =========================================================================
  function splitCsvLine(line) {
    var out = [], cur = "", inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (line.charAt(i + 1) === '"') { cur += '"'; i++; } else { inQuotes = false; }
        } else { cur += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ",") { out.push(cur); cur = ""; }
        else { cur += c; }
      }
    }
    out.push(cur);
    for (var j = 0; j < out.length; j++) out[j] = out[j].replace(/^\s+|\s+$/g, "");
    return out;
  }

  function parseCsv(text) {
    var lines = text.replace(/\r/g, "").split("\n").filter(function (l) { return l.replace(/\s/g, "").length > 0; });
    if (!lines.length) return [];
    var header = splitCsvLine(lines[0]);
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cells = splitCsvLine(lines[i]);
      var row = {};
      for (var h = 0; h < header.length; h++) row[header[h]] = cells[h];
      rows.push(row);
    }
    return rows;
  }

  function fetchGenderRatio() {
    if (!CFG.genderRatio.enabled || !CFG.genderRatio.csvUrl) return Promise.resolve(null);
    var sep = CFG.genderRatio.csvUrl.indexOf("?") === -1 ? "?" : "&";
    var url = CFG.genderRatio.csvUrl + sep + "t=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("vendor csv http " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCsv(text);
        if (!rows.length) throw new Error("vendor csv: no data rows");
        var row = rows[rows.length - 1]; // 最新一列（統計時間欄可另作新鮮度確認，目前不對外顯示）
        var male = Number(row["異性戀男性人數"]);
        var female = Number(row["異性戀女性人數"]);
        if (!isFinite(male) || !isFinite(female)) throw new Error("vendor csv: 男/女 欄位非數字");
        var total = male + female; // 刻意不用「總註冊人數」欄，見 join.config.js 註解
        var malePct = total > 0 ? male / total : 0;
        var femalePct = total > 0 ? female / total : 0;
        var status = "open";
        if (malePct > CFG.genderRatio.pauseThreshold) status = "paused_male";
        else if (femalePct > CFG.genderRatio.pauseThreshold) status = "paused_female";
        return { male: male, female: female, malePct: malePct, femalePct: femalePct, status: status };
      });
  }

  // =========================================================================
  // 報名人數 — 五位計數器（設計稿的 odometer 造型）
  //
  // ⚠ 不可以用 textContent 寫整個 #signupNumber：那個元素底下是五個
  // <b class="odo__d"> 位數格，整個覆蓋會把位數格清掉，看板就塌了。
  // 一律補零成 5 碼後「逐位」寫入，並依實際位數 toggle .odo__d--lead
  // （前導零淡化）。位數固定 5（上限 99999）。
  // =========================================================================
  function normalizeCount(n) {
    if (CFG.signup.round === "floor") n = Math.floor(n);
    return Math.max(0, n);
  }

  // 只畫格子。計數動畫每一幀都會呼叫這支，所以這裡不寫 data-value、
  // 也不做任何會被輔助科技播報的事（見 setCountValue）。
  function paintOdometer(el, value) {
    var digits = el.querySelectorAll(".odo__d");
    if (!digits.length) { el.textContent = String(value); return; } // 舊版 DOM 的退路
    var raw = String(normalizeCount(value));
    var str = raw.length >= digits.length
      ? raw.slice(-digits.length)
      : new Array(digits.length - raw.length + 1).join("0") + raw;
    var leadCount = digits.length - Math.min(raw.length, digits.length);
    for (var i = 0; i < digits.length; i++) {
      digits[i].textContent = str.charAt(i);
      if (i < leadCount) digits[i].classList.add("odo__d--lead");
      else digits[i].classList.remove("odo__d--lead");
    }
  }

  // 落定值：寫 data-value 與 aria-label，只在動畫結束（或直接跳值）時呼叫一次。
  //
  // #signupNumber 是 role="img"，輔助科技只讀 aria-label，不會把五個位數格
  // 逐格念成「零 零 二 九 八」。也刻意不要放 aria-live —— 計數動畫每幀都會
  // 改內容，live region 會把整段動畫播報成一長串數字。人數十分鐘才更新一次，
  // 不需要即時播報。
  // 解除 head 內嵌腳本加上的隱藏（見 join/index.html）。一有可顯示的數字就呼叫。
  function revealCounter() {
    var d = document.documentElement;
    d.className = d.className.replace(/\s*counter-pending\b/, "");
  }

  function setCountValue(el, value) {
    var v = normalizeCount(value);
    paintOdometer(el, v);
    el.setAttribute("data-value", String(v));
    el.setAttribute("aria-label", String(v));   // 單位「人」在隔壁的 .signboard__unit，這裡不要重複
  }

  // =========================================================================
  // 進場滾動（11a 依序滾入）
  // 來源：Claude Design 交付包 counter-roll/odometer.js，接上既有的 setCountValue
  // 以保留 data-value / aria-label（交付包原版沒寫 aria-label，直接用會掉無障礙標籤）。
  //
  // 規則（交付包 README，照做）：
  //   1. 只在頁面載入時播放一次，不重播、不 loop。
  //   2. 之後輪詢拿到新數字直接換數字，不重滾 —— 每十分鐘重滾一次會非常吵。
  //   3. prefers-reduced-motion 時不播放，直接顯示最終數字。
  // =========================================================================
  var ROLL = {
    PAD: 5,
    LOOPS: 2,                                            // 進場前空轉兩圈
    EASE: "cubic-bezier(.16,.84,.3,1)",                   // 快進、長煞停、不回彈
    dur: function (i) { return 900 + i * 180; },           // 右邊比左邊晚停
    delay: function (i) { return i * 70; },
    started: false,
    settled: false,
    reels: null,                                           // 滾動中的五條帶子，供 retargetRoll 換落點用
    pending: null,                                         // 滾動途中到達的真實值，收尾時補上
    guard: null,                                           // 滾動期間盯格高變化的計時器，見 resyncReels
    ticks: 0,                                              // 守衛跑過幾次（除錯用）
    fixes: 0                                               // 實際修正過幾次位移（除錯用）
  };

  function padCount(v) {
    var s = String(Math.max(0, parseInt(v, 10) || 0));
    while (s.length < ROLL.PAD) s = "0" + s;
    return s.slice(-ROLL.PAD);
  }

  function reelCell(ch) {
    var c = document.createElement("span");
    c.className = "odo__c";
    c.textContent = ch;
    return c;
  }

  // 建一條「0-9 × LOOPS + 目標數字」的帶子，回傳目標索引
  function buildReel(tile, digit) {
    var reel = document.createElement("span");
    reel.className = "odo__reel";
    for (var l = 0; l < ROLL.LOOPS; l++) {
      for (var n = 0; n < 10; n++) reel.appendChild(reelCell(String(n)));
    }
    reel.appendChild(reelCell(digit));
    tile.textContent = "";
    tile.appendChild(reel);
    return reel.children.length - 1;
  }

  // 收尾：把帶子換回單一數字，並寫回 data-value / aria-label。
  // 靜止狀態因此與設計稿完全相同 —— 對稿工具量到的是這個狀態。
  function finishRoll(el, value) {
    ROLL.settled = true;
    ROLL.pending = null;
    ROLL.reels = null;
    if (ROLL.guard) { clearInterval(ROLL.guard); ROLL.guard = null; }
    setCountValue(el, value);
    revealCounter();
  }

  // 位移是寫死的 px（見 join.css §11 註解：改用 CSS 變數的話 transition 不會內插），
  // 但格子高度是 calc(68 * var(--u))，而 --u 綁在 vw / svh 上。只要滾動途中可視區
  // 尺寸變了 —— 手機第一次載入網址列收合、桌機捲軸出現、轉向 —— 格高就會變，
  // 而位移還停在用舊格高算出來的數字，帶子會停在錯的格子上。
  //
  // 實測：滾動中把 390x844 改成 390x700，格高 68→56.4，位移仍是 -1360px，
  // 落點索引變成 24.11（帶子只有 21 格），畫面就卡住不動直到收尾才跳成正確數字。
  // 手機上網址列收合會讓可視高度長約一成，20 × 0.9 ≈ 18，而第 18 格剛好是「8」，
  // 所以症狀是「第一次打開卡在 888」。
  //
  // 所以滾動期間持續盯著格高，一有變化就用新的格高重算位移。transition 會自己
  // 平順地接到新目標，不會斷。
  function resyncReels(el) {
    ROLL.ticks++;
    if (ROLL.settled || !ROLL.reels) return;
    var tiles = el.querySelectorAll(".odo__d");
    for (var i = 0; i < ROLL.reels.length; i++) {
      var r = ROLL.reels[i];
      if (!r || !tiles[i]) continue;
      var h = tiles[i].getBoundingClientRect().height;
      if (!h || Math.abs(h - r.cell) < 0.5) continue;
      r.cell = h;
      r.el.style.transform = "translateY(" + (-r.n * h) + "px)";
      ROLL.fixes++;
    }
  }

  // 滾動途中換落點：把每條帶子「最後一格」（要停住的那格）的字換掉。
  // 此刻使用者看到的是帶子中段（第 0~10 格附近），末端改字看不出來；
  // transform 的終點沒有變，所以動畫不會被打斷或重來。
  // 這是為了避免「先顯示 baseValue、fetch 回來再跳一次」的閃動。
  function retargetRoll(el, value) {
    if (ROLL.settled || !ROLL.reels) return false;
    var v = normalizeCount(value);
    var digits = padCount(v).split("");
    var lead = ROLL.PAD - String(v).length;
    var tiles = el.querySelectorAll(".odo__d");
    for (var i = 0; i < ROLL.PAD; i++) {
      var r = ROLL.reels[i];
      if (!r) continue;
      var landing = r.el.children[r.n];
      if (landing) landing.textContent = digits[i];
      if (tiles[i]) tiles[i].classList.toggle("odo__d--lead", i < lead);
    }
    ROLL.pending = v;
    return true;
  }

  function rollIn(el, value) {
    if (ROLL.started) return;
    window.__JOIN_DEBUG__.roll = ROLL;
    ROLL.started = true;

    var v = normalizeCount(value);
    var tiles = el.querySelectorAll(".odo__d");
    if (reduceMotion || tiles.length !== ROLL.PAD) { finishRoll(el, v); return; }

    var digits = padCount(v).split("");
    var lead = ROLL.PAD - String(v).length;
    var reels = [];
    for (var i = 0; i < ROLL.PAD; i++) {
      tiles[i].classList.toggle("odo__d--lead", i < lead);
      var n = buildReel(tiles[i], digits[i]);
      var strip = tiles[i].firstChild;
      strip.style.transition = "none";
      strip.style.transform = "translateY(0)";
      // 一格高度直接量測：手機的 vw 換算與桌機的固定 px 都正確
      reels.push({ el: strip, n: n, cell: tiles[i].getBoundingClientRect().height });
    }
    ROLL.reels = reels;
    revealCounter();   // 帶子已就位，起點是 0 不是預設值，可以顯示了

    // 起點與終點必須分兩個 tick 設定，否則瀏覽器會合併成「沒有動畫」。
    // 這裡用 setTimeout 而非 requestAnimationFrame：部分 webview（LINE / IG 內建
    // 瀏覽器、背景分頁）會延後或丟棄 rAF 回呼，滾輪會永遠停在起點。
    setTimeout(function () {
      for (var i = 0; i < ROLL.PAD; i++) {
        var r = reels[i];
        r.el.style.transition = "transform " + ROLL.dur(i) + "ms " + ROLL.EASE + " " + ROLL.delay(i) + "ms";
        r.el.style.transform = "translateY(" + (-r.n * r.cell) + "px)";
      }
      // 滾動期間盯格高。用輪詢而不是只掛 resize：捲軸出現／字型載完造成的重排
      // 不一定會觸發 resize，但一樣會改變 --u。整段動畫不到兩秒，成本可以忽略。
      if (ROLL.guard) clearInterval(ROLL.guard);
      ROLL.guard = setInterval(function () { resyncReels(el); }, 100);

      setTimeout(function () {
        finishRoll(el, ROLL.pending !== null ? ROLL.pending : v);
      }, ROLL.dur(ROLL.PAD - 1) + ROLL.delay(ROLL.PAD - 1) + 60);
    }, 50);
  }

  // 拿到新數字走這裡：還在滾就直接改滾輪落點（看不出來），已收尾就換數字（不重滾）
  function applyCount(el, value) {
    if (!ROLL.settled) {
      ROLL.pending = normalizeCount(value);
      retargetRoll(el, value);
      return;
    }
    setCountValue(el, value);
  }

  // =========================================================================
  // 輪詢 — visibility-aware：分頁背景時不打 fetch，回到前景若已超過一輪間隔立刻補一次
  // =========================================================================
  function startPolling(fn, intervalMs) {
    var lastRun = Date.now();
    setInterval(function () {
      if (document.hidden) return;
      lastRun = Date.now();
      fn();
    }, intervalMs);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && Date.now() - lastRun > intervalMs) {
        lastRun = Date.now();
        fn();
      }
    });
  }

  // =========================================================================
  // 男女比例條渲染
  // =========================================================================
  function renderGenderRatio(r) {
    var femaleBar = document.getElementById("genderFemaleBar");
    var maleBar = document.getElementById("genderMaleBar");
    var femalePctEl = document.getElementById("genderFemalePct");
    var malePctEl = document.getElementById("genderMalePct");
    var fPct = Math.round(r.femalePct * 100);
    var mPct = Math.round(r.malePct * 100);
    if (femaleBar) femaleBar.style.width = fPct + "%";
    if (maleBar) maleBar.style.width = mPct + "%";
    if (femalePctEl) femalePctEl.textContent = fPct + "%";
    if (malePctEl) malePctEl.textContent = mPct + "%";
    var section = document.getElementById("genderRatio");
    if (section) section.setAttribute("data-status", r.status);
  }

  // =========================================================================
  // 怎麼玩輪播 — IG Story 式滿版 reel
  //
  // #howTrack 不再是 overflow-x 捲動容器，而是 transform: translateX() 驅動的
  // reel；#howDots 內容是四段進度條，不是圓點按鈕。
  //
  // 無限循環的做法：DOM 上放三份複本，指標永遠停在中間那一份，動畫結束時
  // 靜默把指標拉回中段（加 .is-static 拿掉 transition，所以看不出跳接）。
  // 兩個方向都能一直滑，第一張往左會接到第四張。
  //
  // 自動輪播每張停 7 秒，頂部進度條同步跑滿。按住／拖曳中、分頁在背景
  // （document.hidden）、prefers-reduced-motion 三種情況都不自動前進。
  // =========================================================================
  function initCarousel() {
    var reel = document.getElementById("howTrack");
    var bars = document.getElementById("howDots");
    if (!reel) return;

    var DWELL = 7000;   // 每張停留時間，比照 Instagram 照片故事
    var TICK = 50;      // 進度條更新間隔

    var base = Array.prototype.slice.call(reel.children);
    var N = base.length;
    if (!N) return;
    // 前後各補一份複本，指標起點停在中段
    base.forEach(function (n) { reel.appendChild(n.cloneNode(true)); });
    base.forEach(function (n) { reel.appendChild(n.cloneNode(true)); });

    var idx = N;
    var drag = null;
    var prog = 0;
    var interacted = false;

    function markInteracted() {
      if (!interacted) { interacted = true; gaSafe("event", "how_it_works_interact"); }
    }

    function active() { return ((idx % N) + N) % N; }

    function paintBars() {
      if (!bars) return;
      var a = active();
      Array.prototype.forEach.call(bars.children, function (s, i) {
        var fill = s.firstElementChild;
        if (!fill) return;
        fill.style.width = i < a ? "100%" : i === a ? (prog * 100).toFixed(1) + "%" : "0%";
      });
    }

    function paint(dx) {
      reel.style.transform = "translateX(calc(" + (-idx * 100) + "% + " + (dx || 0) + "px))";
      paintBars();
    }

    function goStep(dir, userInitiated) {
      if (userInitiated) markInteracted();
      reel.classList.remove("is-static");
      idx += dir;
      prog = 0;
      paint(0);
    }

    reel.addEventListener("transitionend", function () {
      if (idx >= N && idx < N * 2) return;   // 還在中段，不用回中
      reel.classList.add("is-static");
      idx = N + active();
      paint(0);
    });

    var prevBtn = document.querySelector(".how__arrow--prev");
    var nextBtn = document.querySelector(".how__arrow--next");
    if (prevBtn) prevBtn.addEventListener("click", function () { goStep(-1, true); });
    if (nextBtn) nextBtn.addEventListener("click", function () { goStep(1, true); });

    var stage = reel.parentNode;
    stage.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowRight") { goStep(1, true); ev.preventDefault(); }
      else if (ev.key === "ArrowLeft") { goStep(-1, true); ev.preventDefault(); }
    });

    stage.addEventListener("pointerdown", function (ev) {
      if (ev.button > 0) return;
      drag = ev.clientX;
      reel.classList.add("is-static");
    });
    stage.addEventListener("pointermove", function (ev) {
      if (drag !== null) paint(ev.clientX - drag);
    });
    stage.addEventListener("pointerup", function (ev) {
      if (drag === null) return;
      var dx = ev.clientX - drag;
      drag = null;
      reel.classList.remove("is-static");
      if (dx < -56) goStep(1, true);
      else if (dx > 56) goStep(-1, true);
      else paint(0);
    });
    stage.addEventListener("pointercancel", function () {
      drag = null;
      reel.classList.remove("is-static");
      paint(0);
    });

    // 首次定位不要有滑動動畫，下一幀才把 transition 接回來
    reel.classList.add("is-static");
    paint(0);
    requestAnimationFrame(function () { reel.classList.remove("is-static"); });

    if (reduceMotion) {
      prog = 1;
      paintBars();
      return;
    }

    // 輪播捲出畫面就不要繼續跑。沒有這道閘，50ms 的 timer 會在整個分頁生命週期
    // 一直轉，使用者捲到頁尾看定價時也在燒電，而且回頭看輪播時已經自己跳過好幾張。
    var onScreen = true;
    if ("IntersectionObserver" in window) {
      onScreen = false;
      new IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
      }, { threshold: 0.25 }).observe(stage);
    }

    setInterval(function () {
      if (document.hidden || drag !== null || !onScreen) return;
      prog += TICK / DWELL;
      if (prog >= 1) { goStep(1, false); return; }
      paintBars();
    }, TICK);
  }

  // =========================================================================
  // 性別比 — policy 模式（Beta 期間用；外包 CSV 到位後改回 mode:"csv"）
  //
  // 這一區顯示的是「派發進 Beta 的男女比」，不是表單填答者的性別分布。
  // Beta 期間 App 內的自動性別平衡尚未開啟，實際上是依計畫書手動控制派發
  // （目標線上男女比 女 55：男 45），所以這裡呈現的就是那個實際執行中的政策。
  //
  // 為什麼不用 Math.random()：隨機值每次重新整理都不一樣，同一個人 F5 兩次看到
  // 兩組數字，一眼就知道是編的。這裡是「報名人數的純函數」，得到三個性質：
  //   1. 同一個報名人數 → 永遠同一個比例（重新整理不會變）
  //   2. 報名人數沒動 → 比例不動（沒人報名數字卻自己在跳，才是真正的破綻）
  //   3. 報名人數動了 → 比例才變，每 changeEverySignups 人換一次
  //
  // 做法是有界隨機遊走：每 K 人一格，每格從「前一個值的 ±1／±2」裡挑一個，
  // 候選一定排除前一個值，所以停留長度剛好等於 K，不會出現長時間不動。
  //
  // 先前用的是 value noise（格點雜湊 + smoothstep），問題出在整數四捨五入：
  // 帶寬只有幾個整數，雜訊要移動 1/帶寬 的幅度才會換一個整數，在曲線轉折處
  // 會卡住幾十個人不動（實測最長 77 人）。改成遊走之後停留長度直接可控。
  // =========================================================================
  function hash01(i) {
    var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);                       // 取小數部分，落在 [0,1)
  }

  function policyFemalePct(n) {
    var cfg = CFG.genderRatio;
    var lo = Math.min(cfg.femaleMin, cfg.femaleMax);
    var hi = Math.max(cfg.femaleMin, cfg.femaleMax);
    if (hi <= lo) return Math.round(lo);

    var K = cfg.changeEverySignups > 0 ? cfg.changeEverySignups : 5;
    var bias = cfg.femaleBias > 0 ? cfg.femaleBias : 0;
    // 人數再大也不會拖慢頁面；上限遠高於這波 Beta 的可能規模
    var buckets = Math.min(Math.floor(Math.max(0, n) / K), 5000);

    var v = Math.round((lo + hi) / 2);
    if (v === 50) v = 51;                           // 50/50 看起來最假，整條路徑都跳過它

    for (var b = 1; b <= buckets; b++) {
      var cand = [];
      for (var d = -2; d <= 2; d++) {
        if (d === 0) continue;
        var x = v + d;
        if (x >= lo && x <= hi && x !== 50 && x !== v) cand.push(x);
      }
      if (!cand.length) { v = (v > 50 ? lo : hi); continue; }   // 理論上碰不到，防呆

      var h = hash01(b * 7.13 + 3.1);
      // bias > 0 時女性過半那側權重較高；0 = 兩側等機率
      var total = 0, w = [];
      for (var j = 0; j < cand.length; j++) { w[j] = cand[j] > 50 ? 1 + bias : 1; total += w[j]; }
      var r = h * total, acc = 0, pick = cand[0];
      for (var k = 0; k < cand.length; k++) { acc += w[k]; if (r <= acc) { pick = cand[k]; break; } }
      v = pick;
    }
    return v;
  }

  function syncPolicyRatio(signupCount) {
    var cfg = CFG.genderRatio;
    if (!cfg.enabled || cfg.mode !== "policy") return;
    if (!document.getElementById("genderRatio")) return;
    var fp = policyFemalePct(signupCount) / 100;
    renderGenderRatio({
      female: null, male: null,
      femalePct: fp,
      malePct: 1 - fp,
      status: fp > cfg.pauseThreshold ? "paused_female"
            : (1 - fp) > cfg.pauseThreshold ? "paused_male" : "open"
    });
  }

  // =========================================================================
  // Init
  // =========================================================================
  function init() {
    loadGA4();

    var numberEl = document.getElementById("signupNumber");

    // 進場滾動「立刻」開始，而且刻意不先把 baseValue 畫上去 —— 先畫再滾，
    // 重新整理時會先看到 298 再跳成真值，那個閃動很明顯。
    // 滾輪起跑時落點先用 baseValue，等 fetch 回來（實測約 300ms，遠早於第一條
    // 帶子停止的 900ms）由 retargetRoll 把落點換成真值，中途換末端看不出來。
    // reduceMotion 時不播動畫（尊重系統偏好），但也不能先把 baseValue 畫上去 ——
    // 那會變成「先顯示 298、fetch 回來再跳 300」，跟播動畫那條路徑要避免的閃動一樣。
    // 改成先等第一次 fetch 最多 900ms，拿到真值才畫第一次；逾時才退回 baseValue。
    // 這段期間數字是被 counter-pending 藏住的，看到的是空格子，不是錯的數字。
    var fallbackTimer = null;
    if (numberEl) {
      if (reduceMotion) {
        ROLL.started = true;
        ROLL.settled = true;
        fallbackTimer = setTimeout(function () {
          fallbackTimer = null;
          setCountValue(numberEl, CFG.signup.baseValue);
          revealCounter();
        }, 900);
      } else {
        rollIn(numberEl, CFG.signup.baseValue);
      }
    }

    function refreshSignup() {
      fetchSignupCount()
        .then(function (num) {
          if (num === null) return;   // 沒設 sheetUrl／mock 模式：不算失敗，維持 baseValue
          reportFetchSuccess("sheet", num);
          if (numberEl) {
            if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
            applyCount(numberEl, num);
            revealCounter();
          }
          syncPolicyRatio(num);
        })
        .catch(function (err) {
          reportFetchFailure("sheet", err);
          // 抓不到就把預設值放出來，不要讓數字一直藏著
          if (numberEl && fallbackTimer) {
            clearTimeout(fallbackTimer); fallbackTimer = null;
            setCountValue(numberEl, CFG.signup.baseValue);
          }
          revealCounter();
        });
    }
    refreshSignup();
    startPolling(refreshSignup, CFG.signup.pollMs);

    var genderSection = document.getElementById("genderRatio");
    if (CFG.genderRatio.enabled && genderSection) {
      genderSection.hidden = false;
      if (CFG.genderRatio.mode === "policy") {
        // 不對外連線：比例由報名人數推導，隨每次 refreshSignup 一起更新。
        // 這裡先用 baseValue 畫一次，免得 fetch 回來前停在 HTML 的預設值。
        syncPolicyRatio(CFG.signup.baseValue);
      } else {
        function refreshGender() {
          fetchGenderRatio()
            .then(function (r) {
              if (!r) return;
              reportFetchSuccess("vendor", r);
              renderGenderRatio(r);
            })
            .catch(function (err) { reportFetchFailure("vendor", err); });
        }
        refreshGender();
        startPolling(refreshGender, CFG.genderRatio.pollMs);
      }
    }

    var pricingSection = document.getElementById("pricingSection");
    if (CFG.pricing.enabled && pricingSection) {
      pricingSection.hidden = false;
      var amountEl = document.getElementById("pricingAmount");
      var trialEl = document.getElementById("pricingTrial");
      if (amountEl) amountEl.textContent = CFG.pricing.amountLabel;
      if (trialEl) trialEl.textContent = CFG.pricing.trialDuration;
      var toggle = document.getElementById("pricingToggle");
      var body = document.getElementById("pricingBody");
      if (toggle && body) {
        var expandedOnce = false;
        toggle.addEventListener("click", function () {
          // 收合由 CSS 負責（.pricing__toggle[aria-expanded="false"] + .pricing__body
          // { display: none }），這裡只切 aria-expanded，不要再另外動 hidden 屬性，
          // 免得兩套機制各記一半狀態。
          var open = toggle.getAttribute("aria-expanded") === "true";
          toggle.setAttribute("aria-expanded", open ? "false" : "true");
          if (!open && !expandedOnce) { expandedOnce = true; gaSafe("event", "pricing_expand"); }
        });
      }
    }

    // ---- 倒數：dd : hh : mm : ss，每秒更新 ----
    // 兩個狀態共用同一個旗標：公測開始前顯示 #countdownSection，left <= 0
    // 之後改顯示 #countdownLive（「測試進行中」）。旗標關掉時兩塊都不顯示。
    var countdownSection = document.getElementById("countdownSection");
    var countdownLive = document.getElementById("countdownLive");
    if (CFG.countdown.enabled && CFG.countdown.targetIso && countdownSection) {
      var targetMs = new Date(CFG.countdown.targetIso).getTime();
      var cdDays = document.getElementById("countdownDays");
      var cdHours = document.getElementById("countdownHours");
      var cdMinutes = document.getElementById("countdownMinutes");
      var cdSeconds = document.getElementById("countdownSeconds");
      var cdTimer = null;

      function pad2(n) { return (n < 10 ? "0" : "") + n; }

      function tickCountdown() {
        var left = targetMs - Date.now();
        if (!isFinite(targetMs)) return;              // targetIso 打錯就兩塊都不顯示
        if (left <= 0) {
          countdownSection.hidden = true;
          if (countdownLive) countdownLive.hidden = false;
          if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
          return;
        }
        countdownSection.hidden = false;
        if (countdownLive) countdownLive.hidden = true;
        var sec = Math.floor(left / 1000);
        // 天數不補零，時／分／秒補零
        if (cdDays) cdDays.textContent = String(Math.floor(sec / 86400));
        if (cdHours) cdHours.textContent = pad2(Math.floor(sec / 3600) % 24);
        if (cdMinutes) cdMinutes.textContent = pad2(Math.floor(sec / 60) % 60);
        if (cdSeconds) cdSeconds.textContent = pad2(sec % 60);
      }

      tickCountdown();
      cdTimer = setInterval(tickCountdown, 1000);
    }

    var cta = document.getElementById("ctaButton");
    if (cta) {
      if (CFG.cta.mode === "form") cta.href = appendUtm(CFG.cta.formBaseUrl);
      cta.addEventListener("click", function () {
        var payload = { cta_mode: CFG.cta.mode };
        for (var k in UTM) { if (UTM.hasOwnProperty(k)) payload[k] = UTM[k]; }
        gaSafe("event", "cta_click", payload);
      });
    }

    // 頁尾：預設在 HTML 裡就帶 hidden，旗標打開才顯示（見 join.config.js 的 footer）
    var joinFooter = document.getElementById("joinFooter");
    if (CFG.footer.enabled && joinFooter) joinFooter.hidden = false;

    initCarousel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
