# 肆喵喵 · 卸载"开机自启"（两种方式都清掉）
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File 工具/开机自启-卸载.ps1

$ErrorActionPreference = 'Continue'
$taskName = '肆喵桌宠(DSH web)'

schtasks /Query /TN $taskName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  schtasks /Delete /TN $taskName /F | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Output "✓ 已删除计划任务：$taskName" } else { Write-Output "✗ 删除任务失败（可手动到任务计划程序里删）" }
} else {
  Write-Output '· 没有该计划任务'
}

$vbs = Join-Path ([Environment]::GetFolderPath('Startup')) '肆喵桌宠.vbs'
if (Test-Path $vbs) {
  Remove-Item $vbs -Force
  Write-Output "✓ 已移除启动文件夹项：$vbs"
} else {
  Write-Output '· 启动文件夹里没有该项'
}

Write-Output '注意：卸载只取消"开机自动启动"，不会关闭当前正在跑的 DSH。'
