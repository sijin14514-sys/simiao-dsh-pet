#!/bin/sh
# 肆喵 · 独立桌面版安装（macOS / Linux）
#
# 用法：sh install.sh
#
# 做三件事：
#   ① 找到桌宠程序的用户目录
#   ② 装角色（characters/simiao）并把当前角色切为 simiao
#   ③ 让她"会说话"：自定义台词 + 干活汇报概率门 + 自言自语 + 气泡配图
#
# 载体程序（dsh-pet-indesktop）各平台打包形式不同，需自行安装并运行过一次。

set -e
SRC=$(cd "$(dirname "$0")" && pwd)
CHAR_SRC="$SRC/characters/simiao"
TALK_DIR="$SRC/talk"
[ -d "$CHAR_SRC" ] || { echo "✗ 找不到角色目录：$CHAR_SRC（请确认本脚本与 characters 同目录）"; exit 1; }

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

# ① 装角色
CHAR_DST="$FOUND/characters/simiao"
mkdir -p "$CHAR_DST"
cp -R "$CHAR_SRC/." "$CHAR_DST/"
N=$(find "$CHAR_DST/videos" -name '*.webm' | wc -l | tr -d ' ')
echo "✓ 角色已就位：$CHAR_DST（$N 段动画）"

# ②③ 切角色 + 开启「会说话」（python3 合并 JSON；必须写无 BOM 的 UTF-8）
CFG="$FOUND/config.json"
if [ ! -f "$CFG" ]; then
  echo "! 没找到 $CFG"
  echo "  请先运行一次桌宠程序，再重新执行本脚本。"
  exit 1
fi
cp "$CFG" "$CFG.bak"

if command -v python3 >/dev/null 2>&1; then
  python3 - "$CFG" "$TALK_DIR" "$FOUND" <<'PY'
import json, os, sys

cfg_path, talk_dir, user_dir = sys.argv[1], sys.argv[2], sys.argv[3]


with open(cfg_path, encoding='utf-8-sig') as f:
    cfg = json.load(f)
old = cfg.get('character')
cfg['character'] = 'simiao'

phr = os.path.join(talk_dir, 'simiao-phrases.json')
if os.path.isfile(phr):
    with open(phr, encoding='utf-8-sig') as f:
        cfg['dialogue_mode'] = 'custom'
        cfg['dialogue_phrases'] = json.load(f)

al = cfg.setdefault('agent_link', {})
al['report_gates'] = {'state': 1.0, 'activity': 1.0, 'approval': 1.0, 'done': 1.0,
                      'exec_failed': 1.0, 'model_access': 1.0, 'stuck': 1.0, 'bridge': 1.0}
al['notify_activity'] = True

cfg['self_talk_enabled'] = True
cfg['self_talk_min_interval'] = 8.0
cfg['self_talk_max_interval'] = 18.0
cfg['self_talk_duration_seconds'] = 4.0
# 空目录 = 纯文字气泡（程序源码约定：空即不带配图）
cfg['self_talk_image_dir'] = ''
cfg['self_talk_texts'] = [
    '主人～肆喵在这儿守着，放心忙吧喵。',
    '要不要喝口水呀？肆喵帮您看着屏幕。',
    '唔…眼镜又滑下来了，推一下。',
    '这个任务看起来好难，主人加油喵！',
    '肆喵的尾巴有点痒……不管了，先盯着进度。',
    '主人，累了就歇一会儿嘛。',
    '刚才那个文件改好了吗？肆喵有点好奇。',
    '偷偷告诉主人：肆喵觉得您挺厉害的。',
]

with open(cfg_path, 'w', encoding='utf-8') as f:      # 无 BOM
    json.dump(cfg, f, ensure_ascii=False, indent=2)

print(f'✓ 角色已切换：{old} → simiao')
print('✓ 已开启「会说话」：台词 %d 个事件 + 干活汇报 + 自言自语'
      % len(cfg.get('dialogue_phrases', {}).get('global', {})))
PY
else
  echo "! 没找到 python3，无法自动写配置。请手动："
  echo "  1) 把 config.json 里的 \"character\" 改成 \"simiao\""
  echo "  2) 想让联动与自言自语生效，参考 talk/simiao-phrases.json"
fi

echo ""
echo "✅ 完成。重启桌宠即可看到会说话的肆喵。"
