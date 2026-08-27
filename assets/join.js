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
    genderRatio: { enabled: false, mode: "policy", steps: null, femaleMin: 53, femaleMax: 55, changeEverySignups: 5, femaleBias: 1.0, csvUrl: null, pauseThreshold: 0.55, pollMs: 600000 },
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

  // =========================================================================
  // 上次抓到的人數 — localStorage 暫存
  //
  // 抓 Sheet 失敗時（網路瞬斷、Google 偶發 5xx、行動網路切換）原本會掉回
  // join.config.js 的 baseValue。那個值是 Sheet B2 的「起算值」，隨著報名累積
  // 會離真實數字愈來愈遠 —— 2026-08-22 實際發生過一次：真值 310，訪客看到 113。
  // 所以改成優先用「這個瀏覽器上次抓到的真值」，沒有才退回 baseValue。
  //
  // 進場滾動的落點與抓失敗時的顯示值都會用到它（成功路徑會把真值寫回去）。
  // localStorage 在 Safari
  // 無痕模式、webview 停用儲存等情況會直接 throw，所以每個存取都包 try/catch，
  // 失敗就當作沒有快取（退回 baseValue），不能讓它把整頁弄掛。
  // =========================================================================
  // key 綁 sheet id：換統計表（或改起算值口徑）之後，舊瀏覽器上的舊數字自動失效，
  // 不需要也沒辦法遠端清掉別人的 localStorage。
  var COUNT_CACHE_KEY = "th_join_signup_count:" + (extractSheetId(CFG.signup.sheetUrl) || "none");
  // 24 小時。這個值只需要撐過「一次網路抖動到下一次成功輪詢」，量級是分鐘；
  // 放太久的壞處是統計口徑改了之後有人還在看舊數字。
  var COUNT_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

  // 判定失效就順手刪掉，免得除錯時看到一個永遠對不上的殘值
  function dropCache() {
    try { window.localStorage.removeItem(COUNT_CACHE_KEY); } catch (e) {}
    return null;
  }

  function readCachedCount() {
    try {
      var raw = window.localStorage.getItem(COUNT_CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      var v = Number(obj && obj.v), t = Number(obj && obj.t);
      // 上界：計數器只有五格，超過五位數就不是真實報名數（多半是有人自己改了
      // localStorage）。放行的話 aria-label 會念出七位數、滾輪卻只顯示後五位，兩邊對不上。
      if (!isFinite(v) || v <= 0 || v > 99999) return dropCache();
      if (!isFinite(t)) return dropCache();
      var age = Date.now() - t;
      // age 為負 = 時間戳在未來（使用者調過系統時鐘）。不擋的話永遠不會過期。
      if (age > COUNT_CACHE_MAX_AGE || age < -60000) return dropCache();
      return Math.floor(v);
    } catch (e) { return dropCache(); }   // 連 JSON 都不是（或 localStorage 讀不到）
  }

  function writeCachedCount(n) {
    if (!isFinite(n) || n <= 0) return;     // 0／負數不進快取，免得把好值洗掉
    try { window.localStorage.setItem(COUNT_CACHE_KEY, JSON.stringify({ v: Math.floor(n), t: Date.now() })); }
    catch (e) { /* 存不了就算了，只是少一層保險 */ }
  }

  // 抓不到時要顯示什麼：上次的真值優先，沒有才用設定檔的 baseValue。
  // mock 模式與「還沒填 sheetUrl」不吃快取 —— join.config.js 對 mock 的定義是
  // 「只顯示 baseValue、完全不對外連線」，讓回訪者看到快取的真值會違反那個契約。
  function fallbackCount() {
    if (CFG.signup.mode !== "sheet" || !CFG.signup.sheetUrl) return CFG.signup.baseValue;
    var c = readCachedCount();
    window.__JOIN_DEBUG__.cachedCount = c;
    // 取大的：報名數只增不減，而 baseValue 現在會跟著重截分享卡對齊當下真值
    // （tools/build-og-image.sh）。快取若比它舊，用 baseValue 反而更接近真實。
    return c === null ? CFG.signup.baseValue : Math.max(c, CFG.signup.baseValue);
  }

  // 逾時：行動網路下 fetch 可以懸掛數十秒到數分鐘。沒有上限的話，in-flight 旗標會
  // 一直是 true，輪詢／online／回到前景三條補抓路徑全部被吞掉，畫面凍在後備值。
  var FETCH_TIMEOUT_MS = 8000;

  function fetchSignupCount() {
    if (CFG.signup.mode !== "sheet") return Promise.resolve(null);
    // fetch 不存在（很舊的 WebView）時直接當作「沒有資料源」，不要同步丟例外 ——
    // 這支是在 init() 裡呼叫的，丟出去會讓後面的輪播、倒數、CTA 全部沒註冊。
    if (typeof fetch !== "function") return Promise.resolve(null);
    var id = extractSheetId(CFG.signup.sheetUrl);
    if (!id) return Promise.resolve(null); // 網址還沒填，維持 baseValue，不算錯誤
    var url = "https://docs.google.com/spreadsheets/d/" + id + "/gviz/tq?tqx=out:json&range=B1&t=" + Date.now();

    var ctrl = null, timer = null, opts = { cache: "no-store" };
    if (typeof AbortController === "function") {
      ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    }
    function done(v) { if (timer) { clearTimeout(timer); timer = null; } return v; }

    var req = fetch(url, opts);
    // 沒有 AbortController 的瀏覽器（舊 Safari／舊 Android WebView）用 Promise.race
    // 補一個逾時。請求本身取消不掉，但至少 promise 會 settle，旗標不會卡死。
    if (!ctrl) {
      req = Promise.race([req, new Promise(function (_, reject) {
        timer = setTimeout(function () { reject(new Error("sheet: 逾時 " + FETCH_TIMEOUT_MS + "ms")); }, FETCH_TIMEOUT_MS);
      })]);
    }

    return req
      .then(function (res) {
        if (!res.ok) {
          var e = new Error("sheet http " + res.status);
          // 4xx（429 除外）是永久性錯誤：表被刪、權限被收回、網址打錯。
          // 重試只是白打，而且每次都帶 t= 破快取，中間層無法去重。
          e.permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
          throw e;
        }
        return res.text();
      })
      .then(function (text) {
        var data = parseGvizResponse(text);
        var row = data.table && data.table.rows && data.table.rows[0];
        var cell = row && row.c && row.c[0];
        var val = cell ? cell.v : null;
        // B1 空白時 gviz 會回 null。Number(null) 是 0 而且 isFinite(0) 為真，
        // 放過去就會被當成「抓到 0 人」：畫面顯示 00000，還會把好的快取覆蓋掉。
        // IMPORTRANGE 重算期間就可能短暫回空值，所以這裡當成錯誤、走重試。
        if (val === null || val === undefined || val === "") throw new Error("sheet: B1 是空的");
        var num = Number(val);
        if (!isFinite(num)) throw new Error("sheet: B1 not numeric (" + val + ")");
        if (num <= 0) throw new Error("sheet: B1 不是正數 (" + num + ")");
        return num;
      })
      .then(done, function (err) { done(); throw err; });
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
    // 男性不各自四捨五入，從女性推導 —— 兩邊各自進位時（真實比例剛好落在 x.5，
    // 例如 男101/女99）會顯示 女50% + 男51% = 101%，下面兩條 bar 的寬度也會加起來
    // 溢出 100%。policy 模式碰不到（那邊 malePct 本來就是 1 - femalePct，加總必然
    // 100），是 csv 模式才會中的坑，先在這裡擋掉。
    // hasData：csv 模式 total=0 時兩邊都是 0（見 fetchGenderRatio），這種情況要維持
    // 0/0，不能推導成男性 100%。前提是兩邊都是 number —— 目前兩個資料源都保證是
    // （policy 自己算的、csv 在 fetchGenderRatio 有 isFinite 擋），將來若新增第三個
    // 來源（例如把後端 JSON 原樣丟進來）要自己確保型別，字串會讓這個判斷式失效。
    //
    // 誤差方向是刻意的：女性先四捨五入，男性吸收全部誤差。Math.round 半數進位，
    // 所以真實比例剛好落在 x.5 時永遠倒向女性。policy 模式的 51–53 帶寬碰不到 .5，
    // 但 csv 模式上線後會 —— 屆時若不想固定偏女性，要改成大的那邊優先進位。
    var hasData = (r.femalePct + r.malePct) > 0;
    var fPct = Math.round(r.femalePct * 100);
    var mPct = hasData ? 100 - fPct : 0;
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
  // （目標線上男女比 女 55：男 45）。
  // ⚠️ 2026-08-26 起 join.config.js 用 genderRatio.steps 階梯表指定顯示值，畫面顯示的是
  //    人工寫死的固定值，**不是**派發政策也不是從它推導的。下面整段遊走說明在
  //    femaleMin === femaleMax 時完全不會執行（policyFemalePct 開頭就早退）。
  //
  // 為什麼不用 Math.random()：隨機值每次重新整理都不一樣，同一個人 F5 兩次看到
  // 兩組數字，一眼就知道是編的。這裡是「報名人數的純函數」，得到三個性質：
  //   1. 同一個報名人數 → 永遠同一個比例（重新整理不會變）
  //   2. 報名人數沒動 → 比例不動（沒人報名數字卻自己在跳，才是真正的破綻）
  //   3. 報名人數動了 → 比例才變，每 changeEverySignups 人換一次
  // ⚠️ 上面三點只在浮動模式成立。femaleMin === femaleMax 時比例是常數，
  //    報名人數再怎麼動都不會變 —— 那是刻意的，不是壞掉。
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

    // ---- 階梯表（genderRatio.steps）----
    // 有設就完全接管，femaleMin/femaleMax/changeEverySignups/femaleBias 全部不生效。
    // 格式 [[報名人數門檻, 女性百分比], ...]，由小到大。取「最後一個門檻 <= n」的百分比；
    // n 小於第一個門檻就用第一筆，n 超過最後一個門檻就停在最後一筆。
    // 輸出夾在 0~100，壞資料（非陣列、非數字、NaN）一律略過該筆而不是讓畫面壞掉。
    var steps = cfg.steps;
    if (steps && steps.length) {
      var nv = Math.floor(Number(n));
      if (!isFinite(nv) || nv < 0) nv = 0;
      var pct = null;
      for (var si = 0; si < steps.length; si++) {
        var st = steps[si];
        if (!st || st.length < 2) continue;
        var at = Number(st[0]), val = Number(st[1]);
        if (!isFinite(at) || !isFinite(val)) continue;
        if (pct === null) pct = val;              // 第一筆有效值當作下限前的預設
        if (nv >= at) pct = val;
      }
      if (pct !== null) return Math.max(0, Math.min(100, Math.round(pct)));
      // 全部都是壞資料就往下走原本的邏輯
    }

    var lo = Math.min(cfg.femaleMin, cfg.femaleMax);
    var hi = Math.max(cfg.femaleMin, cfg.femaleMax);
    if (hi <= lo) return Math.max(0, Math.min(100, Math.round(lo)));

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
    // 滾輪起跑時落點先用後備值（上次抓到的真值優先，見 fallbackCount），等 fetch 回來（實測約 300ms，遠早於第一條
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
          setCountValue(numberEl, fallbackCount());
          revealCounter();
        }, 900);
      } else {
        rollIn(numberEl, fallbackCount());
      }
    }

    // 抓失敗後的退避重試。輪詢間隔是 10 分鐘，沒有重試的話一次 0.5 秒的網路抖動
    // 會讓訪客盯著錯的數字看十分鐘（2026-08-22 就發生過）。首次 + 三次重試共四次
    // 嘗試，都失敗才認輸；認輸也只是維持畫面上的後備值，下一輪輪詢照樣會再試。
    //
    // 第一次重試刻意壓在 800ms（jitter 後 560~1040ms）—— 進場滾動約 2010ms 才收尾，
    // 這之前抵達的值會透過 retargetRoll 換落點，看不出來。但這只在第一次嘗試「很快
    // 就失敗」時成立；若它是走滿 8 秒逾時才失敗，重試會落在滾動收尾之後，數字就會
    // 像每次輪詢更新一樣直接換（既有行為，不是新的閃動）。
    //
    // 抖動：三個寫死的常數會讓所有分頁在 Google 真的 5xx 時同步重打，典型的
    // thundering herd。±30% 隨機化把它們錯開。
    var RETRY_DELAYS = [800, 2500, 6000];
    var retryAt = 0;
    var retryTimer = null;
    var inFlight = false;

    var waitingForeground = false;

    // 回到前景就補跑。不能靠 startPolling 那條 visibilitychange —— 它要求距離上次
    // 執行超過一整個輪詢間隔（10 分鐘）才補，切出去三十秒再回來是不會動的。
    function resumeOnForeground() {
      if (waitingForeground) return;
      waitingForeground = true;
      document.addEventListener("visibilitychange", function onVis() {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", onVis);
        waitingForeground = false;
        refreshSignup(true);      // 用重試身分呼叫，保留剩下的重試額度
      });
    }

    function scheduleRetry() {
      if (retryAt >= RETRY_DELAYS.length) return;
      var base = RETRY_DELAYS[retryAt++];
      var wait = Math.round(base * (0.7 + Math.random() * 0.6));
      if (retryTimer) clearTimeout(retryTimer);        // 一定先清，不要覆寫掉 handle
      retryTimer = setTimeout(function () {
        retryTimer = null;
        // 背景分頁不對外連線（startPolling 也是這個規矩）。額度要還回去，
        // 否則從 IG／Threads 點進來又立刻切回 App 的人，三次重試會被靜默吃光，
        // 然後要等十分鐘才有下一次機會。
        if (document.hidden) { retryAt--; resumeOnForeground(); return; }
        refreshSignup(true);
      }, wait);
    }

    function refreshSignup(isRetry) {
      // in-flight 檢查要在最前面：被擋下的那次如果先跑了下面的歸零，等於把待命中的
      // 重試 timer 清掉、退避重來，然後什麼事都沒做。
      if (inFlight) return;
      // 輪詢觸發的那一次要把重試狀態歸零。清得掉排程中的 timer，但清不掉已經發出去
      // 的 fetch；那條由 inFlight 擋住後來的呼叫，代價是輪詢 tick 最長會被吞掉一個
      // 逾時的時間（8 秒）。
      if (!isRetry) {
        retryAt = 0;
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      }
      inFlight = true;
      fetchSignupCount()
        .then(function (num) {
          inFlight = false;
          if (num === null) return;   // 沒設 sheetUrl／mock 模式：不算失敗，維持 baseValue
          retryAt = 0;
          reportFetchSuccess("sheet", num);
          writeCachedCount(num);      // 存起來當下次抓失敗時的後備值
          // 渲染錯誤不能走到下面的失敗處理 —— 那會把一個畫面 bug 回報成
          // data_fetch_error 送進 GA4，還白白觸發三次網路重試。
          try {
            if (numberEl) {
              if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
              applyCount(numberEl, num);
              revealCounter();
            }
            syncPolicyRatio(num);
          } catch (e) {
            if (window.console && console.error) console.error("[join] render failed:", e);
          }
        }, function (err) {
          inFlight = false;
          reportFetchFailure("sheet", err);
          // 先把後備值放出來（上次抓到的真值優先，沒有才用 baseValue），不要讓數字
          // 一直藏著；同時在背景退避重試，其中一次成功就會直接換成真值。
          if (numberEl && fallbackTimer) {
            clearTimeout(fallbackTimer); fallbackTimer = null;
            setCountValue(numberEl, fallbackCount());
          }
          revealCounter();
          if (!err || !err.permanent) scheduleRetry();
        });
    }
    refreshSignup();
    startPolling(refreshSignup, CFG.signup.pollMs);

    // 重試最快十秒左右用完（每次都走滿 8 秒逾時的話約 40 秒），之後要等下一輪輪詢
    // （10 分鐘）。手機切 Wi-Fi／4G、進電梯、搭捷運的斷線都比這久，恢復連線後不補抓
    // 的話，首次造訪者會盯著後備值看最久十分鐘 —— 正是這次要解決的症狀。
    //
    // debounce：網路 flapping 時 online 會連發，每次都把重試額度歸零，退避就永遠
    // 長不起來，變成約一秒一次的熱迴圈。兩秒內只吃一次，並加一點隨機延遲，
    // 免得多個分頁在同一瞬間一起重打。
    var lastOnlineAt = 0;
    window.addEventListener("online", function () {
      var now = Date.now();
      if (now - lastOnlineAt < 2000) return;
      lastOnlineAt = now;
      setTimeout(function () { refreshSignup(); }, Math.round(Math.random() * 400));
    });

    var genderSection = document.getElementById("genderRatio");
    if (CFG.genderRatio.enabled && genderSection) {
      genderSection.hidden = false;
      if (CFG.genderRatio.mode === "policy") {
        // 不對外連線：比例由報名人數推導，隨每次 refreshSignup 一起更新。
        // 這裡先用後備值畫一次，免得 fetch 回來前停在 HTML 的預設值。
        syncPolicyRatio(fallbackCount());
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
