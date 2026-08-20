# Treehouse `/join` — 交付包（給 Claude Code）

目標只有一個：**做出與設計稿逐像素一致的網頁**。這個資料夾裡已經有一份對到設計稿的實作，
以及三個可執行的驗收工具。請先跑驗收，再動手改。

---

## 1. 先讀這個

- `HANDOFF_NOTES.md` —— 完整交接說明。**最重要的是「🔒 對稿規則」那一節**：關鍵數值表、走位陷阱、不可替換的字型。

## 2. 要併入 repo 的檔案

| 路徑 | 說明 |
|---|---|
| `join/index.html` | `/join` 的結構。交接單列的 id 全部保留在原元素上；三個旗標區塊保留 `hidden`。 |
| `assets/join.css` | **整支覆蓋**。無 build、無 nesting／`:has()`，webview 相容。 |
| `assets/fonts.css` + `assets/fonts/` | Caprasimo／Noto Sans TC 自架。**不可移除或替換**。 |
| `assets/img/` | `forest.svg`（首屏剪影）、`starfield.webp`、`house-mark.svg`、`how-01..04.webp`（輪播四張，完整比例）。`forest.webp` 是備用的點陣版。 |

另外需要在 `<head>` 保留 Chiron Sung HK 的 Google Fonts `<link>`（與設計稿相同）。
要做到零外連，請把它自架成子集，**不要換成別的字體**。

## 3. 不要併入的檔案

- `assets/join.js` —— **預覽用替身**。請沿用 repo 原本的 `join.js`，但要照 `HANDOFF_NOTES.md` 補三件事：
  倒數改 dd:hh:mm:ss 且每秒更新、報名人數改五位計數器逐位寫入、輪播改 7 秒自動播放＋無限循環。
  這三段邏輯在替身裡都寫好了，可以直接照抄。
- `design-reference/`、`compare.html`、`spec-check.html`、`fold-test.html`、`preview.html` —— 驗收用，不上線。

## 4. 驗收（改任何 CSS 之後都要重跑）

用本機 static server 打開 `handoff/`（例如 `npx serve handoff`），依序開：

| 工具 | 檢查什麼 | 通過標準 |
|---|---|---|
| `compare.html` | 把**設計稿本身**與實作並排載入，用文字配對元素，逐項比 font-family／size／weight／line-height／letter-spacing／color、盒子尺寸，以及七段垂直間距 | 手機 390×844 全項 PASS（桌機 1280×760 允許兩項 3px 內的欄位交錯誤差） |
| `spec-check.html` | 背景三層（漸層停點、星空、剪影）與關鍵盒子的絕對值 | 全數 PASS |
| `fold-test.html` | 8 種真實機型高度下「我要報名」是否都在首屏內 | 全數 fits，餘裕 ≥ 0 |

`design-reference/Join Page.dc.html` 就是設計稿本體（可單獨開，字型與圖檔都在旁邊）。
`compare.html` 讀的就是它 —— **比對基準是設計稿，不是任何人抄下來的數字。**

## 5. 首屏為什麼用 `--u`

`:root { --u: min(0.25641vw, 0.11848svh) }` 代表「1 個設計稿像素」（390 × 844 畫布）。
首屏所有字級與間距都寫成 `calc(N * var(--u))`，N 就是設計稿的 px 值。

- 390×844 時 `--u = 1px`，與設計稿逐像素相同。
- 其他螢幕整個首屏等比縮放，比例不變，也不會有某一段間距被拉大或壓扁。
- 因此**不需要**矮螢幕的字級覆寫（原本兩層 `max-height` 覆寫已移除，請不要加回來）。

桌機（`@media (min-width: 900px)`）改用 1280 畫布的絕對 px，並把首屏高度封頂在 `min(100svh, 860px)`。

## 6. 現況

- `compare.html`：手機全項 PASS；桌機僅「首屏上留白 136/139」與「看板→CTA 5/8」兩項 3px 差（兩欄格線交錯量測誤差，視覺無感）。
- `spec-check.html`：24 項全數 PASS。
- `fold-test.html`：360×560 起 8 種尺寸全部 fits。
