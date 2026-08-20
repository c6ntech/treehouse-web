# /join 視覺交回 — Claude Design → CC

**日期**：2026-08-19
**視覺基準**：App Store 截圖第一張（夜空 → 晚霞漸層、星空、森林剪影、Caprasimo 字標）。
與商店圖／Google 表單頁首同一套語言，捲下去之後切到設計系統的「屋內米色」世界。

## 交回什麼

| 檔案 | 說明 |
|---|---|
| `assets/join.css` | **整支重寫**，直接覆蓋。無外連資源、無 build、無 CSS nesting／`:has()`／container query。 |
| `join/index.html` | 結構有調整（見下），請以 diff 方式併入。交接單列的 **id 全部留在原本的元素上**，旗標三區的 `hidden` 屬性保留。 |
| `assets/img/how-01..04.webp` | 輪播四張，444×680，**每張 16–26KB**（原 1320×2868 商店圖上緣裁切）。 |
| `assets/img/forest.webp` | 首屏森林剪影（含 alpha），1200×1182，63KB。四層前後景共用同一張。 |
| `assets/img/starfield.webp` | 首屏星空，1024×935，33KB。 |
| `assets/img/house-mark.svg` | 看板上的小樹屋標，2KB。 |
| `assets/join.js` | **預覽用替身，不要併入**——請沿用 repo 原本的 join.js。只是讓設計稿能單獨打開看互動。 |

## DOM 調整（純視覺用，沒有動到任何資料綁定）

新增的都是裝飾節點，可以安全刪掉而不影響邏輯：

- `.hero__sky` 內 5 個 `<span>`（星空 1 層 + 森林 4 層前後景）。全部 `aria-hidden`。
- `.signboard__strings`（看板的兩條吊繩）與 `.signboard__plaque` 外框；`#signupNumber` 仍在原本那個 `<span>` 上。
- `.signboard__label` / `.signboard__live`（「目前報名人數」「名額陸續加入中」）是新增文案，若要照規格書文案請直接改字。
- 比例條、輪播、定價、倒數都只是加了 class 與包裝層；`#genderFemaleBar` 等 id 位置不變。
- 輪播箭頭改成 inline SVG（原本若是文字箭頭），`.how__arrow--prev/next` class 不變。
- 輪播圓點 `<button>` 用 `::before` 撐出 44px 點擊區，視覺仍是小圓點——**不要改成 `<span>`**。

## ⚠ 倒數區塊移位了，join.js 要配合改（區塊 9）

倒數從「輪播下方的獨立區塊」移到**首屏空天處，做成玻璃計時器**，格式從「還有 N 天」改成 **dd : hh : mm : ss**。

- `#countdownSection` 整塊搬進 `.hero__inner`（在副標與 CTA 之間），`hidden` 屬性保留，旗標機制不變。
- `#countdownDays` 還在原本的角色上，**新增三個 id**：`#countdownHours`、`#countdownMinutes`、`#countdownSeconds`。
- 更新頻率要從「每分鐘」改成 **每秒**；時／分／秒請補零（`08`），天數不補零。
- `prefers-reduced-motion` 下不需要特別處理（純數字替換，沒有動畫）。
- 玻璃效果有 `@supports not` fallback，不支援 `backdrop-filter` 的 webview 會退成 20% 白。

## ⚠ 男女比例條也移進首屏了（區塊 6）

性別平衡是本頁重點，**併進報名人數看板成為同一張米色卡的下半部**（人數與性別比講的是同一件事：名額狀態；分兩塊會讓首屏出現兩個競爭焦點）。原本的獨立米色區塊已移除。

