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
    signup: { mode: "mock", baseValue: 298, label: "報名人數", round: "floor", sheetUrl: null, pollMs: 600000 },
    genderRatio: { enabled: false, csvUrl: null, pauseThreshold: 0.55, pollMs: 600000 },
    pricing: { enabled: false, amountLabel: "NT$240", trialDuration: "30 天" },
    countdown: { enabled: false, targetIso: null },
    cta: { mode: "form", formBaseUrl: "https://forms.gle/oKRJeB39md3gFTvH9", iosUrl: null, androidUrl: null },
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

  window.__JOIN_DEBUG__ = { config: CFG, lastGoodFetch: {}, lastError: {} };

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

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
  var countAnim = { raf: null, from: CFG.signup.baseValue };

  function normalizeCount(n) {
    if (CFG.signup.round === "floor") n = Math.floor(n);
    return Math.max(0, n);
  }

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
    el.setAttribute("data-value", String(normalizeCount(value)));
  }

  function animateCountTo(el, target) {
    if (countAnim.raf) { cancelAnimationFrame(countAnim.raf); countAnim.raf = null; }
    if (reduceMotion) {
      paintOdometer(el, target);
      countAnim.from = target;
      return;
    }
    var from = countAnim.from;
    var start = null;
    var duration = 900;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      paintOdometer(el, from + (target - from) * eased);
      if (p < 1) {
        countAnim.raf = requestAnimationFrame(step);
      } else {
        countAnim.from = target;
        countAnim.raf = null;
      }
    }
    countAnim.raf = requestAnimationFrame(step);
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
    setInterval(function () {
      if (document.hidden || drag !== null) return;
      prog += TICK / DWELL;
      if (prog >= 1) { goStep(1, false); return; }
      paintBars();
    }, TICK);
  }

  // =========================================================================
  // Init
  // =========================================================================
  function init() {
    loadGA4();

    var numberEl = document.getElementById("signupNumber");
    if (numberEl) paintOdometer(numberEl, CFG.signup.baseValue);

    function refreshSignup() {
      fetchSignupCount()
        .then(function (num) {
          if (num === null) return;
          reportFetchSuccess("sheet", num);
          if (numberEl) animateCountTo(numberEl, num);
        })
        .catch(function (err) { reportFetchFailure("sheet", err); });
    }
    refreshSignup();
    startPolling(refreshSignup, CFG.signup.pollMs);

    var genderSection = document.getElementById("genderRatio");
    if (CFG.genderRatio.enabled && genderSection) {
      genderSection.hidden = false;
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

    initCarousel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
