# 肆喵 · 独立桌面版一键安装脚本（Windows）
#
# 作用：把 characters/simiao/ 装进 dsh-pet-indesktop 的用户数据目录，
#       并把 config.json 的 character 改成 simiao（写入时去掉 UTF-8 BOM）。
#
# 前提：已安装 dsh-pet-indesktop（安装版或绿色版均可，运行过一次以生成配置）。
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File .\install-standalone.ps1

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$charSrc = Join-Path $src 'characters\simiao'
if (-not (Test-Path $charSrc)) { throw "找不到角色目录：$charSrc" }

# 候选用户数据目录（WebM 变体带 -webm 后缀；无 Chat 版可能是另一个）
$candidates = @(
  (Join-Path $env:APPDATA 'dsh-pet-standalone-webm'),
  (Join-Path $env:APPDATA 'dsh-pet-standalone'),
  (Join-Path $env:LOCALAPPDATA 'dsh-pet-standalone-webm'),
  (Join-Path $env:LOCALAPPDATA 'dsh-pet-standalone')
)
$target = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $target) {
  Write-Output '没找到 dsh-pet-indesktop 的用户数据目录：'
  $candidates | ForEach-Object { Write-Output "  (不存在) $_" }
  throw '请先运行一次 dsh-pet-indesktop（安装版或绿色版），生成配置后再执行本脚本。'
}
Write-Output "目标目录：$target"

# 1) 拷贝角色（覆盖同名）
$charDst = Join-Path $target 'characters\simiao'
New-Item -ItemType Directory -Force -Path $charDst | Out-Null
Copy-Item (Join-Path $charSrc '*') $charDst -Recurse -Force
$n = (Get-ChildItem (Join-Path $charDst 'videos') -Recurse -Filter *.webm | Measure-Object).Count
Write-Output "✓ 角色已就位：$charDst（$n 段动画）"

# 2) 切换当前角色（配置写无 BOM 的 UTF-8 —— 带 BOM 会让应用解析失败并退回内置角色）
$cfgPath = Join-Path $target 'config.json'
if (Test-Path $cfgPath) {
  Copy-Item $cfgPath "$cfgPath.bak" -Force
  $text = [System.IO.File]::ReadAllText($cfgPath)
  $text = $text.TrimStart([char]0xFEFF)
  try { $cfg = $text | ConvertFrom-Json } catch { throw "config.json 解析失败：$($_.Exception.Message)" }
  $cfg.character = 'simiao'
  $out = $cfg | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($cfgPath, $out, [System.Text.UTF8Encoding]::new($false))
  Write-Output "✓ 已把 character 改为 simiao（原配置备份为 config.json.bak）"
} else {
  Write-Output "! 没找到 $cfgPath —— 请启动一次应用后，在桌宠上右键 → 角色菜单 → 肆喵 手动切换"
}

Write-Output ''
Write-Output '完成。重启 dsh-pet-indesktop 即可看到肆喵（或右键角色菜单手动切换）。'