- `#genderRatio` 整塊搬進 `.hero__inner`，`hidden` 與旗標機制不變；`#genderFemaleBar`／`#genderMaleBar`／`#genderFemalePct`／`#genderMalePct` 四個 id 位置全部不動，**JS 完全不用改**。
- 配色改為女=粉紅 `--pink: #F2678F`、男=藍 `--blue: #3E7FD0`（原本是琥珀／深藍）。
- 比例條的裝飾節點改了：拿掉 `.ratio__mid` 與 `.ratio__sheen`，改成每個色段裡各一個 `<i>` 動態色層。
- **白色分隔線不再固定在 50%**，改用粉紅段右緣的 `inset` 陰影，所以它永遠貼在粉／藍真正的交界處，會隨 JS 寫入的百分比一起移動。
- **閒置動態＝雙向漸層流動**：粉紅朝交界（右）、藍色朝交界（左），7.6 秒一輪。無縫循環的做法是色層寬 300%（三個同色頭尾的週期），每輪剛好平移一個週期、`linear` 不反向，所以沒有接點、也沒有「動畫重播」的斷點感。
- 文案改為兩行：「樹屋會自動維持接近 1:1 的性別平衡 / 確保大家都有最自在的聊天體驗。」（用 `<br>` 硬斷行）。
- 動態：`width` 600ms ease-out（資料更新時）＋掃光 3.6s 循環；`prefers-reduced-motion` 全關。

## ⚠ 報名人數改成五位計數器，join.js 要配合改

- `#signupNumber` 從「一個文字節點」變成**五個 `<b class="odo__d">` 位數格**（`00298` 的計數器造型，前導零用 `.odo__d--lead` 淡化），容器上帶 `data-value`。
- **不要再用 `textContent` 寫整個 `#signupNumber`**（會把位數格清掉）。請補零成 5 碼後逐位寫入 `.odo__d`，並依實際位數 toggle `.odo__d--lead`。`assets/join.js`（預覽替身）裡的 `paint()` 可直接照抄。
- 位數固定 5（上限 99999）。若預期會超過，請告訴我，我改成六位或改用比例縮放。

## ⚠ 倒數有第二個狀態：公測開始後

- 公測前：`#countdownSection`（dd:hh:mm:ss）顯示，`#countdownLive` 帶 `hidden`。
- 公測開始後：**互換** —— 隱藏 `#countdownSection`，移除 `#countdownLive` 的 `hidden`，顯示「測試進行中，手刀快加入！」（綠色呼吸點）。
- 請由 join.js 依公測目標時間判斷（`left <= 0` 即切換），不需要新旗標；`showCountdown` 旗標關掉時兩塊都不顯示。

## ⚠ 怎麼玩輪播整個換掉了（區塊 7）— join.js 要改

從「橫向捲動的小卡＋圖說」改成 **IG Story 式滿版輪播**：

- 照片**完整呈現、不裁切**（原比例 1320 : 2868，`object-fit: contain`），**圖片下方的標題／說明小字全部移除**——資訊已經在圖裡。
- 換頁方式：**點畫面左 34% = 上一張、右 46% = 下一張**（`.how__arrow--prev/next` 現在是兩塊透明點擊區，不再是可見箭頭鈕），另支援左右拖曳。
- **四張無限循環**：第一張往右滑要接到第四張。實作是 DOM 上放三份複本、指標停在中間那份，`transitionend` 時靜默回中（加 `.is-static` 拿掉 transition）。`assets/join.js`（預覽替身）裡整段可直接照抄。
- `#howTrack` 仍在原元素上，但**角色改了**：不再是 `overflow-x: auto` 的捲動容器，而是 `transform: translateX(-idx * 100%)` 驅動的 reel。`#howDots` 也還在，內容改成四段進度條（`<span><i></i></span>`），不是圓點按鈕。
- **自動輪播**：跟 Instagram 照片故事一致，**每張停 7 秒**自動換下一張，頂部進度條同步跑滿（50ms 一次，`transition: width 60ms linear`）。按住／拖曳中、分頁在背景（`document.hidden`）、`prefers-reduced-motion` 三種情況都不自動前進（reduced-motion 下進度條直接顯示滿格）。
- 標題改成「Treehouse 怎麼玩👇」並**置中**（下方是滿版對稱的舞台，靠左會顯得偏），原本的「點左右兩側換頁」說明字移除——👇 已經是提示。
- 圖片資產換成完整比例 `how-01..04.webp`（520 × 1130，各 23–35KB）。

