# 肆喵喵 demo · 第 3 步：PNG 帧序列 → VP9-alpha webm（dsh-pet 唯一的播放格式）
#
# 参数与项目素材链 encode_thumbs.py 一致：libvpx-vp9 / yuva420p / crf 40 / 24fps，
# 必须 -auto-alt-ref 0，否则 VP9 的 alpha 通道会丢。
#
# 用法：pwsh -File 工具/编码.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ffmpeg = Get-ChildItem (Join-Path $root '工具\ffmpeg') -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
  Select-Object -First 1
if (-not $ffmpeg) { throw "找不到 ffmpeg，请确认 临时\ffmpeg\ 下有构建（见 工具/下载ffmpeg.mjs）" }

$framesRoot = Join-Path $root '临时\帧'
$outDir = Join-Path $root 'pet\simiao-animation'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

foreach ($dir in Get-ChildItem $framesRoot -Directory) {
  $name = $dir.Name
  $dst = Join-Path $outDir "$name.webm"
  & $ffmpeg.FullName -y -loglevel error -framerate 24 -i (Join-Path $dir.FullName 'frame_%04d.png') `
    -c:v libvpx-vp9 -pix_fmt yuva420p -crf 40 -b:v 0 -auto-alt-ref 0 -deadline good -cpu-used 4 -row-mt 1 $dst
  if ($LASTEXITCODE -ne 0) { throw "编码失败：$name" }
  $size = [math]::Round((Get-Item $dst).Length / 1KB, 1)
  Write-Output "[$name] → $dst（$size KB）"
}
Write-Output "完成，输出目录：$outDir"
