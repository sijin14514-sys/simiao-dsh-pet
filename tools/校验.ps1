# 肆喵喵 demo · 校验：ffprobe 元数据 + 抽帧（必须用 libvpx 解码，否则 VP9 的 alpha 层会丢）
#
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File 工具/校验.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ffmpeg = (Get-ChildItem (Join-Path $root '工具\ffmpeg') -Recurse -Filter ffmpeg.exe | Select-Object -First 1).FullName
$ffprobe = (Get-ChildItem (Join-Path $root '工具\ffmpeg') -Recurse -Filter ffprobe.exe | Select-Object -First 1).FullName
$outDir = Join-Path $root '临时\预览'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Remove-Item (Join-Path $outDir '*.png') -Force -ErrorAction SilentlyContinue

# 动画名 → 三个抽样时刻（秒），必须小于该段时长
$plan = [ordered]@{
  '待机呼吸'           = @(0.5, 3.0, 5.5)
  '打瞌睡'             = @(1.0, 3.5, 5.5)
  '冒爱心'             = @(0.5, 1.5, 5.0)
  '左右张望'           = @(0.5, 1.0, 3.5)
  '摇头晃脑'           = @(0.3, 1.0, 2.7)
  '原地转圈'           = @(0.5, 1.5, 3.5)
  '点击回应-开心跃动'   = @(0.4, 1.5, 2.3)
  '被鼠标拖拽悬空反抗' = @(0.5, 1.6, 3.5)
  '余额-钱袋如常'       = @(0.4, 0.9, 2.2)
}

foreach ($name in $plan.Keys) {
  $file = Join-Path $root "pet\simiao-animation\$name.webm"
  $info = & $ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration -of csv=p=0 $file
  Write-Output "$name : $info"
  $i = 0
  foreach ($t in $plan[$name]) {
    # 关键：-c:v libvpx-vp9 放在 -i 之前，libvpx 解码才保留 alpha
    & $ffmpeg -y -loglevel error -c:v libvpx-vp9 -ss $t -i $file -frames:v 1 -pix_fmt rgba (Join-Path $outDir "$name-$i.png")
    if ($LASTEXITCODE -ne 0) { throw "抽帧失败：$name @ $t" }
    $i++
  }
}
Write-Output "抽帧完成：$outDir（下一步 node 工具/校验.mjs 拼总览图）"
