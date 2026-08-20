# 報名人數計數器 — 進場滾動（11a 依序滾入）

設計已定案：**11a**。五位數字一起滾，右邊比左邊晚停，像老虎機但刻意收斂。

## 檔案

| 檔案 | 用途 |
|---|---|
| `odometer.css` | 附加樣式。**不改任何既有規則**，只讓 `.odo__d` 變成滾輪視窗。 |
| `odometer.js` | 進場邏輯 + `setSignupCount()`。ES5、無依賴、無 build。 |
| `demo.html` | 單獨開就能看效果，也用來驗收。 |

## 接法（三步）

1. `odometer.css` 併進 `assets/join.css` 尾端，或另外 link（要在 join.css **之後**）。
2. `odometer.js` 的內容併進 `join.js`，或在 `join.js` 之後載入。
3. HTML **完全不用改** —— 沿用現有的：

```html
<span class="odo" id="signupNumber" data-value="298">
  <b class="odo__d odo__d--lead">0</b><b class="odo__d odo__d--lead">0</b><b class="odo__d">2</b><b class="odo__d">9</b><b class="odo__d">8</b>
</span>
```

## 規則（請照做）

- **只在頁面載入時播放一次。** 想重看只能重新整理。不要做重播按鈕、不要 loop。
- **之後的即時數值更新不重滾。** 輪詢拿到新數字時呼叫 `setSignupCount(320)`，直接換數字。
  每次更新都重滾會非常吵。
- **位數無關。** 任何數字都補零成 5 碼；前導零自動套用 `.odo__d--lead`（淡色 + 淺底）。
  若日後要支援 6 位數，改 `odometer.js` 的 `PAD` 並同步加一個 `<b class="odo__d">`。
- **`prefers-reduced-motion: reduce` 時不播放**，直接顯示最終數字（已內建）。

## 時間曲線（設計定稿值，不要改）

| 參數 | 值 |
|---|---|
| 空轉圈數 | 2（每格帶子 = 0-9 × 2 + 目標數字，共 21 格） |
| 每位時長 | `900 + i × 180` ms（第 1 位 900ms → 第 5 位 1620ms） |
| 每位延遲 | `i × 70` ms |
| 曲線 | `cubic-bezier(.16, .84, .3, 1)`（快進、長煞停，不回彈） |
| 總長 | 約 1.9 秒 |

滾輪的位移量由 CSS 變數 `--n`（目標索引）× `--cell`（一格高度）算出，
所以手機的 `calc(68 * var(--u))` 與桌機的 `92px` 都自動正確 —— 
**`--cell` 必須永遠等於 `.odo__d` 的 height**，改一個要改另一個。

## 實作上的兩個地雷（我踩過，已避開）

1. **不要把位移寫成 `translateY(calc(var(--n) * ...))`。** 自訂屬性的變化不會被
   `transition` 內插，`transform` 會瞬間跳到終點，看起來完全沒有動畫。
   位移量要由 JS 直接寫成 px（`odometer.js` 已經這樣做，一格高度用
   `getBoundingClientRect().height` 量測，手機的 vw 換算與桌機的固定 px 都正確）。
2. **不要用嵌套 `requestAnimationFrame` 當起跑訊號。** 部分 webview（LINE / IG 內建瀏覽器、
   背景分頁）會延後或丟棄 rAF 回呼，滾輪會永遠停在起點。用 `setTimeout(…, 50)`。

## 驗收

- 開 `counter-roll/demo.html`：重整後五位依序滾入、右邊最後停、停下不抖動。
- 開 `compare.html` 與 `spec-check.html`：**動畫結束後**格子尺寸與字樣式必須與設計稿一致
  （`odometer.js` 在動畫結束時會把帶子收回單一數字，正是為了這件事）。
