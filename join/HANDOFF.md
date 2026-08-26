# /join — 進度交接（跨機器接續用）

最後更新：2026-08-21 下午（Windows 關機前同步），`main`（`feature/join-beta-recruit` 已 squash merge
並刪除；本檔前兩版分別為 08-19 Windows 與 08-20 Mac，內容已被這一版取代）。

**上線時程：8/21（五）網頁要上線，8/25（二）12:00 Beta 開始發連結。**

## 現況

Claude Design 的視覺已經整支併進 repo，對稿三關全部通過。剩下的全部是資料層，
跟視覺解耦，換機器繼續做沒有風險。

- `assets/join.css` 已被交付版整支覆蓋，`join/index.html` 依交付結構重寫。
- `assets/join.js` 沿用 repo 原本那支（資料層沒動），只補了視覺需要的三段邏輯。
- 字型已子集化、`forest.svg` 已壓縮，`/join` 傳輸量從約 15MB 降到 283KB。
- `/review` 已跑過，四項修正見 commit `6e1c376`。
- 分享卡 `assets/join/og-image.png` 已用真實首屏重新產生（舊的還是改版前的米色版）。
- 已 merge 進 `main`，GitHub Pages 已部署，線上網址 https://gettreehouse.app/join/。

## 對稿門檻（改任何 CSS 之後都要重跑）

驗收工具與設計稿本體在 **`design-baseline` branch** 的 `handoff/`，不在 `main`——
那包 63MB，而 GitHub Pages 會把 repo 根目錄整包公開發布，放進 main 等於把設計稿
掛在 `gettreehouse.app/handoff/`。要跑對稿就臨時取出來，跑完丟掉：

```
cd treehouse-web
git fetch origin design-baseline
git checkout origin/design-baseline -- handoff    # 取出，不會切 branch
python -m http.server 8787
# http://127.0.0.1:8787/handoff/compare.html
# http://127.0.0.1:8787/handoff/spec-check.html
# http://127.0.0.1:8787/handoff/fold-test.html

git rm -r --cached handoff && rm -rf handoff       # 跑完清掉，別 commit 進去
```

目前基準（三支工具的 iframe 都指向 `/join/index.html?flags=on`，量的是 repo
本體，不是 `handoff/` 裡的交付副本）：

| 工具 | 通過標準 | 目前 |
|---|---|---|
| `compare.html` 手機 390×844 | 全項 PASS | 全項 PASS |
| `compare.html` 桌機 1280×760 | 允許兩項 3px 欄位交錯誤差 | `首屏上留白 136/139`、`看板→CTA 5/8`，維持現狀即可 |
| `spec-check.html` | 24 項全 PASS | 24/24 PASS |
| `fold-test.html` | CTA 都在首屏內 | 六種尺寸餘裕 30 / 31 / 58 / 40 / 43 / 41 px |

`fold-test.html` 沒有量測腳本，只是把 iframe 並排讓人看（`handoff/README.md` 寫
「8 種尺寸、會顯示餘裕」與實際檔案不符，實際是 6 種、純視覺）。上面那組餘裕數字
是另外量的，要重驗就對每個 iframe 取 `#ctaButton` 的 `getBoundingClientRect().bottom`
跟 `data-h` 相減。

## 併入時做的四個判斷（改動前先看這裡）

1. **`/join` 不載入全站 `assets/styles.css`。** 它的 `img { max-width: 100%; height: auto }`
   就是 `HANDOFF_NOTES.md` 走位陷阱 #1，會把首屏剪影從 700px 裁成視窗寬，也會拿掉
   輪播照片的固定比例。`join.css` 自帶 reset 與 base，兩支不能同時載入。
2. **footer 用交付包的靜態版本**（沒有 `id="site-footer"`，所以 `app.js` 的注入自動
   no-op，語言鎖定那條鏈還在）。代價是 `/join` 的 footer 跟其他四頁不同源。
3. **`?flags=on` 只讀網址參數**，強制打開三個旗標區塊給驗收工具用，不碰
   `join.config.js`；正式流量沒帶參數就完全沒作用。
4. **矮螢幕字級覆寫沒有加回來。** `handoff/README.md` §5 與 Morgan 的指示都說已移除、
   不要加回；`HANDOFF_NOTES.md` 最後一節「唯一允許偏離設計稿的地方」說要保留 —— 兩份
   文件互相矛盾，這裡照 README 走。`--u` 機制本身就處理了等比縮放。

## 字型

`assets/fonts/*.woff2` 是產生物，由 `tools/build-fonts.sh` 產生，**不要手改**。
原始 TTF 在 `design-baseline` branch 的 `handoff/assets/fonts/`；腳本會自己
從那個 branch 取檔到暫存目錄，不用先 checkout。

兩層 unicode-range：`critical`（本頁現有的字，一定下載）+ `rest-0..7`（其餘依
codepoint 切塊，宣告在 critical 之前所以不會搶）。**改文案不需要重跑這支腳本** ——
出現新字時瀏覽器會自己抓對應的那一塊，不會有豆腐字，只是多一次請求。真的重跑之後
要再跑一次上面三支驗收工具。

Chiron Sung HK 仍從 Google Fonts 載入（與設計稿相同，實測約 858KB）。
`handoff/README.md` 說要做到零外連得自架成子集，這件事還沒做。

## 報名人數資料源（08-20 已接上，線上生效）

`signup.sheetUrl` 指向專用的公開儀表板表
`105ymHSvKcdbQ33xiKtSXF0DPkltpWZYmR2frPQCMTPs`（標題 `... (回覆) - for Web Stats`）。
整份只有 A1:B3 三列：

| | A | B |
|---|---|---|
| 1 | `signup_count` | `=B2+B3` ← 網頁讀的就是這一格（gviz `range=B1`） |
| 2 | 起算值(加舊名單) | `298`（= 425 × 0.7，見《Beta_Test_Program_v4》§3.6） |
| 3 | 新表單報名數 | IMPORTRANGE 從私有表單回應表拉「已算好的一個數字」 |

已驗證：匿名（不帶任何認證）curl gviz 回 200，`Access-Control-Allow-Origin`
反射為 `https://gettreehouse.app`；Drive 權限是 `{"role":"reader","type":"anyone"}`。

