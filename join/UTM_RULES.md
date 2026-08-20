# /join 的 UTM 命名規則

給發文的人看的。目的只有一個：**發文之後能回答「哪一篇貼文帶進多少人、多少人按了報名」。**

工具在 <https://gettreehouse.app/join/utm-tool/>（不會被搜尋引擎索引，存書籤即可）。
下拉選平台、填一個代稱、按複製 —— 正常情況不需要自己拼字串，這份文件是給你了解
規則、以及工具不夠用時查的。

---

## 一、規則

完整連結長這樣：

```
https://gettreehouse.app/join/?utm_source=<平台>&utm_medium=<類型>&utm_campaign=<期間>&utm_content=<這篇貼文的代稱>
```

| 參數 | 怎麼填 | 說明 |
|---|---|---|
| `utm_source` | `threads` / `ig` / `line` | 貼在哪個平台。工具的下拉選單就是這個 |
| `utm_medium` | 由 source 自動決定 | threads、ig → `social`；line → `message`。不用自己選 |
| `utm_campaign` | `beta_recruit_join` | 這一波招募固定用這個，換波才換（見下方「什麼時候該換 campaign」） |
| `utm_content` | 自己取 | **唯一每篇都要換的東西**，用來分辨是哪一篇貼文 |

### 硬規則（違反了數字就對不上）

1. **全部小寫。** 程式是把網址上的參數名稱**原樣**抄進 GA4，不會自動修正大小寫。
   寫成 `utm_Source` 的話，GA4 那邊註冊的維度是 `utm_source`，就對不上、查不到值。
2. **只用英數字、底線、連字號。** 不要有空格、中文、`?`、`&`、emoji。
3. **`utm_content` 每篇貼文都要不一樣。** 兩篇用同一個代稱，數據會被合併在一起，
   分不出來哪篇有效。
4. **代稱一旦用出去就不要改。** 改了等於變成新的一篇，前後數據接不起來。

---

## 二、`utm_content` 怎麼取

格式：`d<第幾天>_<主題>`，需要同一天發多篇同主題時後面加序號。

```
d1_intro          第一天，介紹型貼文
d1_intro_b        同一天同主題的第二篇（A/B 測試或補發）
d2_howitworks     第二天，講玩法
d3_gender         第三天，講性別平衡機制
d4_founder        第四天，創辦人視角／幕後
d5_lastcall       最後一天，催報名
```

「第幾天」從**招募開始那天**算 d1，不是從月初算。這一波 d1 = 2026-08-20。

主題用一兩個英文字，看得懂就好，不用嚴謹。常用的：

| 代稱 | 用在哪種貼文 |
|---|---|
| `intro` | 這是什麼 App、介紹 |
| `howitworks` | 玩法、三回合、話題卡 |
| `gender` | 性別平衡機制 |
| `founder` | 創辦人視角、為什麼做這個、幕後 |
| `story` | 使用者故事、體驗心得 |
| `update` | 進度更新、bug 修正、數字回報 |
| `lastcall` | 催報名、倒數 |
| `pricing` | 付費揭露相關（Public Release 才會用到） |

---

## 三、什麼時候該換 `utm_campaign`

`utm_campaign` 是「這一波在做什麼」，不是「哪一篇」。目前只有一個值：

- `beta_recruit_join` —— Beta 招募（2026-08-20 起到公測開始）

之後要換的時機：

- 進 Public Release、CTA 從表單改成商店連結時 → 換成 `public_release`
- 之後有獨立的推廣檔期（例如投廣告） → 另外開一個，例如 `ads_2026q4`

換 campaign 之後，`utm_content` 的 `d<n>` 重新從 d1 算起。

---

## 四、範例

**今晚（2026-08-20，d1）發 Threads 的第一篇：**

```
https://gettreehouse.app/join/?utm_source=threads&utm_medium=social&utm_campaign=beta_recruit_join&utm_content=d1_intro
```

**同一晚再發一篇講玩法的：**

```
https://gettreehouse.app/join/?utm_source=threads&utm_medium=social&utm_campaign=beta_recruit_join&utm_content=d1_howitworks
```

**LINE 官方帳號發給已加好友的人：**

```
https://gettreehouse.app/join/?utm_source=line&utm_medium=message&utm_campaign=beta_recruit_join&utm_content=d1_broadcast
```

---

## 五、怎麼看成效

GA4 → 事件 `cta_click`，用 `utm_content` 拆分，就是每篇貼文各帶進多少次「我要報名」點擊。
`page_view` 同樣可以拆，兩者相除是該篇的點擊轉換率。

`utm_source` / `utm_medium` / `utm_campaign` / `utm_content` 四個都已經在 GA4 後台
註冊成事件範圍的自訂維度，報表裡查得到。

**表單那端不需要另外設定。** 整體流失率＝GA4 的 `cta_click` 總數 vs Google 表單收件數，
兩邊各自算就好。只有想知道「**填完表單的人**分別來自哪篇貼文」才需要在表單加隱藏題、
抓 `entry.<id>` 對應碼 —— 那是另一層維護成本，目前刻意不做。

---

## 六、注意事項

- **不帶 UTM 直接進 `/join/` 不會壞**，只是那次流量在報表裡歸在「直接／未知來源」，
  分不出是哪來的。所以貼文連結一律帶。
- **UTM 會自動接到報名表單的連結上**：使用者帶著 UTM 進來、點「我要報名」，
  那些參數會原樣接到 `forms.gle` 的網址後面。這只影響我們自己的歸因，
  不代表 Google 表單會把它存進回覆（見上一節）。
- **前期沒帶 UTM 的流量補不回來。** GA4 只能記錄當下收到的東西，事後無法回溯補標。

---

最後更新：2026-08-20。規則有變請一起更新 `join/utm-tool/index.html`。