## ⚠ 看板文案整併（區塊 5／6 交界）

「名額陸續加入中」與「即時更新」講的是同一件事，兩處都拿掉，改成**卡片最底一句「即時更新中」**（細分隔線之下，`.signboard__live`），一次交代名額與性別比都是活的。

- `.ratio__head` / `.ratio__live` / `.ratio__pulse` 三個節點與其 CSS 已移除；比例條標題改成單獨的 `.ratio__title`。
- 綠點動畫改為**脈波**：點本身不動，`<i>` 外圈 scale(1→2.8) 淡出，2.8 秒一輪（`th-ring`）。

## 其他這一輪的視覺調整

- **吊繩拿掉了**：`.signboard__strings` 整個 `<span>` 與其 CSS 已移除。
- **看板陰影收小**（`0 14px 28px / 0.3`，並移除暖光 `--glow`）——原本的大範圍陰影會蓋到下方「我要報名」按鈕；CTA 另加 `position: relative; z-index: 1`。
- **剪影改用 SVG 向量** \`assets/img/forest.svg\`（1.4MB，未壓縮；上線前建議跑一次 SVGO，或改回 \`forest.webp\` 54KB——但 PNG 在超寬螢幕上會比較容易看出縮放模糊）。原本的說明：**剪影改用單張** `assets/img/forest.webp`（已換成 `forest-silhouette` 單張輸出，53.9KB，本身就含遠近層次）。`.hero__sky` 內只剩一個 `.hero__forest`，`--back/--mid/--front2` 三個 span 已刪。

## 需要你確認／補的兩件事

1. **CJK 襯線字**：slogan、看板數字、區塊標題用 `--font-display`（Chiron Sung HK 那類宋體），這是商店圖已定案的字。零外連前提下需要自架一份子集（本頁實際只用到約 40 個字，子集後很小）。
   不想加這份字：把 `join.css` 裡 `--font-display` 改成 `var(--font-text)` 即可，版面不會壞，只是招牌感弱一點。
2. **首屏高度**：`min-height: 100svh`（有 `100vh` fallback），字級全用 `clamp()`；已針對 `max-height: 700px` 與 `max-width: 360px` 各加一組收縮規則。品牌／slogan／副標／看板／CTA 五者在 iPhone SE（375×667，含瀏覽器工具列）不需捲動即可全見。

## 視覺決策備忘

- **一個數字、一個動作**：人數看板做成吊掛招牌（米色牌面 + 兩條吊繩 + 暖光），是首屏唯一的亮塊；CTA 是唯一的實心膠囊。頁面上沒有第二顆會競爭注意力的按鈕。
- **兩個世界**：首屏 = 窗外天空（等待、招募）；比例條以下 = 屋內米色（閱讀、說明）。整頁只有這一次世界切換，避免漸層濫用。
- **森林不用 `mask-image`**：四層皆為 bottom-anchored background，靠 `.hero` 自己裁切，webview／LINE 內建瀏覽器安全。
- **比例條寬度直接吃 JS 寫入的百分比**，沒有最小寬度、沒有視覺修飾。
- **動效**：計數 900ms ease-out、比例條寬度 600ms、圓點 200ms、CTA 按下 2px；`prefers-reduced-motion` 一律關閉。
- 對比度：米色牌面上的 `#793A0D` 約 7.4:1；夜空上的白字 slogan 遠高於 4.5:1；`#666` 於米色上約 5.3:1，皆過 AA。

---

## 🔒 對稿規則（最重要的一節）

**驗收的第一道關卡是 `handoff/compare.html`** —— 它把設計稿 `Join Page.dc.html` 與 `join/index.html`
並排載入，用文字內容配對同一個元素，逐項比對 font-family / font-size / font-weight /
line-height / letter-spacing / color 與盒子尺寸。**比對基準是設計稿本身，不是任何人抄下來的數字。**
目前狀態：手機 390×844 與桌機 1280×760 兩組全部「一致」。