⚠️ **不要把 `sheetUrl` 換成表單回應原始表**（`10nZTF4jQMoPpqcGdC8Xq1hS0ecKHXS58IA36twoqS10`）。
那份含報名者 IG ID／性別／年齡／感情狀態，而 gviz 需要整份表公開可讀。
公開這份儀表板表也**必須維持「檢視者」**，給到編輯權，任何人都能自己寫一條
IMPORTRANGE 把私有表整包拉出來（授權是綁在試算表上，不是綁在人身上）。

**延遲不是 bug**：IMPORTRANGE 自己有快取（約 30 分鐘），網頁再疊 10 分鐘輪詢，
所以報名到看板跳動最久可能約 40 分鐘。嫌慢的話要改用 Apps Script 定時寫靜態值。

## GA4（08-20 已接上，線上生效）

`ga4.measurementId = "G-J6XWVKCZXS"`。資源建在公司帳號 `admin@cherryontech.com`，
事件資料保留 14 個月，Google Signals 未開，內部流量排除待補（Morgan 預計 8/22）。

`gtag.js` 只在 `measurementId` 有值時才動態插入；留 null 就零外部請求。這是對
`STYLE_BRIEF.md` §7「全站零外連資源」有記錄的例外，理由見 `join/index.html` 內註解。

五個事件已逐一實測（本機 dataLayer 驗證），參數名稱與後台註冊的自訂維度完全一致：

| 事件 | 參數 | 驗證結果 |
|---|---|---|
| `page_view` | GA4 內建 | gtag config 自動送出 |
| `cta_click` | `cta_mode` + 網址上所有 `utm_*` 原樣帶入 | 實測 payload：`{cta_mode:"form", utm_source:"threads", utm_medium:"social", utm_campaign:"beta_recruit_join", utm_content:"d1_intro"}` |
| `how_it_works_interact` | 無 | 點箭頭觸發，每次載入只送一次 |
| `pricing_expand` | 無 | 展開定價區塊觸發（需旗標開啟） |
| `data_fetch_error` | `source`（`sheet` \| `vendor`） | 用壞掉的 sheet id 實測，送出 `{source:"sheet"}`，畫面靜默退回 `baseValue` |

⚠️ `cta_click` 的 `utm_*` 是從網址原樣抄過去的，大小寫不會正規化。`join/utm-tool/`
產出的連結一律小寫所以沒問題，但手打連結時若寫成 `utm_Source`，GA4 那端的自訂維度
（`utm_source`）就對不上、查不到值。

## 倒數（08-20 已開啟）

`countdown.targetIso = "2026-08-27T12:00:00+08:00"` —— Morgan 08-20 拍板，Beta 開始日
從原訂 8/25（二）改為 **8/27（四）中午 12:00**。

`+08:00` 一定要留著：拿掉的話瀏覽器會用訪客自己的時區解讀，不同時區看到的倒數會不一樣。

時間一到會自動從 `#countdownSection`（「距離公測開始還有」）切成 `#countdownLive`
（「公測已經開始／測試進行中，手刀快加入！」），不需要再改設定或重新部署 —— 已用
過去日期實測驗證過切換行為。

⚠️ **對稿工具的假陽性**：`compare.html` 是用**字面文字「32」**當錨點定位倒數卡（設計稿
上寫 32 天）。真實倒數不是 32 天時，那兩項會報 `MISS 倒數標籤 → 倒數卡` /
`MISS 倒數卡 → 看板`。**這是工具的限制，不是版面跑掉。** 已驗證：把 `targetIso` 暫時
設成 32 天後再跑，四項全部 PASS 且數值完全吻合（手機 稿23/實23、稿88/實88；
桌機 稿26/實26、稿-286/實-287）。日後對稿看到這兩個 MISS 直接忽略，或用同樣方法複驗。

## 卡著、擋路的事

- **外包 CSV** → 尚未取得。有了之後把 `genderRatio.mode` 從 `"policy"` 改成 `"csv"`
  並填 `csvUrl`，就會改讀 App 後台真實數字。**切模式那天有三件事要一起處理，
  見下面「csv 模式上線前要補的三件事」。**
- App Store／Google Play 連結（Public Release 前給）。
- **網頁以外的 8/25 → 8/27 連動**（不是 CC 的工作範圍，但漏了會出事）：
  《Treehouse_Beta_訊息清單_v2.xlsx》三組受眾的階段①②、Google 表單送出前後的說明
  文字、以及計畫書 §2 時程表，目前全部寫「預計 8/25（二）中午 12:00 起陸續發送」。
  8/20 起發出去的 IG DM 也已經帶著 8/25 這個日期。

## 性別比區塊（policy 模式）

**這一區顯示的是「派發進 Beta 的男女比」，不是表單填答者的性別分布。** Beta 期間
App 內的自動性別平衡尚未開啟，實際上是 Morgan 依計畫書手動控制派發，所以這裡呈現的
是那個實際執行中的政策，不是憑空的數字。

`mode: "policy"` 時比例是**報名人數的純函數**，不是 `Math.random()`。這點是刻意的：

- 同一個報名人數 → 永遠同一個比例（重新整理不會變）
- 報名人數沒動 → 比例也不動（沒人報名數字卻自己在跳，才是真正的破綻）
- 報名人數動了 → 比例才變

### 演算法：有界隨機遊走（08-21 換掉原本的 value noise）

每 `changeEverySignups` 人一格，每格從「前一個值的 ±1／±2」裡挑一個，候選一定
**排除前一個值**，所以停留長度剛好等於該參數、不會出現長時間不動。50 全程跳過。

原本用 value noise（格點雜湊 + smoothstep），問題出在整數四捨五入：帶寬只有幾個整數，
雜訊要移動 1/帶寬 的幅度才會換一個整數，在曲線轉折處會卡住幾十個人不動（實測最長
77 人）。Morgan 要求「一個值撐 3~8 人才換」，用遊走才做得到精確控制。

### ⏳ 目前是「階梯表」，不是浮動帶寬也不是單一固定值（2026-08-26 起）

`genderRatio.steps` 依報名人數階梯式指定女性百分比。Morgan 2026-08-26 20:44 指定：

| 報名人數 | 女性 | 男性 |
|---|---|---|
| < 757 | 65% | 35% |
| 757 ~ 766 | 65% | 35% |
| 767 ~ 776 | 64% | 36% |
| 777 ~ 786 | 63% | 37% |
| 787 ~ 796 | 62% | 38% |
| 797 ~ 799 | 61% | 39% |
| ≥ 800 | **60%** | 40% |

