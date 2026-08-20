# /join — 進度交接（跨機器接續用）

最後更新：2026-08-20，Mac，branch `feature/join-beta-recruit`。
（前一版 2026-08-19 Windows，內容已被這一版取代。）

**上線時程：8/21（五）網頁要上線，8/25（二）12:00 Beta 開始發連結。**

## 現況

Claude Design 的視覺已經整支併進 repo，對稿三關全部通過。剩下的全部是資料層，
跟視覺解耦，換機器繼續做沒有風險。

- `assets/join.css` 已被交付版整支覆蓋，`join/index.html` 依交付結構重寫。
- `assets/join.js` 沿用 repo 原本那支（資料層沒動），只補了視覺需要的三段邏輯。
- 字型已子集化、`forest.svg` 已壓縮，`/join` 傳輸量從約 15MB 降到 283KB。
- 已推上 `origin/feature/join-beta-recruit`。**還沒開 PR，還沒跑 `/review`。**

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

## 卡著、擋路的事

**唯一真正擋 8/21 上線的項目：Google Sheet 網址。** Morgan 建好「儀表板」試算表
（只有 A1=`signup_count`、B1=數字，用 IMPORTRANGE 從私有的表單回應表拉值）後給網址，
填進 `join.config.js` 的 `signup.sheetUrl` 即可。

**CORS 已經實測過，不是風險。** gviz 端點會回反射式 `access-control-allow-origin`：
帶 `Origin: https://gettreehouse.app` curl 拿得到，真實瀏覽器 fetch 也成功。
不需要備案。目前 `sheetUrl: null`，`fetchSignupCount()` 第一件事就是沒有 id 就直接
`return Promise.resolve(null)`，完全不對外連線，畫面顯示 `baseValue: 298`。

不擋 8/21，但之後要補：GA4 measurement ID、外包 CSV 網址（男女比例，Beta 後期才開）、
App Store／Google Play 正式連結（Public Release 前給）、倒數計時目標日
（`countdown.targetIso`，Morgan 未決定）。

## 下一步（照順序）

1. Sheet 網址到手 → 填 `signup.sheetUrl` → 重跑一次頁面確認數字有跳
2. `/review` 過一次
3. 真機 LINE／Threads 內建瀏覽器實測首屏可視高度（Morgan 自己跑）

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
