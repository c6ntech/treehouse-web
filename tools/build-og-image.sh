#!/usr/bin/env bash
# =============================================================================
# 重新產生 /join 的分享卡 assets/join/og-image.png（1200×630）
#
# 這張是連結貼到 Threads／LINE 時最多人看到的圖，必須跟 /join 桌機首屏長得一樣 ——
# 所以不另外做一張設計稿，直接把真實頁面在 1200×630 視窗下截下來。改了首屏視覺
# 就重跑這支，不會有「分享卡跟落地頁不同一套」的問題。
#
# 注意：畫面裡的報名人數是截圖當下的值。Sheet 接上去之後線上數字會繼續跳，
# 這張是靜態的 —— 想讓它接近真實值就先改 join.config.js 的 signup.baseValue
# 再重跑，或定期重跑一次。
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