⚠️ 800 以後**永遠停在 60%**，不會繼續往下。這是階梯表的定義（超過最後一階就停住），
不是 bug。要繼續往下就加更多階。

⚠️ 最後兩階的間距是 3（797→800），前面都是 10。照 Morgan 給的表原樣實作。

**沿革（同一天內三次）**：18:30 固定 66 → 20:41 改 63 → 20:44 改成這張階梯表。
這些都是人工指定的暫時值，沒有演算法依據。

`steps` 有值時**完全接管**，`femaleMin` / `femaleMax` / `changeEverySignups` /
`femaleBias` 全部不生效。停用階梯就把 `steps` 設成 `null`，會回到
`femaleMin`/`femaleMax`（目前都是 65，所以停用不會讓畫面跳動）。

實作在 `policyFemalePct()` 最前面，約 15 行：取「最後一個門檻 <= n」的百分比，
輸出夾在 0~100。壞資料（非陣列、缺欄位、`NaN`）會略過該筆而不是讓畫面壞掉。
實測 n=0 / 負數 / `NaN` / 小數 / `null` / `undefined` / 字串 全部回合法整數。
（`Infinity` 會回第一階 65 而不是最後一階 60 —— Sheet 讀值只接受有限正數，到不了。）

**要調整階梯就直接改 `assets/join.config.js` 的 `steps` 陣列**，改完存檔重新整理就生效，
不用動 `join.js`。但**這三個地方要一起同步**：

| # | 檔案 | 改什麼 |
|---|---|---|
| 1 | `assets/join.config.js` | `steps` 陣列本體 |
| 2 | `join/index.html`（114-119 行） | 靜態預設 `width:` 與文字百分比，設成「當下人數對應的那一階」，女男加總 100 |
| 3 | `assets/join/og-image.png` | 跑 `PORT=<port> bash tools/build-og-image.sh` 重截 |

`assets/join.js` 的 DEFAULTS（第 17 行）帶 `steps: null` 與 `femaleMin/Max: 65`，
那是設定檔 parse 失敗時的後備，改階梯表時不必動它，除非你也想改後備值。

⚠️ `join/index.html:132` 也有一個 `34%`，那是**輪播左右點擊區的寬度**，不是性別比，
不要一起改。

### 🔴 已知且刻意接受：輪播第 4 張與看板矛盾

`assets/img/how-04.webp`（輪播第 4 張）是 App 實際畫面的截圖，上面印著
**男性 55% / 女性 45%**、標題「性別平衡機制」、內文提到 1:1 平衡、「目前等待約 2-4 小時」，
alt 文字是「性別平衡機制說明：維持 1:1 比例，等待時間約 2 至 4 小時」。

訪客在同一頁往下滑：看板（階梯表 60~65% 女）→ 輪播 **男55/女45**，而且輪播那張是男性過半。
這是圖片，JS 蓋不掉、改文案也救不了。

2026-08-26 adversarial review 抓到，CC 建議移除該張或重製，**Morgan 決定照推、接受矛盾**。
不是漏掉，不用再提報一次。要處理的話有兩條路：
- 從 `join/index.html` 的 `#howTrack` 移除那一行 `<img src="/assets/img/how-04.webp">`（輪播剩 3 張）
- 重製該圖。原始檔在 Windows 本機 `C:\Projects\Treehouse App Beta Recruiting Website\ios-store-image\ios\iOS-1320x2868-04.png`。
  ⚠️ 那是真實 App 畫面截圖，改裡面的數字等於偽造產品截圖，性質與「在自己行銷頁選一個展示數字」不同。

### 同時決定暫緩的四件事（2026-08-26，都不擋 8/27 上線）

1. **`policyFemalePct` 早退路徑沒有夾限。** `if (hi <= lo) return Math.round(lo);` 不夾限，
   `renderGenderRatio` 的 `var mPct = hasData ? 100 - fPct : 0;` 也不夾限。實測：
   `femaleMax: 660` → `width:660%` / `-560%`；刪掉 `femaleMax` → 顯示字面 `NaN%`；
   `femaleMax: null` → **靜默解除固定**、在 n=741 走出 女27%/男73%（男性過半）。
   風險窗口是「有人照註解去改這兩個值卻打錯」。建議修法：
   `return Math.max(0, Math.min(100, Math.round(lo)))` + `if (!isFinite(fPct)) return;`
2. **`og:image` 沒有版本號**（既有待辦 #6）。已發出的 d1~d5 貼文永遠停在舊卡片，
   加 `?v=<時間戳>` 只能讓「之後」的分享與 rescrape 確實拿到新圖。
   Scrape Again 本身不需要它就能重抓。
3. **`faq/index.html`** 寫著「我們會即時衡量目前的男女使用者比例，僅在比例平衡時開放
   試用與訂閱加入」，與階梯表的值 + CTA 照常開放對不上。不同頁面，程式不用改。
4. **`join/design/cd-handoff/JOIN_STYLE_BRIEF.md`** 對外包寫「視覺寬度必須對得上真實
   百分比，不能為了好看修飾」，出貨版已違反該規範，應加註 Beta 期間為人工指定值。

第三件不是 bug 但要知道：性別比只在跨過階梯門檻時才動，800 人之後就完全不動了。`join.js` 的註解
寫過反面版本「沒人報名數字卻自己在跳，才是真正的破綻」—— 反過來也成立。

---

以下是**浮動模式**的說明。固定值模式下不適用，切回時再看。

### 目前參數與實測特性

`femaleMin: 51 / femaleMax: 53`、`changeEverySignups: 5`、`femaleBias: 1.0`。
帶寬 2026-08-26 由 49–53 再收成 **51–53** —— 換算男性是 47~49，**男性永遠不會過半**
（Morgan 2026-08-26 決定）。演變：47–53（08-20）→ 49–53（08-21）→ 51–53（08-26）。

⚠️ 49–53 時代刻意讓帶寬跨過 50（女 49 那一格就是男性過半，約 5% 的時間），理由寫在
當時的註解裡：「從頭到尾女性都領先反而假」。08-26 是明確放棄那個取捨，不是漏掉。
要換回會跨 50 的行為，把 `femaleMin` 調回 49 即可，`join.js` 不用動。

以出貨的 `policyFemalePct()` 本體驗證（桶 0~5000，即 n 0~25000）：

