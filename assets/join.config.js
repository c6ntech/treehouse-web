/* =========================================================================
   Treehouse /join — 可調設定檔（非工程背景可直接改這裡的值）

   改完存檔即生效。JOIN_CONFIG 要維持合法 JavaScript 語法（字串記得用引號包好、
   逗號別漏）——打錯一個地方會讓整支檔案讀取失敗，join.js 會退回內建預設值，
   不會讓整頁掛掉，但你的修改也不會生效。建議改完後重新整理頁面，確認畫面數字
   有跟著變再關掉分頁。
   ========================================================================= */
window.JOIN_CONFIG = {

  // ---- 報名人數看板 ----
  signup: {
    mode: "sheet",           // "sheet" = 讀 Google Sheet 即時值（正式模式）。"mock" = 只顯示 baseValue，完全不對外連線
    // 只是後備值：mode:"mock" 時的顯示值，或 mode:"sheet" 抓取失敗時的最後防線。
    // 正常情況畫面上的數字來自下面那份 Sheet 的 B1，不是這裡。
    // 要調整起算人數請改 Sheet 的 B2（起算值），不要改這裡 —— 這裡跟著對齊就好，
    // 免得抓取失敗時掉回一個跟 Sheet 差很多的數字。
    baseValue: 113,
    round: "floor",             // "floor" 無條件捨去到整數；"none" 不處理（Sheet 應該本來就是整數）

    // ⚠️ 這份試算表會被公開讀取（Google 的 gviz 端點要求整份表可公開存取）。
    // 絕對不可以換成表單回應原始試算表的網址 —— 那份含報名者 IG ID、性別、年齡，
    // 一旦被公開讀取就是個資外洩。
    //
    // 目前填的是專用的「for Web Stats」儀表板表：整份只有 A1:B3 三列
    //    （signup_count / 起算值 / 新表單報名數），B1 是頁面實際讀的那一格。
    //    新表單報名數由 IMPORTRANGE 從私有的表單回應表拉「已算好的一個數字」進來，
    //    公開的這份不含任何個資。共用權限必須維持「知道連結的任何人 → 檢視者」，
    //    給到編輯者的話別人可以自己寫 IMPORTRANGE 把私有表整包拉出來。
    sheetUrl: "https://docs.google.com/spreadsheets/d/105ymHSvKcdbQ33xiKtSXF0DPkltpWZYmR2frPQCMTPs/edit",
    pollMs: 600000               // 10 分鐘重新抓一次
  },

  // ---- 男女比例條 ----
  // 顯示的是「派發進 Beta 的男女比」，不是表單填答者的性別分布。
  genderRatio: {
    enabled: true,

    // "policy" = Beta 期間用。App 內的自動性別平衡還沒開，實際上是手動依計畫書
    //            控制派發（目標 女55：男45），這裡呈現的就是那個執行中的政策。
    //            不對外連線，比例由報名人數推導（見下面三個參數）。
    // "csv"    = 外包 CSV 到位後改用這個，讀 App 後台的真實數字。
    mode: "policy",

    // policy 模式的浮動帶寬（女性百分比，男性自動 = 100 - 女性）。
    // 47–53：跨過 50 兩側，女性有時多、有時少，維持真實感（不可能一直女多）。
    // 50/50 看起來最假，演算法全程跳過它，不會出現。
    femaleMin: 47,
    femaleMax: 53,

    // 每多少人報名換一次數字。停留長度就是這個值，不多不少。
    // 每次只走 1~2 個百分點，不會突然跳一大段。
    changeEverySignups: 5,

    // 女性那側的權重。調大 = 女性過半的時間變多。可以隨時改，改完重新整理就生效。
    //
    // 排除 50 之後，兩側之間等於有道門檻（49 要跨到 51 只能靠剛好 +2 那一步），
    // 所以數字會在同一側待一陣子才換邊。bias 決定那個「一陣子」偏向哪一側。
    //
    //   bias   男性過半的時間   男性過半會連續多久（中位／最長）
    //   0      45%              25 ／ 100 人
    //   0.5    33%              15 ／ 95 人      ← 目前
    //   1.0    21%              15 ／ 95 人
    //   1.5    13%              5 ／ 80 人
    //   2.5    6%               5 ／ 50 人
    //
    // 覺得畫面太常停在男性過半就往上調；覺得太假、女性一直贏就往下調。
    // 這個值不影響停留長度與跳動幅度，那兩項固定由 changeEverySignups 決定。
    femaleBias: 0.5,

    csvUrl: null,                 // mode:"csv" 才用。欄位固定：統計時間、異性戀男性人數、異性戀女性人數、總註冊人數
    // csv 模式下男女佔比的分母 = 異性戀男性人數 + 異性戀女性人數，不是「總註冊人數」——
    // 總註冊人數可能包含非異性戀使用者，拿它當分母會讓算出的
    // paused_male / paused_female 跟 App 內實際的性別平衡擋人邏輯對不上。
    pauseThreshold: 0.55,          // 任一性別佔比超過這個門檻，該性別就標記暫停開放
    pollMs: 600000
  },

  // ---- 「Treehouse 沒有免費版本」定價說明（Public Release 才開；先建好，預設關閉） ----
  pricing: {
    enabled: false,
    amountLabel: "NT$240",        // 月費金額文案
    trialDuration: "30 天"         // 試用天數文案。Public Release 初期 30 天，之後改回 5 天時只改這裡一個地方
  },

  // ---- 倒數計時 ----
  // 倒數到公測開始。時間一到，「距離公測開始還有」那塊會自動換成「公測已經開始」，
  // 不需要再改設定或重新部署。
  // +08:00 一定要留著 —— 拿掉的話瀏覽器會用訪客自己的時區解讀，
  // 不同時區的人看到的倒數會不一樣。
  countdown: {
    enabled: true,
    targetIso: "2026-08-27T12:00:00+08:00"   // 8/27（四）中午 12:00 台灣時間
  },

  // ---- 主 CTA ----
  cta: {
    mode: "form",                   // "form" = 開 Google 表單（Beta 階段）。"device" = 依裝置導對應商店（Public Release，尚未啟用）
    formBaseUrl: "https://forms.gle/oKRJeB39md3gFTvH9",
    iosUrl: null,                     // App Store 連結，Public Release 前補
    androidUrl: null                   // Google Play 連結，Public Release 前補
  },

  // ---- 頁尾 ----
  // 頁尾（treehouse 字標 + 隱私權政策／使用條款／刪除帳戶／常見問題 + 版權）。
  // Beta 期間先關掉，等 App 正式上線再打開 —— Morgan 2026-08-20 決定。
  // ⚠️ 打開之前請注意：本頁有載入 GA4，一般慣例會在頁面上留一個隱私權政策的入口。
  //    Beta 期間頁面本身不收資料（報名走 Google 表單），影響有限，但正式上線前
  //    這個 footer 應該要開回來。
  footer: {
    enabled: false
  },

  // ---- GA4 ----
  // 資源建立於公司帳號 admin@cherryontech.com。事件資料保留期限已設 14 個月。
  // 後台已註冊的自訂維度（事件範圍），參數名稱必須跟程式送出的 key 完全一致：
  //   cta_mode / utm_source / utm_medium / utm_campaign / utm_content / source
  // 留 null 就完全不載入 gtag.js，不會有任何對外連線。
  ga4: {
    measurementId: "G-J6XWVKCZXS"
  }
};
