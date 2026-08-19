# /join — 進度交接（跨機器接續用）

最後更新：2026-08-19 22:xx（台灣時間），Windows 機器，branch `feature/join-beta-recruit`。

**上線時程：8/21（五）網頁要上線，8/25（二）12:00 Beta 開始發連結。**

## 現況

- 頁面結構、資料層、互動邏輯都已實作完成，本機測試通過（手機 390×844／390×700 首屏免捲動、輪播露邊、GA4 no-op、UTM passthrough、旗標區塊展開都驗證過）。
- 尚未 commit 進 `main`，還沒開 PR，還沒跑 `/review`。
- 這個 branch 已推到 GitHub：`origin/feature/join-beta-recruit`。

## 檔案

- `join/index.html` — 頁面本體
- `join/utm-tool/index.html` — 給 Morgan 的 UTM 連結產生器
- `join/design/cd-handoff/JOIN_STYLE_BRIEF.md` — 給 Claude Design 的結構交接單（不含配色，等 Morgan 提供視覺參考）
- `assets/join.config.js` — 所有可調數值＋功能旗標（唯一 source of truth）
- `assets/join.css` / `assets/join.js` — 樣式與邏輯
- `assets/join/carousel/*.webp`、`assets/join/og-image.png` — 已壓縮的圖片素材
- `faq/index.html` — 順手修正「3 天免費試用」為免同步寫法（已 commit）

## 卡著、擋路的事

**唯一真正擋 8/21 上線的項目：Google Sheet 網址。** Morgan 8/19 說當天會建好「儀表板」試算表（只有 A1=`signup_count`、B1=數字，用 IMPORTRANGE 從私有表單回應表拉值）並給網址。網址一到，`join.config.js` 的 `signup.sheetUrl` 填進去，驗證 `range=B1` 的 gviz fetch 能不能跨網域拿到（CORS 沒實測過，是目前最大的技術風險），再過一次 smoke test。

不擋 8/21，但之後要補：GA4 measurement ID、外包 CSV 網址（男女比例，大機率 8/21 前不會到，本來就是 Beta 後期才開）、App Store／Google Play 正式連結（Public Release 前給）、倒數計時目標日（Morgan 未決定）。

## 下一步（照順序）

1. Sheet 網址到手 → 接上、驗證、smoke test（見上）
2. 把 `join/design/cd-handoff/JOIN_STYLE_BRIEF.md` 交給 Claude Design，Morgan 自己提供視覺參考 → 拿回重寫過的 `join.css`（可能還有 `join/index.html` 的 DOM patch）→ 整合回來
3. `/review` 過一次
4. 真機 LINE／Threads 內建瀏覽器實測首屏可視高度（Morgan 8/21 自己跑，不是 CC 的工作）
5. `/ship`：開分支 PR（已經是分支了，直接開 PR）→ merge → GitHub Pages 自動部署 → `/canary` 盯上線狀態

## 本機預覽

```
cd treehouse-web
python -m http.server 8787
# http://127.0.0.1:8787/join/
```

## 沒有同步到這個 repo 的東西（刻意的，不是漏掉）

需求脈絡的原始文件在另一個資料夾：`C:\Projects\Treehouse App Beta Recruiting Website\`（Windows 機器本機路徑，這個資料夾本身不是 git repo）：

- `Treehouse_招募網頁_規格書_for_CC.md.docx`、`Treehouse_Beta_Test_Program_v4.docx` — 規格與流程脈絡
- `Treehouse_舊名單_Beta追蹤_v4.xlsx`、`Treehouse_Beta_訊息清單_v2.xlsx` — **含真實個資**（IG ID、性別、年齡、感情狀態），刻意不進任何 git repo，不上 GitHub
- `楓之谷預熱網頁參考.png` — 視覺參考圖（資訊密度參考，不是視覺風格參考）
- `ios-store-image/ios/*.png` — 輪播圖原始高解析度檔（已壓縮版本在這個 repo 裡了，原始檔沒進來）

這些文件裡真正影響工程實作的內容，已經吸收進 `join.config.js` 的註解、`JOIN_STYLE_BRIEF.md`、跟這份文件本身——續接這個 branch 的工作不需要原始文件。若要重新核對規格原文，或含個資那兩份 xlsx 需要在 Mac 上用，得自己用 GitHub 以外的方式搬（AirDrop／隨身碟／私人雲端），不建議推上 GitHub。