| 項目 | 實測（51–53） | 舊值（49–53） |
|---|---|---|
| 出現的值 | 女 51 / 52 / 53（3 個） | 女 49 / 51 / 52 / 53（4 個） |
| 停留長度 | 剛好 5 人（最短 5、最長 5） | 同 |
| 單次最大跳動 | 2% | 同 |
| 連續重複的桶 | 0 | 同 |
| 出現 50/50 | 0 次 | 同 |
| 分佈 | 女51:33.4% 52:33.5% 53:33.1% | 女49:5% 51:33% 52:32% 53:30% |
| 男性過半的時間 | **0%** | 5% |

⚠️ **統計掃描不要跨過第 5000 桶。** `policyFemalePct` 有 `Math.min(..., 5000)` 上限，
n ≥ 25000 之後回傳值永遠不變；掃到第 6000 桶會多灌 1000 個同值樣本，把分佈量成
女51:44.5% / 52:27.9% / 53:27.6%，看起來像偏誤其實是量測範圍的錯。08-26 踩過一次。

⚠️ **短窗會看起來不均。** 同一組參數在 n=130~1500 這一段是 31% / 34% / 35%，
長期才趨近均等。引用分佈數字時要一併寫出 n 範圍。

### `femaleBias`：在 51–53 帶寬下是死參數

`join.js` 的加權是 `cand > 50 ? 1 + bias : 1`。帶寬全在 50 以上時所有候選權重都是
`1 + bias`，等比例權重等於沒有權重。**2026-08-26 實測 bias = 0 / 0.5 / 1.0 / 2.5 / 100，
n=0~30000 輸出完全相同。** 現在調它不會有任何效果。

留著 `1.0` 不刪，是因為帶寬一旦調回跨 50 它就重新生效。那時的對照表
（49–53、2026-08-21、n=130~1500）：

| bias | 男性過半的時間 | 男性過半連續（中位／最長） |
|---|---|---|
| 0 | 11% | 5 ／ 5 人 |
| 0.5 | 8% | 5 ／ 5 人 |
| **1.0** | **5%** | **5 ／ 5 人** |

（47–53 時代的更舊數字：bias 0 → 45%、0.5 → 37%、1.0 → 22%、1.5 → 13%、2.5 → 6%，
連續最長可達 100 人。）

### 停留長度與跳動幅度分別由誰決定

- **停留長度** = `changeEverySignups`，精確等於這個值。
- **跳動幅度** = `join.js` 的 ±2 候選窗（`for (var d = -2; d <= 2; d++)`）加上帶寬寬度，
  **不是** `changeEverySignups`。帶寬若收成 51–52，跳動就只剩 1 個百分點。
  （HANDOFF 與 `join.config.js` 在 08-26 之前都把這兩件事混為一談，已更正。）

`changeEverySignups` 換算成時間要看報名速率：08-26 是約 13.6 人/小時，所以 5 人 ≈
每 22 分鐘換一次值。想讓一個數字停久一點就調大它（20 ≈ 1.5 小時），代價是畫面更少動。

### 帶寬不要碰到 50

`femaleMin` 或 `femaleMax` 只要有一邊等於 50，50 就會漏出來顯示在畫面上
（49/50、50/50、50/51、51/50 都實測過）。`join.js:766` 那條
`if (!cand.length) { v = (v > 50 ? lo : hi); continue; }` 防呆在 `femaleMin:51/femaleMax:50`
這種倒置帶寬下不但會被觸發，它指派的 `hi` 本身就是 50。重設帶寬時兩端都避開 50。

### 驗證腳本的做法

直接從 `assets/join.js` 用正則抽出 `hash01` 與 `policyFemalePct` 兩個函式、
`eval` 載入 `assets/join.config.js` 取真實設定，再跑統計 —— 驗的是實際出貨的程式碼，
不是另外寫一份模擬。改參數後想複驗照這個方式做。掃描範圍記得停在第 5000 桶。

⚠️ 這支腳本目前**沒有進 repo**，每次都要重寫（08-26 code review 指出）。
有時間應該把它固化成 `tools/` 底下的一支，約 20 行。

08-20 已 `enabled: true` 上線。CC 曾提出區塊標題「目前報名性別比」與數字代表的
「派發比例」語意不同、建議改文案，Morgan 決定文案不動、功能照做。這是已經過的討論，
不用再提。

## csv 模式上線前要補的三件事（2026-08-21 code review 發現）

切 `genderRatio.mode: "csv"` 那天要一起處理，現在 policy 模式碰不到所以不急，
但漏了會在真實數字上線那天才爆。

1. **`data-status` 是 dead code。** `renderGenderRatio()` 會把 `open` /
   `paused_male` / `paused_female` 寫進 `#genderRatio` 的 `data-status`，但全 repo
   沒有任何 CSS 或 JS 讀它 —— 畫面上完全沒有表現。policy 浮動模式永遠是 `open`
   （帶寬 51–53 遠低於 `pauseThreshold: 0.55`）—— 但 2026-08-26 起的階梯表值（60~65）
   都已經超過門檻，`data-status` 現在就是 `paused_female`（畫面仍無表現）；csv 接上真實數字後
   一方超過 55% 就會觸發，那時需要有對應的視覺（例如「男性報名暫停開放中」的標示），
   否則寫了等於沒寫。

2. **csv 欄位驗證只擋 `isFinite`，負數會過關。** `fetchGenderRatio()` 只檢查
   `isFinite(male) / isFinite(female)`，`-5` 這種值會一路算下去。負的百分比丟給
   `style.width` 會被 CSS 忽略、bar 停在前一次的寬度，畫面靜默錯掉不會報錯。
   接 CSV 那天順手加一行 `if (male < 0 || female < 0) throw`。

3. **四捨五入的誤差固定由男性吸收。** `renderGenderRatio()` 是女性先 `Math.round`、
   男性 `= 100 - fPct`。`Math.round` 半數進位，所以真實比例剛好落在 x.5（例如
   男 101／女 99）時永遠倒向女性。這是為了保證加總恆等 100 的刻意取捨，policy 的
   51–53 帶寬碰不到 .5（階梯表的值都是整數，同樣碰不到），但 csv 的真實數字會。不想固定偏女性的話，改成「人數多的
   那邊優先進位」。另外極端比例下（例如 男1／女199）男性會顯示 0%、bar 寬 0，
   把非零族群畫成 0 —— 實務上離 `pauseThreshold` 很遠，碰不到。

