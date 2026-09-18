# 肆喵喵 demo · 预览：把 5 段 webm 接成一张 GIF（深灰底），方便不装插件也能看动效
#
# 注意：-c:v libvpx-vp9 必须放在 -i 之前，否则原生 VP9 解码器会丢掉 alpha 层。
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File 工具/预览图.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ffmpeg = (Get-ChildItem (Join-Path $root '工具\ffmpeg') -Recurse -Filter ffmpeg.exe | Select-Object -First 1).FullName
$animDir = Join-Path $root 'pet\simiao-animation'
$outDir = Join-Path $root '预览'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$order = @('待机呼吸-AI', '打瞌睡-AI', '打哈欠-AI', '左右张望-AI', '招手打招呼-AI', '摇头晃脑-AI', '冒爱心-AI', '点击回应-开心跃动-AI', '鼓掌庆祝-AI', '小碎步走路-AI', '吃零食-AI', '看书-AI', '戴耳机听歌-AI', '擦汗-AI', '鞠躬-AI', '抱着枕头睡觉-AI', '被吓一跳-AI', '生气跺脚-AI', '被鼠标拖拽悬空反抗-AI', '余额-钱袋如常-AI')
$listFile = Join-Path $root '临时\concat.txt'
# 必须写无 BOM 的 UTF-8：ffmpeg 的 concat 列表会把 BOM 当成关键字的一部分而报错
$lines = $order | ForEach-Object { "file '$(Join-Path $animDir "$_.webm")'" }
[System.IO.File]::WriteAllLines($listFile, $lines, [System.Text.UTF8Encoding]::new($false))

# 单张总 GIF：深灰底 + 缩放 + 调色板量化（GIF 无 alpha，透明区显示为底色）
& $ffmpeg -y -loglevel error -c:v libvpx-vp9 -f concat -safe 0 -i $listFile `
  -filter_complex "color=c=0x2b2b2b:s=320x180[bg];[0:v]scale=320:180,fps=12[fg];[bg][fg]overlay=shortest=1,split[a][b];[a]palettegen[p];[b][p]paletteuse" `
  -loop 0 (Join-Path $outDir '演示-动画预览.gif')
if ($LASTEXITCODE -ne 0) { throw 'GIF 生成失败' }

$gif = Get-Item (Join-Path $outDir '演示-动画预览.gif')
Write-Output ("演示 GIF：{0}（{1} KB）" -f $gif.FullName, [math]::Round($gif.Length / 1KB, 1))