字型是先前最大的落差來源：交付檔原本一支字型都沒載入，整頁 fallback 成系統字，
行高與字寬全部跑掉。現在 `assets/fonts.css` 自架 Caprasimo 與 Noto Sans TC
（檔案在 `assets/fonts/`），Chiron Sung HK 與設計稿相同自 Google Fonts 載入。
**不要移除任何一支**；要做到零外連，請把 Chiron Sung HK 自架成子集（本頁只用到約 60 字），
不要改成別的字體。

首屏的字級與間距在手機層全部以「設計稿 390 畫布 ÷ 390」換算成 vw
（例如字標 `15.897vw` = 62/390），所以在 390 寬時與設計稿逐像素相同，
其他寬度等比縮放。桌機層（`@media (min-width: 900px)`）用 1280 畫布的絕對 px。



設計稿 `Join Page.dc.html` 是唯一的視覺依據。這份 CSS 已經對到與它一致，**請不要憑感覺重寫背景三層**（漸層／星空／剪影）——它們的數值是互相咬合的，改一個就會整個構圖跑掉。

### 驗證方式：打開 `handoff/spec-check.html`

它會用 390×844 與 1280×760 兩個參考畫布載入 `join/index.html`，逐項量測並顯示 PASS／FAIL。
**任何 CSS 改動之後都要重開這一頁，必須全部 PASS。** 目前狀態：全數通過。

另有 `handoff/fold-test.html`（8 種真實機型高度）確認「我要報名」不會掉出首屏。

### 關鍵數值表（設計稿絕對值）

| 項目 | 手機（畫布 390 × 844） | 桌機（畫布 1280 × 760） |
|---|---|---|
| 天空漸層停點 | 0 / 22 / 38 / 56 / 70 / 82 / 93 / 100% | 0 / 24 / 40 / 58 / 72 / 84 / 94 / 100% |
| 漸層色 | `#060624 #0A2B5C #0D3D7A #3E5A94 #7A7CAA #BD9EB8 #D95C26 #EFA36B` | 同左 |
| 星空帶高 / 圖尺寸 / 位移 | 470 / 390×640 / 0 −10 | 440 / 1280×700 / 0 −10 |
| 剪影帶高 / 上緣淡出 | 300 / 90 | 300 / 100 |
| 剪影圖尺寸 / 下移 | 700×700 / −308 | 1600×1600 / −704 |
| 剪影 filter | `opacity .95 · brightness(.62) saturate(.55)` | 同左 |
| 地面補色帶高 | 26 | 44 |
| 看板卡寬 / 倒數卡寬 | 320 / 320 | 420 / 420 |
| 計數格 | 46 × 68，字 44 | 62 × 92，字 60 |
| 比例條高 | 15 | 18 |
| CTA | 高 56，圓角 60 | 高 62，寬 300 |

CSS 裡手機那組全部以 **÷390 換算成 vw** 表達（例如剪影圖寬 `179.49vw` = 700/390），所以 360–430 各種寬度都維持同一個構圖比例。桌機那組在 `@media (min-width: 900px)` 內，並把首屏高度封頂在 `min(100svh, 860px)`（不封頂的話高視窗會把晚霞位置整個拉走）。

### 三個常見的走位陷阱（我自己踩過，已修）

1. `img { max-width: 100% }` 這條基礎樣式會把剪影從 700px 裁成 390px，樹會小一半 → `.hero__forest img` 必須有 `max-width: none`。
2. 星空**不能**用 `background-size: cover`，星點會被放大兩三倍 → 必須是 `100% 164.1vw`（手機）／`100% 54.69vw`（桌機）。
3. 首屏在很高的桌機視窗不封頂 → 漸層被拉開、晚霞跑到畫面外。

### 唯一允許偏離設計稿的地方

矮螢幕（`@media (max-height: 780px)` 與 `700px`）會等比縮小計數格、比例條、倒數與間距。這是刻意的：不縮的話 360×640 / 375×667 上「我要報名」會掉出首屏 56–76px。LINE、IG 內建瀏覽器會再吃掉 60–110px 高度，所以這兩級一定要保留。
