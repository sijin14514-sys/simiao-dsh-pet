#!/bin/sh
# 肆喵 · 独立桌面版安装（macOS / Linux）
#
# 用法：sh install.sh
#
# 与 Windows 版不同，这里不自动下载安装"载体程序"（各平台打包形式不同），
# 只做两件事：找程序用户目录 → 装角色 + 切换当前角色。找不到就提示下载地址。

set -e
SRC=$(cd "$(dirname "$0")" && pwd)
CHAR_SRC="$SRC/characters/simiao"
[ -d "$CHAR_SRC" ] || { echo "✗ 找不到角色目录：$CHAR_SRC（请确认本脚本与 characters 同目录）"; exit 1; }

# 该程序可能的用户数据目录（按变体命名）
case "$(uname -s)" in
  Darwin) BASE="$HOME/Library/Application Support" ;;
  *)      BASE="${XDG_CONFIG_HOME:-$HOME/.config}" ;;
esac

FOUND=""
for name in dsh-pet-standalone-webm dsh-pet-standalone; do
  if [ -d "$BASE/$name" ]; then FOUND="$BASE/$name"; break; fi
done

if [ -z "$FOUND" ]; then
  echo "✗ 没有找到桌宠程序的用户目录（已找过：$BASE/dsh-pet-standalone-webm、$BASE/dsh-pet-standalone）"
  echo ""
  echo "请先安装独立桌宠程序 dsh-pet-indesktop："
  echo "  https://github.com/MerZlin/dsh-pet-indesktop/releases/latest"
  echo "装好并运行一次之后，再执行本脚本。"
  exit 1
fi

echo "目标目录：$FOUND"

# 1) 装角色
CHAR_DST="$FOUND/characters/simiao"
mkdir -p "$CHAR_DST"
cp -R "$CHAR_SRC/." "$CHAR_DST/"
N=$(find "$CHAR_DST/videos" -name '*.webm' | wc -l | tr -d ' ')
echo "✓ 角色已就位：$CHAR_DST（$N 段动画）"

# 2) 切换当前角色（务必写无 BOM 的 UTF-8；带 BOM 会被程序判定解析失败并退回内置角色）
CFG="$FOUND/config.json"
if [ -f "$CFG" ]; then
  cp "$CFG" "$CFG.bak"
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$CFG" <<'PY'
import json, sys
p = sys.argv[1]
with open(p, encoding='utf-8-sig') as f:
    cfg = json.load(f)
old = cfg.get('character')
cfg['character'] = 'simiao'
with open(p, 'w', encoding='utf-8') as f:      # 无 BOM
    json.dump(cfg, f, ensure_ascii=False, indent=2)
print(f'✓ 角色已切换：{old} → simiao')
PY
  else
    echo "! 没找到 python3，请手动把 config.json 里的 \"character\" 改成 \"simiao\""
    echo "  （也可以用桌宠右键菜单 → 角色菜单 → 肆喵 手动切换，无需改配置）"
  fi
else
  echo "! 没找到 $CFG"
  echo "  请先运行一次桌宠程序，再用右键菜单 → 角色菜单 → 肆喵 切换"
fi

echo ""
echo "✅ 完成。重启桌宠即可看到肆喵（或右键角色菜单手动切换）。"
