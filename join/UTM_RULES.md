# /join 的 UTM 命名規則

給發文的人看的。目的只有一個：**發文之後能回答「哪一篇貼文帶進多少人、多少人按了報名」。**

工具在 <https://gettreehouse.app/join/utm-tool/>（不會被搜尋引擎索引，存書籤即可）。
開頁就會依今天日期把代稱填好，選平台、按複製就能用。這份文件是給你了解規則、
以及工具不夠用時查的。

---

## 一、規則

完整連結長這樣：

```
https://gettreehouse.app/join/?utm_source=<平台>&utm_medium=<類型>&utm_campaign=<這一波>&utm_content=<這篇貼文的代稱>
```

| 參數 | 怎麼填 | 說明 |
|---|---|---|
| `utm_source` | `threads` | **這一波只發 Threads**，固定填這個（Morgan 2026-08-21 確認）。工具下拉選單仍留 ig / line，未來要用再選 |
| `utm_medium` | 由 source 自動決定 | threads、ig → `social`；line → `message`。不用自己選 |
| `utm_campaign` | `beta_recruit_join` | 這一波招募固定用這個，換波才換（見第三節） |
| `utm_content` | `MMDD` + `d` + 第幾天 | **唯一每篇要換的東西**。工具會自動帶 |

### `utm_content` 的格式

```
0820d1      8/20，招募第 1 天
0821d2      8/21，第 2 天
0827d8      8/27，第 8 天（公測開始那天）
```

前面是月日（`MMDD`），後面是招募第幾天。**第一天是 2026-08-20**。

同一天發第二篇就在後面加字母：

```
0820d1      當天第一篇
0820d1b     當天第二篇
0820d1c     當天第三篇
```

### 硬規則（違反了數字就對不上）

1. **全部小寫。** 程式把網址上的參數**原樣**送進 GA4，不做大小寫正規化。
   寫成 `utm_Source` 的話，GA4 後台註冊的維度是 `utm_source`，就對不上、查不到值。
   （工具會自動轉小寫，手打才要注意。）
2. **只用英數字。** 不要有空格、中文、`?`、`&`、emoji。
3. **每篇的 `utm_content` 都要不一樣。** 兩篇用同一個代稱，數據會被合併，
   分不出哪篇有效。
4. **代稱一旦用出去就不要改。** 改了等於變成新的一篇，前後數據接不起來。
5. **這一波的 `utm_source` 只有 `threads`。** Beta 招募只在 Threads 發文，IG／LINE
   目前沒有發（Morgan 2026-08-21 確認）。工具的下拉選單保留另外兩個平台是為了以後，
   現階段一律用預設的 Threads，不要自己換成 `ig` 或 `line` —— 換了報表上會多出
   一個沒有真實流量對應的來源。

---

## 二、範例

**今晚（2026-08-20，d1）發 Threads：**

```
https://gettreehouse.app/join/?utm_source=threads&utm_medium=social&utm_campaign=beta_recruit_join&utm_content=0820d1
```

**同一晚再發一篇：**

```
https://gettreehouse.app/join/?utm_source=threads&utm_medium=social&utm_campaign=beta_recruit_join&utm_content=0820d1b
```

**明天（8/21，d2）：**

```
https://gettreehouse.app/join/?utm_source=threads&utm_medium=social&utm_campaign=beta_recruit_join&utm_content=0821d2
```

**LINE 官方帳號群發（這一波沒有用，留著當以後的格式參考）：**

```
https://gettreehouse.app/join/?utm_source=line&utm_medium=message&utm_campaign=beta_recruit_join&utm_content=0820d1
```

（不同平台可以用同一個 `utm_content`，因為 `utm_source` 已經分得開。）

---

## 二之一、已經發出去的連結（發一篇就補一行）

只記真的貼出去的，沒發的不要寫進來 —— 這張表是日後對 GA4 數字時唯一的依據。

| 日期 | 代稱 | 平台 | 連結 |
|---|---|---|---|
| 2026-08-20 | `0820d1` | threads | `https://gettreehouse.app/join/?utm_source=threads&utm_medium=social&utm_campaign=beta_recruit_join&utm_content=0820d1` |
| 2026-08-21 | `0821d2` | threads | `https://gettreehouse.app/join/?utm_source=threads&utm_medium=social&utm_campaign=beta_recruit_join&utm_content=0821d2` |

8/20 那筆已於 2026-08-21 從貼文本體回推確認，四個參數與上表一致。
（HANDOFF.md 的 GA4 驗證表裡出現過 `utm_content: "d1_intro"`，那是 8/20 20:29 做事件
實測時手打的值，不是真的發出去的連結，不用管。）

### Threads 會把連結包一層

從 Threads 貼文複製回來的連結長這樣，**這是正常的，不是連結被改掉**：

```
https://l.threads.com/?u=<原連結整條 URL-encode>&e=<Threads 的簽章>
```

`u` 就是你貼上去的原網址，點下去會轉址過去、query string 原樣保留，所以 GA4 照樣
收得到 UTM。要驗證發出去的是哪一個代稱，把 `u` 的值 URL-decode 開來看即可。
副作用只有 referrer 會變成 `l.threads.com`，但我們靠的是 `utm_source` 不是 referrer。

---

## 三、什麼時候該換 `utm_campaign`

`utm_campaign` 是「這一波在做什麼」，不是「哪一篇」。目前只有一個值：

- `beta_recruit_join` —— Beta 招募（2026-08-20 起）

之後要換的時機：

- 進 Public Release、CTA 從表單改成商店連結時 → 換成 `public_release`
- 之後有獨立的推廣檔期（例如投廣告） → 另外開一個，例如 `ads_2026q4`

換 campaign 時，**同時改 `join/utm-tool/index.html` 裡的 `CAMPAIGN` 與 `CAMPAIGN_START`**，
天數會重新從 d1 算起。

---

## 四、怎麼看成效

GA4 → 事件 `cta_click`，用 `utm_content` 拆分，就是每篇貼文各帶進多少次「我要報名」點擊。
`page_view` 同樣可以拆，兩者相除是該篇的點擊轉換率。

`utm_source` / `utm_medium` / `utm_campaign` / `utm_content` 四個都已經在 GA4 後台
註冊成事件範圍的自訂維度，報表裡查得到。

**表單那端不需要另外設定。** 整體流失率＝GA4 的 `cta_click` 總數 vs Google 表單收件數，
兩邊各自算就好。只有想知道「**填完表單的人**分別來自哪篇貼文」才需要在表單加隱藏題、
抓 `entry.<id>` 對應碼 —— 那是另一層維護成本，目前刻意不做。

---

## 五、注意事項

- **不帶 UTM 直接進 `/join/` 不會壞**，只是那次流量在報表裡歸在「直接／未知來源」，
  分不出是哪來的。所以貼文連結一律帶。
- **UTM 會自動接到報名表單的連結上**：使用者帶著 UTM 進來、點「我要報名」，
  那些參數會原樣接到 `forms.gle` 的網址後面。這只影響我們自己的歸因，
  不代表 Google 表單會把它存進回覆（見上一節）。
- **前期沒帶 UTM 的流量補不回來。** GA4 只能記錄當下收到的東西，事後無法回溯補標。

---

最後更新：2026-08-21（加上「只發 Threads」與已發連結記錄）。規則有變請一起更新 `join/utm-tool/index.html`
（`CAMPAIGN`、`CAMPAIGN_START`、`defaultContent()` 與畫面上的說明文字）。
