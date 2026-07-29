# treehouse-web

樹屋 Treehouse App 官方網頁。五個共用版型頁面，滿足 App Store / Google Play 上架審核，並在 App 內以 in-app webview 呈現。

- 線上網址（規劃）：`https://gettreehouse.app`
- Host：GitHub Pages（比照 cherryon-web → cherryontech.com 模式）
- 公司主體：櫻桃科技有限公司 Cherryon CO., LTD.

## 頁面

| 路由 | 檔案 | 用途 |
|---|---|---|
| `/` | `index.html` | 首頁（4 頁入口，暫用骨架樣式，待 CD 視覺） |
| `/privacy` | `privacy/index.html` | 隱私權政策（Apple + Google 必填） |
| `/terms` | `terms/index.html` | 使用條款 |
| `/delete-account` | `delete-account/index.html` | 刪除帳戶說明（Apple + Google 必填） |
| `/faq` | `faq/index.html` | 常見問題（兼 Apple Support URL） |
| `/child-safety` | `child-safety/index.html` | 兒少性剝削與虐待防範聲明（Google Play Child Safety Standards 必填） |
| `/*` | `404.html` | 找不到頁面 |

乾淨網址（無 `.html`）靠「資料夾 + `index.html`」達成，GitHub Pages 原生支援。

## 架構

- **純靜態**，無 build 步驟。GitHub Pages 直接服務 repo 根目錄。
- **共用版型集中兩處**：
  - `assets/styles.css` — 所有視覺 token 與元件樣式（`:root` 變數，改一處全站生效；CD 的視覺產出接手這裡）。
  - `assets/app.js` — header / footer / 語言切換的單一來源（JS 注入，改一處全站生效）。
- **內容內嵌於各頁 HTML**（`<article data-lang="zh">`），即使 JS 失效，法律正文仍可讀（webview / 審核穩定性）。
- **語言偵測**：機制已內建於 `app.js`。英文版未到位前 `EN_READY=false`，全站顯示中文。英文內容補上後把 `EN_READY` 設為 `true`、於各頁加入 `<article data-lang="en">` 區塊即可自動依瀏覽器語言切換。

## 本機預覽

```bash
cd treehouse-web
python -m http.server 8787
# 開 http://127.0.0.1:8787/
```

## 部署（GitHub Pages）

1. Push 到 GitHub repo（建議名稱 `treehouse-web`）。
2. Repo → Settings → Pages → Source = `Deploy from a branch`，branch = `main` / root。
3. Custom domain 填 `gettreehouse.app`（repo 已含 `CNAME`）。
4. 勾選 `Enforce HTTPS`。
5. porkbun DNS 指向 GitHub Pages（見交接文件 `03_Morgan操作_Porkbun_DNS.md`）。

## 待辦

- [ ] Phase B：CD 產出視覺，覆寫 `assets/styles.css`（＋自架字體 / logo）。
- [ ] 英文翻譯到位後啟用雙語（`EN_READY=true` + 各頁 en 區塊）。
- [ ] 兩份草稿的「生效日期」上線前填入。
