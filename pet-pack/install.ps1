# 把肆喵宠物包装进 dsh-pet（Windows）
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
if (-not (Test-Path $dshHome)) { throw "找不到 DSH_HOME：$dshHome（可先设环境变量 DSH_HOME）" }

$petRoot = Join-Path $dshHome 'dsh-pet\pet'
$animDir = Join-Path $petRoot 'simiao-animation'
New-Item -ItemType Directory -Force -Path $animDir | Out-Null

Copy-Item (Join-Path $src 'simiao-config.json') $petRoot -Force
Copy-Item (Join-Path $src 'simiao-animation\*.webm') $animDir -Force

$n = (Get-ChildItem $animDir -Filter *.webm | Measure-Object).Count
Write-Output "✓ 已安装到 $petRoot（动画 $n 段）"
Write-Output "下一步：刷新 DSH 页面即可看到肆喵；改大小/位置/display 请编辑 simiao-config.json。"
