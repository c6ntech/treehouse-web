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
    baseValue: 298,            // mode:"mock" 時的顯示值，或 mode:"sheet" 但抓取失敗時的最後防線
    round: "floor",             // "floor" 無條件捨去到整數；"none" 不處理（Sheet 應該本來就是整數）

    // ⚠️ 這份試算表會被公開讀取（Google 的 gviz 端點要求整份表可公開存取）。
    // 只能填一份「只有兩格」的專用儀表板試算表 —— A1 是文字 signup_count，
    // B1 是數字（由這份表用 IMPORTRANGE 從私有的表單回應表拉一個已經算好的值進來）。
    // 絕對不可以填表單回應原始試算表的網址 —— 那份含報名者 IG ID、性別、年齡，
    // 一旦被公開讀取就是個資外洩。
    sheetUrl: null,             // 貼 Google Sheet 網址（編輯連結或發布連結都可以，程式會自動取出 ID）
    pollMs: 600000               // 10 分鐘重新抓一次
  },

  // ---- 男女比例條（Beta 後期才開；先建好，預設關閉） ----
  genderRatio: {
    enabled: false,
    csvUrl: null,                 // 外包 CSV 網址。欄位固定：統計時間、異性戀男性人數、異性戀女性人數、總註冊人數

    // 男女佔比的分母 = 異性戀男性人數 + 異性戀女性人數，不是「總註冊人數」——
    // 總註冊人數可能包含非異性戀使用者，拿它當分母會讓下面算出的
    // paused_male / paused_female 跟 App 內實際的性別平衡擋人邏輯對不上。
    pauseThreshold: 0.55,          // 任一性別佔比（分母見上）超過這個門檻，該性別就標記暫停開放
    pollMs: 600000
  },

  // ---- 「Treehouse 沒有免費版本」定價說明（Public Release 才開；先建好，預設關閉） ----
  pricing: {
    enabled: false,
    amountLabel: "NT$240",        // 月費金額文案
    trialDuration: "30 天"         // 試用天數文案。Public Release 初期 30 天，之後改回 5 天時只改這裡一個地方
  },

  // ---- 倒數計時（先建好，目標日還沒定，不要用猜的） ----
  countdown: {
    enabled: false,
    targetIso: null                // 例如 "2026-09-15T00:00:00+08:00"；定案前留 null
  },

  // ---- 主 CTA ----
  cta: {
    mode: "form",                   // "form" = 開 Google 表單（Beta 階段）。"device" = 依裝置導對應商店（Public Release，尚未啟用）
    formBaseUrl: "https://forms.gle/oKRJeB39md3gFTvH9",
    iosUrl: null,                     // App Store 連結，Public Release 前補
    androidUrl: null                   // Google Play 連結，Public Release 前補
  },

  // ---- GA4 ----
  ga4: {
    measurementId: null              // 例如 "G-XXXXXXXXXX"。留 null 就完全不載入 GA4，不會有任何對外連線
  }
};
