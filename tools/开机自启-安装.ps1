# 肆喵喵 · 安装"开机自启"：登录后自动把 DSH 跑起来（桌宠随之出现）
#
# 做法：优先用「任务计划程序」的登录触发任务（无控制台窗口、可在任务计划里看到）；
#       若创建被系统拒绝，则退回「启动文件夹」放一个隐藏运行的 .vbs。
#
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File 工具/开机自启-安装.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $root '工具\启动桌宠.ps1'
if (-not (Test-Path $launcher)) { throw "找不到启动器：$launcher" }

$taskName = '肆喵桌宠(DSH web)'
$tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""

Write-Output "启动器: $launcher"
Write-Output "任务名: $taskName"

# —— 方案 A：任务计划程序（登录触发）——
$created = $false
try {
  $existing = schtasks /Query /TN $taskName 2>$null
  if ($LASTEXITCODE -eq 0) { schtasks /Delete /TN $taskName /F | Out-Null }
  schtasks /Create /TN $taskName /SC ONLOGON /TR $tr /F 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $created = $true
    Write-Output '✓ 已创建登录触发任务（任务计划程序 → 任务计划程序库 → 肆喵桌宠(DSH web)）'
  } else {
    Write-Output '· 任务计划程序创建被拒（可能需要管理员），改用启动文件夹。'
  }
} catch {
  Write-Output "· 任务计划创建异常：$($_.Exception.Message)，改用启动文件夹。"
}

# —— 方案 B：启动文件夹（隐藏运行）——
if (-not $created) {
  $startup = [Environment]::GetFolderPath('Startup')
  $vbs = Join-Path $startup '肆喵桌宠.vbs'
  $content = @"
' 开机自启：隐藏窗口运行 肆喵喵/工具/启动桌宠.ps1
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$launcher""", 0, False
"@
  Set-Content -LiteralPath $vbs -Value $content -Encoding Default
  Write-Output "✓ 已在启动文件夹放置：$vbs"
}

Write-Output ''
Write-Output '生效方式：下次登录 Windows 时自动启动（现在想立刻验证，可手动跑一次启动器）。'
Write-Output "卸载：powershell -File `"$(Join-Path $root '工具\开机自启-卸载.ps1')`""
