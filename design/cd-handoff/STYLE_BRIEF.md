# Treehouse 官網 — Claude Design 風格交接單（Style Brief）

**目的**：把 Treehouse App 的視覺語言，套用到已建好的官網骨架（4 頁法律／支援頁）。
**交接對象**：Claude Design（CD）
**交接人**：CC（已完成 Phase A：IA + skeleton）
**日期**：2026-07-13

---

## 1. 你要做什麼（一句話）

四頁官網的**結構、內容、路由、語言切換都已完成**。你只需要產出**視覺層**——
主要是改寫 `assets/styles.css` 的設計 token 與元件樣式（必要時微調 header/footer 的 HTML 結構），
讓官網看起來像 Treehouse App 的延伸，而**不要動到頁面正文（法律內容）**。

## 2. 產品調性

- **樹屋 Treehouse** = 純文字、匿名的交友 App。像「秘密樹屋基地」，溫暖、安心、不喧嘩。
- 拿掉照片與外貌評斷，專注在「聊得來」。→ 視覺要**溫潤、克制、有手感**，不要科技冷感、不要浮誇漸層。
- 受眾：18 歲以上、想好好聊天的人。氣質偏文青、療癒。

## 3. 參考素材（見 `reference-screens/`）

| 檔案 | 內容 |
|---|---|
| `01_splash_起始.png` | App 啟動頁：奶油底 + 木屋 logo + 襯線體 "treehouse" 字標 + 咖啡棕主按鈕（註冊）＋白色次按鈕（登入） |
| `02_login_登入.png` | 登入頁：同底 + Apple / Google 登入白色 pill 按鈕 |

**從素材萃取的重點**：木屋 🏠、奶油暖底、咖啡棕、圓角 pill 按鈕、襯線體字標、大量留白。

## 4. 目前 skeleton 用的 placeholder token（放在 `assets/styles.css` `:root`）

> 這些是 CC 從截圖**目測取樣**的暫定值，**請你以實際素材為準校正**（尤其色碼與字體）。

```css
--c-bg:          #faf0e9;  /* 奶油暖底 */
--c-surface:     #ffffff;  /* 卡片白 */
--c-ink:         #4a2f1e;  /* 正文深棕 */
--c-ink-soft:    #6f5844;  /* 次要文字 */
--c-brand:       #7a3d18;  /* 咖啡棕（字標／主按鈕） */
--c-brand-hover: #632f11;
--c-brand-weak:  #f0dccb;  /* 分隔線／淡底 */
--c-link:        #9a4a1c;
--font-brand:    "Fraunces", Georgia, serif;  /* 字標的襯線感，暫用 Fraunces 近似 */
--font-body:     system-ui, ...;              /* 正文用系統無襯線，確保可讀性 */
```

## 5. 需要你決定 / 交付的東西

1. **精準色票**：從素材定出正式 brand 色階（主色、hover、底色、文字、分隔線、狀態色）。
2. **字體**：
   - 字標 "treehouse" 用什麼字體？（App 用的襯線體叫什麼？若是付費字體，官網需要**可自架的替代品**——請指定一款開源近似字體，並提供 `@font-face` **自 host**，不可外連 CDN，見 §7 限制。）
   - 中文正文字體：建議走系統字（PingFang TC / 微軟正黑），確保 webview 相容與載入速度；若要指定自架中文字體請注意檔案體積。
3. **元件樣式**：header（logo + nav + 語言切換 pill）、footer、正文排版（h1/h2/h3、清單、表格、blockquote、notice 橫幅）、404、首頁 hero。
4. **圖示 / logo**：目前 logo 用 🏠 emoji 佔位。若有正式木屋 SVG/PNG，請提供**內嵌或自架**版本。

## 6. 骨架約定（請沿用，不要打破）

- **設計 token 集中在 `:root`**：改一處全站生效。請維持既有變數命名（頁面才不用改）。
- **正文內容不可改**：四頁 `<article data-lang="zh">` 內是法律定稿，逐字不動。
- **語言機制已內建**：`app.js` 負責語言偵測與 header/footer 注入。英文版尚未到位（`EN_READY=false`），現階段全站顯示中文。你的樣式要同時考慮未來中英切換的 pill。
- **class 沿用**：`.site-header .brand .site-nav .lang-switch .content .table-wrap .notice .site-footer` 等，樣式改這些即可。

## 7. 硬限制（務必遵守）

- **全站零外連資源**：不可 `<link>`/`@import` 外部 CSS、字體、JS、圖片 CDN。所有字體／圖片**自架**於 repo（`assets/`），或用 data-URI 內嵌。原因：(a) App 內嵌 webview 與審核環境網路不可靠；(b) 隱私（法律頁不該對第三方發請求）。
- **webview 相容**：iOS/Android in-app webview 要正常顯示；避免用過新、支援度差的 CSS。保留 `env(safe-area-inset-*)` 處理瀏海。
- **RWD**：手機優先，窄螢幕（≤360px）不可破版；表格用 `.table-wrap` 橫向捲動。
- **無障礙**：維持 focus ring、skip-link、色彩對比 ≥ WCAG AA。
- **效能**：純靜態、單一 CSS + 單一 JS，避免肥大。

## 8. 交回格式

改寫後的 `assets/styles.css`（＋若動到結構，附 header/footer 的 HTML patch 與 `app.js` 的 render 字串更新說明），CC 會接手整合進 repo 並部署（Phase C）。若你能一併提供自架字體檔與 logo 資產，請放進 `assets/`。