## 計數器進場滾動（08-20 已整合，線上生效）

Claude Design 交付包「counter-roll」已併入 `assets/join.css` §11 與 `assets/join.js`。
五位數依序滾入、右邊最後停、約 1.9 秒、每次頁面載入只播一次；之後的輪詢更新直接換
數字不重滾。原始交付包存放在 `design-baseline` branch 的
`Treehouse App web digit counter設計/`（不在 main —— GitHub Pages 會把 repo 根目錄
整包公開發布）。

**第一次載入卡在 888 的修正（08-20）**：位移寫死 px，但格高是 `calc(68 * var(--u))`、
`--u` 綁 `vw`/`svh`。滾動途中可視區一變（手機第一次載入網址列收合、桌機捲軸出現、轉向），
格高變了位移沒變，帶子就停在錯的格子。實測 390x844→390x700：格高 68→56.4、位移仍是
-1360px、落點索引 24.11（帶子只有 21 格）。手機網址列收合讓高度長約一成，20×0.9≈18，
第 18 格正好是「8」，所以症狀是三個 8。

現在滾動期間有個 100ms 的守衛（`resyncReels`）盯格高，一變就用新格高重算位移。
用輪詢而非只掛 `resize`：捲軸出現或字型載完造成的重排不一定觸發 resize，但一樣會改 `--u`。
可從 `window.__JOIN_DEBUG__.roll` 的 `ticks` / `fixes` 觀察守衛有沒有作動。

⚠️ **部署後馬上測會看到舊版**：`/assets/*.js` 的 `Cache-Control: max-age=600`，
瀏覽器十分鐘內會用快取的舊檔。curl 帶 query 破快取看到的是新的，但頁面請求的是
不帶 query 的同一個 URL，所以會拿到舊的。debug 過程中在這裡卡了一輪 —— 測線上
記得先確認瀏覽器真的載到新版（例如檢查某個新符號存在），不要直接相信 curl。

**併入時對交付包做的兩處修正**（要重新從交付包推導的人請注意）：

1. `.odo__reel` 必須加 `align-self: flex-start`。真正的 `join.css` 裡 `.odo__d` 是
   `align-items: center` 的 flex 容器，帶子（21 格）比格子高就會被置中，起點量到
   -920px，滾輪會停在錯的數字。實測拿掉該行即重現。
2. 收尾走既有的 `setCountValue()`，不是交付包的 `setSignupCount()` —— 後者只寫
   `data-value`，會讓 `role="img"` 的 `#signupNumber` 掉了 `aria-label`。

另外：進場滾動會先等第一次 fetch 最多 900ms，好讓滾輪直接落在真值，而不是滾到
`baseValue` 再閃一下改掉。逾時就用 `baseValue` 起跑，晚到的值由 `ROLL.pending`
在收尾時補上。舊的 rAF 逐格計數動畫（`animateCountTo`）已移除。

CSS 動過，對稿三關已重跑：`spec-check` 24/24 PASS、`compare.html` 36 PASS + 既有的
兩項 3px 欄位交錯誤差，無新增 FAIL。

## 下一步

值到手就是改 `assets/join.config.js` 一行、commit、推上 main 自動部署。

1. **GA4 measurement ID** → `ga4.measurementId`（見上面「卡著、擋路的事」）。
2. **倒數目標日** → `countdown.targetIso`（例如 `"2026-09-15T00:00:00+08:00"`）。
   沒定就留 null，兩個倒數區塊都不顯示。
3. **性別比區塊**：等 Morgan 在上面三個方案裡決定，不要逕自實作隨機值版本。
4. **分享卡數字會過時**：`assets/join/og-image.png` 是截真實首屏產生的靜態圖，
   目前是 `00298`，線上實際已經跟著 Sheet 走。要更新就改 `signup.baseValue`
   再跑 `tools/build-og-image.sh`（需本機 static server 與 gstack browse）。
5. **真機驗證**（Morgan 自己跑）：手機用 LINE 和 Threads 的內建瀏覽器各開一次
   https://gettreehouse.app/join/ ，確認「我要報名」沒掉出第一屏。那兩個 webview
   會多吃 60–110px 高度，桌機模擬器量不出來。
6. **表單裡的測試資料要刪**：私有表單回應表目前有一筆 `morgan_testing_not_realig`
   測試列，會被算進 `新表單報名數`（所以線上顯示 299 而不是 298）。上線前刪整列。
7. 有時間再做：Chiron Sung HK 自架成子集（目前外連 Google Fonts 約 858KB，
   是頁面剩下最大的一塊）。做完要重跑對稿三關。

## `handoff/` 的去處（已處理）

推成 `design-baseline` branch 永久保留在 repo 裡當視覺基準，`main` 與出貨 branch
上都已移除。原因見上面「對稿門檻」那節。之後要改視覺、要重跑對稿，都從那個 branch
臨時取出來用。

## GitHub 帳號

repo 在 c6ntech org，但這台 Mac 的 git 預設認證是 hytmots，直接 push 會 403。
已設全域規則讓 `github.com/c6ntech/*` 走 `gh auth git-credential`（active account
= c6ntech），其餘 repo 維持 osxkeychain。Windows 那邊如果也有雙帳號要比照處理。

## 沒有同步到這個 repo 的東西（刻意的，不是漏掉）

