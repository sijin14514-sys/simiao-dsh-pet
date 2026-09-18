# 批量入库：把 视频源/*.mp4 里还没转过的动作，全部处理成 pet/simiao-animation/*.webm
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File 工具/批量入库.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$ffmpeg = (Get-ChildItem (Join-Path $root '工具\ffmpeg') -Recurse -Filter ffmpeg.exe | Select-Object -First 1).FullName
$videos = Get-ChildItem (Join-Path $root '视频源') -Filter *.mp4
$done = 0
$failed = @()

foreach ($v in $videos) {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($v.Name)
  $webm = Join-Path $root "pet\simiao-animation\$name.webm"
  if (Test-Path $webm) { Write-Output "[跳过] $name（已有 webm）"; continue }

  Write-Output "=== 处理 $name ==="
  & node (Join-Path $root '工具\视频转桌宠.mjs') $v.FullName $name
  if ($LASTEXITCODE -ne 0) { Write-Output "  ✗ 抽帧/归一化失败"; $failed += $name; continue }

  $frames = Join-Path $root "临时\帧\$name\frame_%04d.png"
  & $ffmpeg -y -loglevel error -framerate 24 -i $frames -c:v libvpx-vp9 -pix_fmt yuva420p -crf 40 -b:v 0 -auto-alt-ref 0 -deadline good -cpu-used 4 -row-mt 1 $webm
  if ($LASTEXITCODE -ne 0) { Write-Output "  ✗ 编码失败"; $failed += $name; continue }
  Write-Output ("  ✓ {0}  {1} KB" -f $name, [math]::Round((Get-Item $webm).Length / 1KB, 1))
  $done++
}

Write-Output ""
Write-Output "完成 $done 条；失败 $(($failed | Measure-Object).Count) 条 $($failed -join ', ')"
Write-Output "已产出的 AI 动画："
Get-ChildItem (Join-Path $root 'pet\simiao-animation') -Filter '*-AI.webm' | Select-Object -ExpandProperty Name
