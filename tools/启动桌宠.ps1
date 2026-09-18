# 肆喵喵 · 桌宠启动器（供开机自启调用；也可手动运行）
#
# 桌宠是 DSH 的插件：桌面那几只 Electron 小窗由 DSH 进程拉起，所以"桌宠开机自启" = "开机把 DSH 跑起来"。
# 本脚本：① 已在运行（3080 在监听）就直接退出，绝不重复启动；② 否则以隐藏窗口把 `dsh web --no-open` 跑起来。
# --no-open 表示不弹浏览器：只让桌宠住到桌面上，不需要打开网页界面。

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot            # 肆喵喵/
$dshRoot = 'D:\dsh'
$logDir = Join-Path $root '日志'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir '开机自启.log'

function Write-Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
  Write-Output $line
}

Write-Log '--- 启动器被调用 ---'

# ① 已在运行就不重复启动（DSH 的 web 端口默认 3080）
$listening = Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue
if ($listening) {
  Write-Log '检测到 3080 已在监听：DSH 已在运行，桌宠应当已就位，直接退出。'
  exit 0
}

# ② 找 node：优先 PATH，其次已知的运行时路径
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $candidates = @(
    'C:\Users\30502\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe',
    "$env:ProgramFiles\nodejs\node.exe"
  )
  $node = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $node) { Write-Log '找不到 node.exe，放弃启动。'; exit 1 }
Write-Log "使用 node：$node"

$entry = Join-Path $dshRoot 'apps\cli\src\bin.ts'
if (-not (Test-Path $entry)) { Write-Log "找不到 DSH 入口 $entry，放弃启动。"; exit 1 }

# ③ 隐藏窗口启动（工作目录必须是 D:\dsh：tsx 要靠它解析 tsconfig 路径）
$outLog = Join-Path $logDir 'dsh-web.out.log'
$errLog = Join-Path $logDir 'dsh-web.err.log'
Write-Log "启动：node --import tsx/esm $entry web --no-open（cwd=$dshRoot）"
Start-Process -FilePath $node `
  -ArgumentList '--import', 'tsx/esm', $entry, 'web', '--no-open' `
  -WorkingDirectory $dshRoot -WindowStyle Hidden `
  -RedirectStandardOutput $outLog -RedirectStandardError $errLog

# ④ 等一会儿确认端口起来了（只记录，不阻塞）
for ($i = 1; $i -le 30; $i++) {
  Start-Sleep -Seconds 3
  if (Get-NetTCPConnection -State Listen -LocalPort 3080 -ErrorAction SilentlyContinue) {
    Write-Log "DSH 已就绪（等待约 $($i * 3) 秒），桌宠窗口随后由 Helper 拉起。"
    exit 0
  }
}
Write-Log '等待 90 秒仍未监听 3080：请看 dsh-web.err.log 排查。'
exit 1