需求脈絡的原始文件在另一個資料夾：`C:\Projects\Treehouse App Beta Recruiting Website\`
（Windows 機器本機路徑，這個資料夾本身不是 git repo）：

- `Treehouse_招募網頁_規格書_for_CC.md.docx`、`Treehouse_Beta_Test_Program_v4.docx` — 規格與流程脈絡
- `Treehouse_舊名單_Beta追蹤_v4.xlsx`、`Treehouse_Beta_訊息清單_v2.xlsx` — **含真實個資**
  （IG ID、性別、年齡、感情狀態），刻意不進任何 git repo，不上 GitHub
- `ios-store-image/ios/*.png` — 輪播圖原始高解析度檔

這些文件裡真正影響工程實作的內容，已經吸收進 `join.config.js` 的註解、
`handoff/HANDOFF_NOTES.md`、跟這份文件本身。若含個資那兩份 xlsx 需要在 Mac 上用，
得自己用 GitHub 以外的方式搬（AirDrop／隨身碟／私人雲端），不建議推上 GitHub。

## UTM 命名規則

見 `join/UTM_RULES.md`（規則、`utm_content` 取名格式、什麼時候換 campaign、範例）。
產生器在 `join/utm-tool/`，線上 <https://gettreehouse.app/join/utm-tool/>。
規則若有變動，`UTM_RULES.md` 與 `utm-tool/index.html` 的說明要一起改。

重點：`utm_content` 每篇貼文都要不同且全小寫。程式把網址參數名稱**原樣**帶進 GA4，
不做大小寫正規化，`utm_Source` 會對不上後台註冊的 `utm_source`。

## 頁尾（08-20 起關閉，App 正式上線要開回來）

`footer.enabled = false`。頁尾（treehouse 字標 + 隱私權政策／使用條款／刪除帳戶／
常見問題 + 版權）在 Beta 期間先不顯示，Morgan 2026-08-20 決定，理由是想等 App 正式
上線再一起加上。

HTML 裡 `#joinFooter` 預設就帶 `hidden`，旗標打開時才由 join.js 移除 —— 這樣 JS
沒跑到也不會先閃一下才消失。實測：關閉時高度 0、不佔版位；打開時高度 162。

⚠️ **正式上線前要記得開回來**（`join.config.js` 的 `footer.enabled` 改 true）。
本頁有載入 GA4，一般慣例會在頁面上留一個隱私權政策的入口；Beta 期間頁面本身不收資料
（報名走 Google 表單）所以影響有限，但這是暫時狀態，不是最終設計。

## 分享卡 `assets/join/og-image.png`

是把 `/join` 在 1200x630 視窗下**截真實首屏**產生的靜態圖（`tools/build-og-image.sh`），
所以卡片上的東西會隨時間過時：

- **報名人數**：08-20 已重截為 `00115`（Sheet 起算值由 298 改為 113）。之後頁面數字
  會繼續長，卡片不會。
- **倒數**：現在卡片上印著「6 天 13 時 33 分 56 秒」。這比數字更糟 —— 秒數在靜態圖上
  永遠是錯的，天數每天差一天。

**未決（Morgan 08-20 表示明天再處理）**：把卡片上的數字改成 `???` 之類不會過時的呈現。
倒數建議一併處理，兩者是同一類問題。在那之前每次改 `signup` 或 `countdown` 設定後
都要重跑 `PORT=<port> bash tools/build-og-image.sh`（需本機 static server + gstack browse）。


---

# 2026-08-21 關機前狀態快照

`main` = `9bf6d17`，working tree 乾淨，本機與 `origin/main` 同一個 commit。
`design-baseline` 本機與遠端也同步（`43a1b4c`）。網頁相關的東西**全部在 GitHub 上**。

線上實測（https://gettreehouse.app/join/）：

| 項目 | 狀態 |
|---|---|
| 報名人數 | 225（Sheet B1；113 起算 + 112 表單填答） |
| 男女比 | 51% / 49% |
| 倒數 | 5 天（目標 2026-08-27 12:00 +08:00） |
| 頁尾 | 隱藏（`footer.enabled: false`） |
| GA4 | `gtag` 已載入，`G-J6XWVKCZXS` |
| Sheet 抓取 | 正常，`__JOIN_DEBUG__.lastError` 為空 |
| Console | 無錯誤 |

## Google Sheet 的坑（08-20 深夜踩過一次，記下來）

**症狀**：網頁顯示 259，但表單其實只有 46 筆。查下來是儀表板 B3 的
`新表單報名數` 數出 146。

**原因**：`COUNTA` 數的是「非空白儲存格」不是「列」。`IMPORTRANGE` 的範圍字串
若跨了多欄（例如 `A2:C`），46 個人就會被數成三倍。

**更重要的第二層問題**：`IMPORTRANGE` 的範圍是**字串**，不像一般參照會跟著欄位
插入自動位移。Morgan 後來在回應分頁最前面插了一欄自用，時間戳記從 A 移到 B ——
儀表板那條寫死的字串不會跟著改，只會靜靜地數錯欄，**不會報錯**。

**建議的長久解法**（08-21 已建議，Morgan 自行決定是否套用）：把計算搬回私有表，
儀表板只拉一格。

- 私有表新增一個分頁（例如 `stats`），`A1` 放 `=COUNTA('表單回應 1'!B2:B)`
  —— 這是同份試算表內的一般參照，之後插欄會自動變成 `C2:C`，不用人工維護。
- 儀表板 B3 改成 `=IFERROR(IMPORTRANGE("<私有表ID>","stats!A1"),0)`
  —— `stats!A1` 這個位置永遠不動。

**檢查方式**：`curl` 打 gviz 端點看 B1，跟表單實際筆數對一下。
數字停住不動、或跟表單差很多，先懷疑這條公式。

```
curl -s "https://docs.google.com/spreadsheets/d/105ymHSvKcdbQ33xiKtSXF0DPkltpWZYmR2frPQCMTPs/gviz/tq?tqx=out:json&range=B1&t=$(date +%s)"
```

## 沒有進 repo 的檔案（Windows 本機，關機後留在這台）

`C:\Projects\Treehouse App Beta Recruiting Website\`：

- `Treehouse_招募網頁_規格書_for_CC.md.docx`、`Treehouse_Beta_Test_Program_v4.docx` — 規格與流程
- `Treehouse_舊名單_Beta追蹤_v4.xlsx`、`Treehouse_Beta_訊息清單_v2.xlsx` — **含真實個資**，刻意不進 git
- `PROMPT_1_GA4設定.md`、`PROMPT_2_開始日期討論.md` — 給 Claude web 的 prompt，兩件事都已完成，任務結束
- `ios-store-image/`、`楓之谷預熱網頁參考.png` — 素材原始檔（壓縮版已在 repo 內）

這些**不影響**在別台機器接手網頁工作 —— 該吸收的內容都已經寫進 repo 裡的註解與本文件。

## 明天（08-21 之後）待辦

1. **分享卡 `og-image.png` 上的動態值** —— 現在烤進了報名人數與倒數（含秒數）。
   Morgan 08-20 說隔天處理，方向是把數字改成不會過時的呈現（例如 `???`）。
   倒數建議一併處理，是同一類問題。
2. **頁尾** —— App 正式上線時把 `footer.enabled` 改回 `true`。
3. **外包 CSV** —— 到手後把 `genderRatio.mode` 改成 `"csv"` 並填 `csvUrl`，
   並處理下面那三件事（`paused_*` 沒有視覺、負數沒擋、誤差固定偏女性）。
4. **內部流量排除** —— Morgan 在 GA4 後台補（原訂 08-22）。
5. App Store／Google Play 連結（Public Release 前）。


---

# 2026-08-23 交接快照（Mac → Windows）

`main` = 這一版，working tree 乾淨，本機與 `origin/main` 同一個 commit。
**網頁相關的東西全部在 GitHub 上**，沒有留在 Mac 的檔案。（repo 目錄下有一個
41MB 的 `Treehouse App 商店圖片設計.zip`，被 `.gitignore` 的 `*.zip` 排除，
是素材原始檔，不需要跨機器搬。）

線上實測（https://gettreehouse.app/join/ ，手機 390×844）：

| 項目 | 狀態 |
|---|---|
| 報名人數 | 366（Sheet B1，`lastGoodFetch` 有值） |
| 男女比 | 女 53% / 男 47%，加總 100 |
| 倒數 | 3 天 19 時（目標 2026-08-27 12:00 +08:00） |
| CTA | 首屏內，餘裕 40px |
| 計數器滾動 | 收尾正常，守衛 `fixes: 0` |
| GA4 | `gtag` 已載入 |
| `lastError` | 空 |
| Console | 無訊息 |

---

# 2026-08-26 Windows 接手後的改動

## 男女比：49–53 → 51–53 → 固定 66 → 固定 63 → 階梯表

分兩步發生在同一天。**先**收窄帶寬 49–53 → 51–53（女性 51~53 ＝ 男性 47~49，
男性永遠不會過半），這是明確放棄 08-21 那個「帶寬跨過 50 才有真實感」的取捨。
**後**（同日 18:30）Morgan 指示直接寫死 **女 66%**，浮動整個停用；20:41 再改 63；
20:44 改成依報名人數下降的**階梯表**（65→60），做法與完整對照表見上面
「⏳ 目前是『階梯表』」那節。51–53 的參數與說明都保留著，切回浮動時可直接用。詳細參數、實測數字、
以及踩到的兩個量測陷阱都寫在上面「性別比區塊」那節（已整節重寫）。

`policyFemalePct` 的邏輯一行都沒動 —— 這次只改設定值與註解。

### 一起修掉的四件事（08-26 adversarial review 抓的）

1. **`join.js` 的 `DEFAULTS.genderRatio` 還停在 47–53**，08-21 收成 49–53 時沒同步。
   它是當時唯一還能畫出男性過半的路徑：設定檔 parse 失敗 + 有人開 `?flags=on`
   （`join.js:52` 會強制 `enabled = true`，繞過預設的 `enabled: false`）。
   已對齊成 **65 / 65**（`steps` 停用時的後備值）。
   **以後改帶寬或改固定值，記得 `join.config.js` 與 `join.js` 的 DEFAULTS 兩邊一起改。**
2. `join.js` `renderGenderRatio()` 的四捨五入註解寫「49–53 帶寬碰不到 .5」，帶寬名稱過時。
3. `join/index.html` 的靜態預設值是 `width:45%` / `55%`、文字「女性 45% / 男性 55%」，
   **男性過半**，牴觸新規則。JS 一畫就蓋掉所以平常看不到，但 csv 模式第一次 fetch 前、
   以及不跑 JS 的文字擷取器讀到的就是它。已改成 65 / 35（對齊當下階梯值）。同一個看板的靜態計數器也對齊 baseValue，與 baseValue 一致 —— 日後調整固定值或 baseValue，這兩處都要一起改。
4. `join.config.js` 三處註解不精確（50 不會出現寫成無條件成立、分佈沒標 n 範圍、
   跳動幅度歸因錯給 `changeEverySignups`）。已更正。

### 部署當下會發生、但不是 bug 的一件事

`join.js` 開頭寫著不變條件「報名人數沒動 → 比例不動」。**部署那一刻這條會斷一次。**

⚠️ 實際出貨的轉換是 **49–53（線上現況）→ 固定 66**，不是中間那個 51–53
（51–53 只存在於同日稍早的工作區，從未上線）。以出貨的 `policyFemalePct` 實測
n=690~760：**71 個點全部改變**，每一點都往上跳 13~17 個百分點。以部署當下的
n=741 為例，線上現在顯示 **女53%**，推完會變 **女66%**。

所以訪客會看到比例往上跳一大截、報名人數卻沒動。這比帶寬微調明顯得多
（先前 49–53 → 51–53 只有 30/71 個點會變、幅度 1~3pp）。刻意選在流量低點推，
不要在 8/27 12:00 尖峰推。

## 倒數歸零行為（08-26 實測驗證）

用過去日期與「未來 22 秒」兩種方式、200ms 取樣實測：

| 檢查 | 結果 |
|---|---|
| 跨過目標時間 | **自動切換，不需要重新整理** |
| `00 秒` 停留 | 剛好 1.0 秒（就是最後那一秒本身），不是卡住 |
| 切換後 | 穩定，不跳回、不閃爍 |
| `#countdownSection` | `hidden`、`display:none`、高度 0，不佔版位 |
| `#countdownLive` | 顯示「公測已經開始 / 測試進行中，手刀快加入！」，高度 91px |
| CTA 是否還在首屏 | 在，餘裕 42px（比倒數狀態的 40px 多 2px） |
| 人數／性別比／Console | 不受影響，無錯誤 |

**8/27 12:00 之後要記得做的事**：分享卡 `og-image.png` 仍烤著一個倒數，頁面卻已經
顯示「公測已經開始」，兩邊會自相矛盾。12:00 過後第一件事就是重截卡片 + Scrape Again。

---

## 這三天（08-21 ~ 08-23）在 Mac 上改了什麼

### 1. 男女比帶寬 47–53 → 49–53（`96f839a`）
Morgan：「男生 53 太多了，上限 51」。女性 49~53 ＝ 男性 47~51。男性過半的時間
從 22% 降到 5%，且只剩「女 49」這一格，連續長度固定就是 `changeEverySignups`。
`femaleBias` 維持 1.0，但帶寬縮掉後它的影響變小（0→11% / 0.5→8% / 1.0→5%），
1.5 以上已無意義。實測對照表在 `join.config.js` 與上面「性別比區塊」那節。

### 2. 男性百分比改成從女性推導（`210f6e6`）
原本兩邊各自 `Math.round`，csv 模式下真實比例落在 x.5 時會雙雙進位、顯示
女50% + 男51% = 101%。policy 模式輸出零差異（v=0..100 全掃）。
**csv 模式上線前還有三件事要補，見上面那一節。**

### 3. 抓取失敗不再掉回 baseValue（`30d6972`）—— 這是這三天最重要的一件事
**事故**：08-22 傍晚 Morgan 回報「網頁突然變 113」。真值 310。原因是對 Sheet 的
fetch 偶發失敗一次，程式就顯示 `signup.baseValue`，而輪詢是 10 分鐘一次 ——
一次 0.5 秒的網路抖動會讓訪客看到十分鐘的錯誤數字。

三層防線：

- **localStorage 快取上次抓到的真值**。key 是 `th_join_signup_count:<sheetId>`
  （綁 sheet id，換表自動失效）、TTL 24 小時、上界五位數、失效即刪。抓失敗時顯示
  `max(快取, baseValue)` —— 人數只增不減，取大的比較接近真值。
  `mode: "mock"` 與未設 `sheetUrl` 不吃快取，維持設定檔對 mock 的契約。
- **退避重試** 800 / 2500 / 6000ms，±30% jitter。背景分頁不打，**但額度會還回去
  並掛一次性 `visibilitychange`，回到前景立刻補跑** —— 不能靠 `startPolling` 那條，
  它要求距離上次執行超過一整個輪詢間隔（10 分鐘）才補，切出去三十秒再回來不會動。
  4xx（429 除外）視為永久性錯誤，不重試。
- **`online` 事件補抓**（debounce 2 秒 + 隨機延遲），補掉「重試用完到下一輪輪詢」
  之間最長十分鐘的盲區。手機切 Wi-Fi/4G、進電梯的斷線都比重試窗長。

過程中一併修掉三個會讓上面失效的坑：

1. **B1 空白時 `Number(null)` 是 0 而且 `isFinite(0)` 為真** → 會被當成抓成功，
   把好的快取覆蓋成 0、畫面顯示 `00000`。現在空值/非正數一律視為錯誤走重試。
   （IMPORTRANGE 重算期間就可能短暫回空值，這不是假設性問題。）
2. **fetch 沒有逾時** → 行動網路下可以懸掛數分鐘，in-flight 旗標永遠是 true，
   輪詢／online／回前景三條補抓路徑全被吞。加了 8 秒 AbortController 逾時，
   沒有 AbortController 的舊瀏覽器用 `Promise.race` 補。
3. **渲染例外會落進 fetch 的 catch** → 一個畫面 bug 會被回報成 `data_fetch_error`
   送進 GA4，還白白觸發三次網路重試。改成 `.then(成功, 失敗)` + 內層 try/catch。

**已知限制（沒辦法從客戶端解）**：第一次進站的人 + 那一刻 fetch 失敗 + 瀏覽器沒有
快取 → 只能顯示 `baseValue`。所以才有下面那件事。

### 4. `baseValue` 語意改變 + 自動對齊（`30d6972`）
**以前**：對齊 Sheet 的 B2 起算值（113）。**現在**：貼近當下真值。

`tools/build-og-image.sh` 每次重截分享卡時會自動把 `signup.baseValue` 改成當下
真值（讀 `__JOIN_DEBUG__.lastGoodFetch.sheet`，整行必須只有數字才採用）。所以
**跑那支腳本會順手改一個進版控的原始碼檔**，跑完 `git status` 會多一個
`assets/join.config.js` 的改動，這是預期的，不是誤改。

### 5. UTM：這一波只發 Threads
Morgan 08-21 確認。規則、已發連結記錄表、Threads 轉址包裝（`l.threads.com/?u=`）
的辨識方式都寫在 `join/UTM_RULES.md`。**每次給新連結都要一併提醒發文前的兩步驟**
（重截分享卡 → Meta Sharing Debugger 按 Scrape Again），見 `UTM_RULES.md` §二之二。

## 給接手的人：容易踩的三個坑

1. **對稿工具會被 localStorage 快取影響**。同一台機器重跑 `compare.html` /
   `spec-check.html` 時，計數器顯示的數字取決於上一輪殘留的
   `th_join_signup_count:<sheetId>`，不再是穩定的 `baseValue`。要比對截圖就先清掉
   那個 key，或用無痕。
2. **改 `assets/*.js` 之後測線上會看到舊版**（`max-age=600`）。確認某個新符號存在
   再相信畫面，不要直接相信 curl（curl 帶 query 破快取，頁面請求的是不帶 query 的
   同一個 URL）。
3. **Windows 那邊的 git 帳號**：repo 在 c6ntech org。Mac 這台已設
   `github.com/c6ntech/*` 走 `gh auth git-credential`（active account = c6ntech），
   Windows 如果也有雙帳號要比照處理，否則 push 會 403。

## 目前開著的待辦（依急迫度）

1. **8/27 12:00 公測開始** —— 倒數到點會自動從「距離公測開始還有」切成
   「公測已經開始」，不需要改設定或重新部署（已用過去日期實測過）。但 CTA 仍然是
   Google 表單，公測當天要不要換掉、換成什麼，還沒定。
2. **內部流量排除**（GA4 後台）—— 原訂 08-22，Morgan 自己補。沒排除的話你我測試
   的流量都會算進報表。
3. **外包 CSV** —— 到手後把 `genderRatio.mode` 改成 `"csv"` 並填 `csvUrl`，
   **同時要處理上面「csv 模式上線前要補的三件事」**（`paused_*` 是 dead code、
   負數沒擋、四捨五入誤差固定偏女性）。
4. **頁尾** —— App 正式上線時把 `footer.enabled` 改回 `true`。
5. **App Store / Google Play 連結** —— Public Release 前補進 `cta.iosUrl` /
   `androidUrl`，並把 `cta.mode` 改成 `"device"`。
6. **分享卡的網址沒有版本號** —— `og:image` 永遠是同一個 URL，Meta 照網址快取，
   換了圖它不一定馬上知道（08-22 遇過一次，Scrape Again 後仍顯示舊圖，等一下才更新）。
   根治方式是掛 `?v=<時間戳>` 並讓 `build-og-image.sh` 自動更新。08-22 提過，
   Morgan 當時說不急，沒做。
7. **Chiron Sung HK 仍外連 Google Fonts**（約 858KB），是頁面剩下最大的一塊。
