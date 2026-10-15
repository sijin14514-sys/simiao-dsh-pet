#!/usr/bin/env sh
# 肆喵 · DSH 侧桥接插件安装（macOS / Linux）
# 用法：sh ./install.sh [-h <DSH_HOME>] [-p <profile>]
set -eu

BRIDGE_DIR=$(cd "$(dirname "$0")" && pwd)
DSH_HOME_ARG=""
PROFILE="web"

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--dsh-home) DSH_HOME_ARG="$2"; shift 2 ;;
    -p|--profile) PROFILE="$2"; shift 2 ;;
    *) echo "未知参数：$1"; exit 1 ;;
  esac
done

echo ""
echo "【1】定位 DSH"
DSH_HOME="${DSH_HOME_ARG:-${DSH_HOME:-}}"
if [ -z "$DSH_HOME" ] || [ ! -d "$DSH_HOME" ]; then
  for c in "$HOME/dsh" "$HOME/deepseek-harness" "$HOME/.dsh"; do
    if [ -d "$c/profiles" ]; then DSH_HOME="$c"; break; fi
  done
fi
if [ -z "$DSH_HOME" ] || [ ! -d "$DSH_HOME" ]; then
  echo "  ! 没找到 DSH 根目录，请用 -h <路径> 指定"; exit 1
fi
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PKG="$PROFILE_DIR/package.json"
if [ ! -f "$PKG" ]; then
  echo "  ! profile「$PROFILE」不存在：$PROFILE_DIR"; exit 1
fi
echo "  ✓ DSH_HOME = $DSH_HOME"
echo "  ✓ profile  = $PROFILE"

echo ""
echo "【2】备份 profile 配置"
cp "$PKG" "$PKG.before-dsh-bridge-$(date +%Y%m%d-%H%M%S)"
echo "  ✓ 已备份"

echo ""
echo "【3】登记插件（依赖 + bundles）"
BRIDGE_PKG="$PKG" BRIDGE_DIR="$BRIDGE_DIR" node -e "
const fs = require('fs');
const pkgPath = process.env.BRIDGE_PKG;
const dir = process.env.BRIDGE_DIR;
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/, ''));
pkg.dependencies = pkg.dependencies || {};
const before = pkg.dependencies['@dsh-pet/bridge'] || '(无)';
pkg.dependencies['@dsh-pet/bridge'] = 'file:' + dir;
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
pkg.dsh.profile.bundles = pkg.dsh.profile.bundles || [];
const added = !pkg.dsh.profile.bundles.includes('@dsh-pet/bridge');
if (added) pkg.dsh.profile.bundles.push('@dsh-pet/bridge');
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', { encoding: 'utf8' });
console.log('  依赖: ' + before + ' → ' + pkg.dependencies['@dsh-pet/bridge']);
console.log('  bundles: ' + (added ? '已追加' : '已存在'));
"

echo ""
echo "【4】安装依赖（pnpm install）"
if ! command -v pnpm >/dev/null 2>&1; then
  echo "  ! 找不到 pnpm；请在 $PROFILE_DIR 里手动执行 pnpm install"; exit 1
fi
(cd "$PROFILE_DIR" && pnpm install)
if [ -f "$PROFILE_DIR/node_modules/@dsh-pet/bridge/index.js" ]; then
  echo "  ✓ 已装入 node_modules"
else
  echo "  ! node_modules 里没有 @dsh-pet/bridge"; exit 1
fi

echo ""
echo "【5】打开桌宠侧的联动开关"
PET_CFG=""
for c in "$HOME/Library/Application Support/dsh-pet-standalone-webm/config.json" \
         "${XDG_CONFIG_HOME:-$HOME/.config}/dsh-pet-standalone-webm/config.json" \
         "$HOME/Library/Application Support/dsh-pet-standalone/config.json" \
         "${XDG_CONFIG_HOME:-$HOME/.config}/dsh-pet-standalone/config.json"; do
  if [ -f "$c" ]; then PET_CFG="$c"; break; fi
done
if [ -n "$PET_CFG" ]; then
  cp "$PET_CFG" "$PET_CFG.before-dsh-bridge"
  PET_CFG="$PET_CFG" node -e "
const fs = require('fs');
const p = process.env.PET_CFG;
const c = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
c.agent_link = c.agent_link || {};
c.agent_link.dsh = true;
if (c.agent_link.notify_state === undefined) c.agent_link.notify_state = true;
fs.writeFileSync(p, JSON.stringify(c, null, 2), { encoding: 'utf8' });
console.log('  agent_link.dsh = true');
"
  echo "  ✓ 已改：$PET_CFG"
else
  echo "  ! 没找到桌宠用户目录；装好桌宠后把 config.json 的 agent_link.dsh 改成 true"
fi

echo ""
echo "装好了。最后一步：重启 DSH（bundles 变更不是热加载项）。"
echo "重启后验证：node \"$BRIDGE_DIR/check.mjs\""
