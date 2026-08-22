#!/usr/bin/env bash
# =============================================================================
# 重新產生 /join 的分享卡 assets/join/og-image.png（1200×630）
#
# 這張是連結貼到 Threads／LINE 時最多人看到的圖，必須跟 /join 桌機首屏長得一樣 ——
# 所以不另外做一張設計稿，直接把真實頁面在 1200×630 視窗下截下來。改了首屏視覺
# 就重跑這支，不會有「分享卡跟落地頁不同一套」的問題。
#
# 注意：畫面裡的報名人數是截圖當下的值。Sheet 接上去之後線上數字會繼續跳，
# 這張是靜態的 —— 要讓卡片接近真實值就定期重跑一次。
#
# 這支腳本跑完會「順手改一個原始碼檔」：把 assets/join.config.js 的 signup.baseValue
# 對齊當下真值（理由見腳本末段）。所以跑完 working tree 會多一個改動，commit 前
# 確認一下 git status，別把它跟無關的改動混在一起。
#
# 用法：  bash tools/build-og-image.sh
# 依賴：  gstack browse（~/.claude/skills/gstack/browse/dist/browse）、本機 static server
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${PORT:-8787}"
URL="http://127.0.0.1:$PORT/join/"
OUT="assets/join/og-image.png"
B="${BROWSE:-$HOME/.claude/skills/gstack/browse/dist/browse}"

[ -x "$B" ] || { echo "找不到 browse：$B" >&2; exit 1; }

if ! curl -sf -o /dev/null "$URL"; then
  echo "起一個 static server 再跑：python3 -m http.server $PORT" >&2
  exit 1
fi

"$B" viewport 1200x630 >/dev/null
"$B" goto "$URL" >/dev/null
"$B" js "new Promise(function(r){setTimeout(function(){r(1)},3500)})" >/dev/null   # 等字型與圖片
"$B" js "window.scrollTo(0,0)" >/dev/null
"$B" screenshot --viewport "$OUT" >/dev/null

echo "產出 $OUT"
ls -lh "$OUT" | awk '{print $5}'

# -----------------------------------------------------------------------------
# 順手把 join.config.js 的 signup.baseValue 對齊當下真值。
#
# baseValue 是「什麼都沒有時的最後防線」：抓 Sheet 失敗、而且這個瀏覽器也沒有
# localStorage 快取（＝第一次進站的人）時，畫面顯示的就是它。設成離真值很遠的
# 數字，那個最壞情況就會很難看 —— 2026-08-22 發生過一次，真值 310、訪客看到 113。
#
# 這支腳本每次都會讀到當下的真值，所以在這裡一起更新最省事。只有確定是從 Sheet
# 抓到的正整數才寫入（lastGoodFetch.sheet 有值），抓失敗時不動，免得把後備值
# 寫成另一個後備值。
# -----------------------------------------------------------------------------
# ⚠ 這裡不可以用 `tr -dc '0-9'` 把數字「挑」出來：browse 只要在最後一行印出任何
#   帶數字的狀態訊息（耗時、版本號），就會被挑成一個垃圾數字寫進設定檔，而且看起來
#   像成功。整行必須「只有數字」才採用。
#   `|| true` 是必要的：本檔開頭有 set -euo pipefail，管線非零會直接殺掉腳本，
#   下面那句「讀不到真值」永遠印不出來。
COUNT=$("$B" js "(function(){var d=window.__JOIN_DEBUG__;return (d&&d.lastGoodFetch&&d.lastGoodFetch.sheet)?d.lastGoodFetch.sheet.value:''})()" 2>/dev/null | tail -1 | tr -d '[:space:]' || true)
if printf '%s' "$COUNT" | grep -Eq '^[0-9]+$' && [ "$COUNT" -gt 0 ]; then
  COUNT="$COUNT" perl -pi -e 's/^(\s*baseValue: )\d+,/$1$ENV{COUNT},/' assets/join.config.js
  echo "baseValue 已對齊 $COUNT"
else
  echo "讀不到 Sheet 真值（收到：'${COUNT:-空}'），baseValue 保持原樣" >&2
fi
