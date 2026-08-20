#!/usr/bin/env bash
# =============================================================================
# 產生 /join 用的自架字型子集（assets/fonts/*.woff2 + assets/fonts.css）
#
# 為什麼要這支：Claude Design 交付的是原始 TTF，Noto Sans TC 一支 6.8MB，
# Regular + Bold 兩支就 13.6MB。/join 是從 Threads／LINE 點進來的手機轉換頁，
# 在字型下載完之前使用者看到的是 fallback 系統字，也就是行高與字寬跟設計稿
# 對不起來的那個狀態。
#
# 做法（兩層 unicode-range，不是單純砍字）：
#   critical — 本頁目前實際用到的字，明列每一個 codepoint。約 20–30KB，
#              一定會下載，決定首屏什麼時候變成正確的字。
#   rest     — 這套字剩下的所有字，依 codepoint 切成 8 塊。宣告在 critical
#              之前，所以 critical 有的字一律由 critical 供應；只有當頁面
#              出現 critical 沒有的字（改文案、加新區塊）瀏覽器才會去抓
#              對應的那一塊，不會整包 2MB 拉下來，也不會出現豆腐字。
#
# 所以改文案「不需要」重跑這支；重跑只是把新文案收進 critical、少一次
# 額外請求。真的重跑之後請跑一次 handoff/ 的三支驗收工具確認對稿沒跑掉。
#
# 用法：  bash tools/build-fonts.sh
# 依賴：  uv（pyftsubset 由 uvx 臨時取得，不會裝進系統）
# 來源：  handoff/assets/fonts/*.ttf —— 保留原始 TTF 當作重建來源，不要刪
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="handoff/assets/fonts"
OUT="assets/fonts"
PYFT=(~/.local/bin/uvx --quiet --with brotli --from fonttools pyftsubset)

[ -d "$SRC" ] || { echo "找不到原始 TTF：$SRC" >&2; exit 1; }
mkdir -p "$OUT"

# --- 1. 收集本頁實際用到的字 ------------------------------------------------
# 掃 join/index.html 的文字內容，以及 join.config.js / join.js 裡會被寫進 DOM
# 的字串。多收一點沒關係（多幾個 codepoint 對檔案大小影響極小），漏收才麻煩。
CHARS=$(python3 - <<'PY'
import re, pathlib
text = ""
for p in ["join/index.html", "assets/join.config.js", "assets/join.js"]:
    text += pathlib.Path(p).read_text(encoding="utf-8")
# 一律加上：ASCII 可見字元、全形標點、常用符號，之後改文案比較不會踩到
text += "".join(chr(c) for c in range(0x20, 0x7F))
text += "０１２３４５６７８９，。、；：？！「」『』（）【】〈〉…—～·％＄＋－×÷／　"
text += "年月日時分秒天週星期上午下午今明昨"
cps = sorted({ord(ch) for ch in text if ord(ch) > 0x1F and ch not in "\r\n\t"})
print(",".join("U+%04X" % c for c in cps))
PY
)
CRIT_RANGE=$(printf '%s' "$CHARS")
echo "critical 收錄 $(printf '%s' "$CHARS" | tr ',' '\n' | wc -l | tr -d ' ') 個 codepoint"

# rest 的 8 塊：涵蓋 CJK 統一漢字、擴充 A、相容漢字、注音、假名、全形符號
REST_RANGES=(
  "U+3000-303F,U+3100-312F,U+31A0-31BF,U+3040-30FF,U+FF00-FFEF,U+2000-206F,U+2E80-2EFF,U+3200-33FF"
  "U+4E00-5FFF"
  "U+6000-6FFF"
  "U+7000-7FFF"
  "U+8000-8FFF"
  "U+9000-9FFF"
  "U+3400-4DBF"
  "U+F900-FAFF,U+20000-2A6DF"
)

# --- 2. 產生子集 ------------------------------------------------------------
subset () { # subset <src.ttf> <out.woff2> <unicodes>
  "${PYFT[@]}" "$1" \
    --output-file="$2" --flavor=woff2 \
    --unicodes="$3" \
    --layout-features='*' --no-hinting --desubroutinize \
    --drop-tables+=DSIG
}

rm -f "$OUT"/*.woff2

# Caprasimo 只給字標用，latin 一層就夠
subset "$SRC/Caprasimo-Regular.ttf" "$OUT/caprasimo-latin.woff2" \
  "U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215"

# Noto Sans TC：只做 400 與 700。join.css 只用到這兩個字重，
# 交付包裡的 Medium(500) 沒有任何規則會叫到，所以不產生、也不宣告。
for W in 400:Regular 700:Bold; do
  WEIGHT="${W%%:*}"; NAME="${W##*:}"
  subset "$SRC/NotoSansTC-$NAME.ttf" "$OUT/noto-sans-tc-$WEIGHT-critical.woff2" "$CRIT_RANGE"
  i=0
  for R in "${REST_RANGES[@]}"; do
    subset "$SRC/NotoSansTC-$NAME.ttf" "$OUT/noto-sans-tc-$WEIGHT-rest-$i.woff2" "$R" || true
    i=$((i + 1))
  done
done

# --- 3. 產生 fonts.css ------------------------------------------------------
{
  cat <<'HEAD'
/* ============================================================
   Treehouse /join — 字型（由 tools/build-fonts.sh 產生，不要手改）

   ⚠ 設計稿 Join Page.dc.html 用的就是這三套；缺任何一套，字重與字寬都會
   fallback 成系統字，整頁的行高與間距都會跟設計稿不同。
   Caprasimo / Noto Sans TC 為自架子集；Chiron Sung HK 與設計稿相同、
   自 Google Fonts 載入（join/index.html 的 <head>）。

   Noto Sans TC 分兩層：rest-* 先宣告、critical 後宣告，所以同一個字兩邊
   都有時一律由 critical 供應。頁面上現有的字只會下載 critical；改了文案
   出現新字，瀏覽器才會去抓對應的那一塊 rest，不會有豆腐字。
   ============================================================ */

@font-face {
  font-family: "Caprasimo";
  src: url("fonts/caprasimo-latin.woff2") format("woff2");
  font-weight: 400; font-style: normal; font-display: swap;
}
HEAD
  for WEIGHT in 400 700; do
    i=0
    for R in "${REST_RANGES[@]}"; do
      printf '\n@font-face {\n  font-family: "Noto Sans TC";\n  src: url("fonts/noto-sans-tc-%s-rest-%s.woff2") format("woff2");\n  font-weight: %s; font-style: normal; font-display: swap;\n  unicode-range: %s;\n}\n' "$WEIGHT" "$i" "$WEIGHT" "$R"
      i=$((i + 1))
    done
  done
  for WEIGHT in 400 700; do
    printf '\n@font-face {\n  font-family: "Noto Sans TC";\n  src: url("fonts/noto-sans-tc-%s-critical.woff2") format("woff2");\n  font-weight: %s; font-style: normal; font-display: swap;\n  unicode-range: %s;\n}\n' "$WEIGHT" "$WEIGHT" "$CRIT_RANGE"
  done
} > assets/fonts.css

echo "--- 產出 ---"
ls -la "$OUT" | awk 'NR>3 {print $5, $9}'
echo "critical 合計：$(du -ch "$OUT"/*critical*.woff2 "$OUT"/caprasimo-latin.woff2 2>/dev/null | tail -1 | cut -f1)"
