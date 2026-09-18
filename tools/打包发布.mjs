import { fileURLToPath } from 'node:url';
// 打包"肆喵"pet pack：生成可供任意 dsh-pet 用户安装的发布目录
// 用法：node 工具/打包发布.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, existsSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/, '') + '\\';
const OUT = ROOT + '发布\\simiao-pet\\';
const ANIM = OUT + 'simiao-animation\\';

rmSync(ROOT + '发布', { recursive: true, force: true });
mkdirSync(ANIM, { recursive: true });

// 1) 动画 + 配置（发布版把 display 改成 web：新用户开箱即见，且不用先下 Electron）
const src = readdirSync(ROOT + 'pet\\simiao-animation').filter((f) => f.endsWith('.webm'));
for (const f of src) copyFileSync(ROOT + 'pet\\simiao-animation\\' + f, ANIM + f);

const config = JSON.parse(readFileSync(ROOT + 'pet\\simiao-config.json', 'utf8'));
config.pets[0].display = 'web';          // 桌面模式要让用户自己开（会触发 Electron 下载）
config.pets[0].name = '肆喵';
delete config.pets[0].whisperEnabled;
delete config.pets[0].workStatusEnabled;
writeFileSync(OUT + 'simiao-config.json', JSON.stringify(config, null, 2) + '\n');

// 2) 预览图（放一张总览，方便别人一眼看到）
if (existsSync(ROOT + '预览\\AI动画全套.png')) copyFileSync(ROOT + '预览\\AI动画全套.png', OUT + 'preview.png');

// 3) 说明文档
writeFileSync(OUT + 'README.md', `# 肆喵 · dsh-pet 宠物包（pet pack）

一只住在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 网页 / 桌面里的桌宠，
按 dsh-pet 官方支持的 **pet pack**（额外宠物种类）方式分发——**不改插件源码，装完就能用**。

- 20 段动画全部由 AI 图生视频生成（非贴图变换）：待机呼吸 / 打瞌睡 / 抱着枕头睡觉 / 看书 / 擦汗 / 戴耳机听歌 /
  左右张望 / 招手打招呼 / 摇头晃脑 / 冒爱心 / 原地转圈 / 吃零食 / 小碎步走路 /
  点击回应-开心跃动 / 被吓一跳 / 生气跺脚 / 鼓掌庆祝 / 鞠躬 / 被鼠标拖拽悬空反抗 / 余额-钱袋如常
- **点击反馈有 5 种**（每次点她随机抽一段）；**待机 65% 是站着呼吸**，动作之间会歇一歇，不会一直忙
- 640×360 VP9-alpha webm，浏览器（Chrome/Edge/Firefox）与桌面模式（Electron）通用

![预览](preview.png)

## 一、前置条件

先装好 dsh-pet 插件（本项目只是它的宠物包，不含插件本体）：

\`\`\`sh
dsh plugin --profile web add dsh-pet
\`\`\`

## 二、安装本宠物包

### Windows（PowerShell）

\`\`\`powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\\install.ps1
\`\`\`

### macOS / Linux

\`\`\`sh
sh ./install.sh
\`\`\`

### 手动安装

把这两个东西放进 \`$DSH_HOME/dsh-pet/pet/\`（\`$DSH_HOME\` 默认是 \`~/.dsh\`）：

\`\`\`
$DSH_HOME/dsh-pet/pet/
├─ simiao-config.json
└─ simiao-animation/        ← 20 个 .webm 平铺在里面
\`\`\`

目录名必须与配置文件名前缀一致（\`simiao-config.json\` ↔ \`simiao-animation/\`）。

## 三、安装后

- **刷新浏览器页面**即可看到肆喵（文件宠物无需重启 DSH）。
- 设置页**不会列出**文件宠物（dsh-pet 的既定行为）——要改大小 / 位置 / 显示方式，直接编辑 \`simiao-config.json\`：
  - \`display\`：\`web\`（只在网页，默认）/ \`desktop\`（只在桌面）/ \`both\`（两边都显示）/ \`none\`
  - \`size\`：显示尺寸（默认 380）；\`position.corner\`：\`top-left|top-right|bottom-left|bottom-right\`
  - 桌面模式首次使用会自动下载 Electron（约 138MB），不想下就保持 \`web\`。
- **卸载**：删掉 \`$DSH_HOME/dsh-pet/pet/\` 下的 \`simiao-config.json\` 与 \`simiao-animation/\` 即可。

## 四、说明与授权

- 本宠物包是 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的**衍生作品**（pet pack 形式）。
  按该项目的二创约定，**任何介绍、展示、分发本作品的地方都请附上原作者地址**：<https://github.com/PC2005-cloud/dsh-pet>
- 动画素材由**即梦 AI 图生视频**生成（角色形象来自作者本人提供的立绘），素材使用请遵循你与即梦之间的服务条款。
- 插件本体（dsh-pet）的代码许可见其仓库；本宠物包只包含配置与素材。
`);

// 4) 安装脚本（.ps1 必须带 UTF-8 BOM，否则 Windows PowerShell 5.1 按 ANSI 读会乱码）
writeFileSync(OUT + 'install.ps1', '\uFEFF' + `# 把肆喵宠物包装进 dsh-pet（Windows）
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
if (-not (Test-Path $dshHome)) { throw "找不到 DSH_HOME：$dshHome（可先设环境变量 DSH_HOME）" }

$petRoot = Join-Path $dshHome 'dsh-pet\\pet'
$animDir = Join-Path $petRoot 'simiao-animation'
New-Item -ItemType Directory -Force -Path $animDir | Out-Null

Copy-Item (Join-Path $src 'simiao-config.json') $petRoot -Force
Copy-Item (Join-Path $src 'simiao-animation\\*.webm') $animDir -Force

$n = (Get-ChildItem $animDir -Filter *.webm | Measure-Object).Count
Write-Output "✓ 已安装到 $petRoot（动画 $n 段）"
Write-Output "下一步：刷新 DSH 页面即可看到肆喵；改大小/位置/display 请编辑 simiao-config.json。"
`);

writeFileSync(OUT + 'install.sh', `#!/bin/sh
# 把肆喵宠物包装进 dsh-pet（macOS / Linux）
set -e
SRC=$(cd "$(dirname "$0")" && pwd)
DSH_HOME="\${DSH_HOME:-$HOME/.dsh}"
[ -d "$DSH_HOME" ] || { echo "找不到 DSH_HOME：$DSH_HOME"; exit 1; }

PET="$DSH_HOME/dsh-pet/pet"
ANIM="$PET/simiao-animation"
mkdir -p "$ANIM"
cp "$SRC/simiao-config.json" "$PET/"
cp "$SRC"/simiao-animation/*.webm "$ANIM/"

echo "✓ 已安装到 $PET（动画 $(ls "$ANIM" | wc -l | tr -d ' ') 段）"
echo "下一步：刷新 DSH 页面即可看到肆喵；改大小/位置/display 请编辑 simiao-config.json。"
`);

console.log(`发布目录：${OUT}`);
console.log(`动画 ${src.length} 段，配置 display=${config.pets[0].display}`);
console.log(readdirSync(OUT).join(' / '));
