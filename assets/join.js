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
  // 報名人數計數動畫 — 取消前一個動畫、從目前顯示值算起、reduced-motion 直接跳終值
  // =========================================================================
  var countAnim = { raf: null, from: CFG.signup.baseValue };

  function formatNumber(n) {
    if (CFG.signup.round === "floor") n = Math.floor(n);
    try { return n.toLocaleString("zh-TW"); } catch (e) { return String(n); }
  }

  function animateCountTo(el, target) {
    if (countAnim.raf) { cancelAnimationFrame(countAnim.raf); countAnim.raf = null; }
    if (reduceMotion) {
      el.textContent = formatNumber(target);
      countAnim.from = target;
      return;
    }
    var from = countAnim.from;
    var start = null;
    var duration = 700;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatNumber(from + (target - from) * eased);
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
  // 輪播 — scroll-snap 原生手勢／滑鼠拖曳；本檔只負責箭頭、圓點、IO 對位、事件
  // =========================================================================
  function initCarousel() {
    var track = document.getElementById("howTrack");
    var dotsWrap = document.getElementById("howDots");
    if (!track || !dotsWrap) return;

    var slides = Array.prototype.slice.call(track.querySelectorAll(".how__slide"));
    var dots = Array.prototype.slice.call(dotsWrap.querySelectorAll("button"));
    var current = 0;
    var interacted = false;

    function markInteracted() {
      if (!interacted) { interacted = true; gaSafe("event", "how_it_works_interact"); }
    }

    function setActive(i) {
      current = i;
      for (var d = 0; d < dots.length; d++) {
        var active = d === i;
        dots[d].setAttribute("aria-current", active ? "true" : "false");
        if (active) dots[d].classList.add("is-active"); else dots[d].classList.remove("is-active");
      }
    }

    // 只動輪播容器自己的水平捲軸。不要用 scrollIntoView——即使給 block:"nearest"，
    // 當投影片比視窗高（手機上就是這樣）瀏覽器仍會連帶垂直捲動整個頁面，
    // 載入當下就把品牌／slogan 推出首屏，違反「首屏四元素免捲動」的硬限制。
    function centerSlide(i, smooth) {
      var target = slides[i];
      if (!target) return;
      var tRect = track.getBoundingClientRect();
      var sRect = target.getBoundingClientRect();
      var left = track.scrollLeft + (sRect.left - tRect.left) - (tRect.width - sRect.width) / 2;
      if (track.scrollTo) {
        track.scrollTo({ left: left, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
      } else {
        track.scrollLeft = left;
      }
    }

    function goTo(i, userInitiated) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      if (userInitiated) markInteracted();
      centerSlide(i, true);
      setActive(i);
    }

    for (var i = 0; i < dots.length; i++) {
      (function (idx) {
        dots[idx].addEventListener("click", function () { goTo(idx, true); });
      })(i);
    }

    var prevBtn = document.querySelector(".how__arrow--prev");
    var nextBtn = document.querySelector(".how__arrow--next");
    if (prevBtn) prevBtn.addEventListener("click", function () { goTo(current - 1, true); });
    if (nextBtn) nextBtn.addEventListener("click", function () { goTo(current + 1, true); });

    track.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowRight") { goTo(current + 1, true); ev.preventDefault(); }
      else if (ev.key === "ArrowLeft") { goTo(current - 1, true); ev.preventDefault(); }
    });

    track.addEventListener("touchstart", markInteracted, { passive: true, once: true });
    track.addEventListener("wheel", markInteracted, { passive: true, once: true });

    if ("IntersectionObserver" in window) {
      // 記每張圖目前的可見比例，取「最高」那張當作 active，不是「最後一個
      // callback 剛好回報誰」——寬螢幕桌機一次可以看到 2-3 張，只看最後一筆
      // 容易選到不是視覺上最主要的那張。
      var ratios = new Array(slides.length).fill(0);
      var io = new IntersectionObserver(function (entries) {
        for (var e = 0; e < entries.length; e++) {
          var idx = slides.indexOf(entries[e].target);
          if (idx !== -1) ratios[idx] = entries[e].isIntersecting ? entries[e].intersectionRatio : 0;
        }
        var best = 0;
        for (var r = 1; r < ratios.length; r++) { if (ratios[r] > ratios[best]) best = r; }
        if (ratios[best] > 0) setActive(best);
      }, { root: track, threshold: [0, 0.25, 0.5, 0.6, 0.75, 0.9, 1] });
      for (var s = 0; s < slides.length; s++) io.observe(slides[s]);
    }

    // 初始定位交給 JS 明確對齊（不依賴瀏覽器在 scrollLeft:0 時是否已套用
    // scroll-snap-align:center——實測不同瀏覽器在載入當下對這點行為不一致，
    // 明確對齊一次才能保證兩側露邊在首次載入就對稱、可靠）。
    centerSlide(0, false);
    setActive(0);
  }

  // =========================================================================
  // Init
  // =========================================================================
  function init() {
    loadGA4();

    var numberEl = document.getElementById("signupNumber");
    if (numberEl) numberEl.textContent = formatNumber(CFG.signup.baseValue);

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
          var open = toggle.getAttribute("aria-expanded") === "true";
          toggle.setAttribute("aria-expanded", open ? "false" : "true");
          body.hidden = open;
          if (!open && !expandedOnce) { expandedOnce = true; gaSafe("event", "pricing_expand"); }
        });
      }
    }

    var countdownSection = document.getElementById("countdownSection");
    if (CFG.countdown.enabled && CFG.countdown.targetIso && countdownSection) {
      countdownSection.hidden = false;
      var daysEl = document.getElementById("countdownDays");
      function tickCountdown() {
        var diff = new Date(CFG.countdown.targetIso).getTime() - Date.now();
        var days = Math.max(0, Math.ceil(diff / 86400000));
        if (daysEl) daysEl.textContent = String(days);
      }
      tickCountdown();
      setInterval(tickCountdown, 60000);
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
