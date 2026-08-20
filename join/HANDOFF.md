# /join — 進度交接（跨機器接續用）

最後更新：2026-08-20 傍晚，Windows，`main`（`feature/join-beta-recruit` 已 squash merge
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
  並填 `csvUrl`，就會改讀 App 後台真實數字。
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
- 報名人數動了 → 比例才小幅漂移，幅度由 `driftPerSignups` 控制

用 value noise（整數格點雜湊 + smoothstep 內插）而非直接雜湊每個 n，否則多一個人報名
就可能讓比例跳好幾個百分點，跟人數變化對不上。落在 50 時會依雜訊方向分流到 49 或 51
（不固定推同一邊，否則那個值的出現次數會比鄰居高一大截，分佈自己會露餡）。

帶寬 `femaleMin: 46 / femaleMax: 56` —— 跨過 50 兩側，女性有時多有時少（Morgan 要求：
不可能一直女生比較多，要維持真實感）。

08-20 已 `enabled: true` 上線。CC 曾提出區塊標題「目前報名性別比」與數字代表的
「派發比例」語意不同、建議改文案，Morgan 決定文案不動、功能照做。這是已經過的討論，
不用再提。

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
