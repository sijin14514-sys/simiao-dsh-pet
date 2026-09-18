#!/bin/sh
# 把肆喵宠物包装进 dsh-pet（macOS / Linux）
set -e
SRC=$(cd "$(dirname "$0")" && pwd)
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
[ -d "$DSH_HOME" ] || { echo "找不到 DSH_HOME：$DSH_HOME"; exit 1; }

PET="$DSH_HOME/dsh-pet/pet"
ANIM="$PET/simiao-animation"
mkdir -p "$ANIM"
cp "$SRC/simiao-config.json" "$PET/"
cp "$SRC"/simiao-animation/*.webm "$ANIM/"

echo "✓ 已安装到 $PET（动画 $(ls "$ANIM" | wc -l | tr -d ' ') 段）"
echo "下一步：刷新 DSH 页面即可看到肆喵；改大小/位置/display 请编辑 simiao-config.json。"
