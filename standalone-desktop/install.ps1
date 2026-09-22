<#
  肆喵 · 傻瓜版一键安装（Windows）

  双击同目录的「一键安装-肆喵.cmd」即可，无需任何命令行知识。

  这个脚本会自动完成：
    ① 检查有没有装 dsh-pet-indesktop（独立桌宠程序）——没装就自动从 GitHub 下载并静默安装
    ② 确保程序运行过一次，生成它的配置文件
    ③ 把肆喵的角色素材装进去，并把当前角色切换为「肆喵」
    ④ 顺手打开开机自启（可在程序的右键菜单里随时关掉）
    ⑤ 启动桌宠

  可选项（一般用不到）：
    -SkipAppInstall   不检查/不安装独立程序，只装角色
    -SkipAutostart    不开机自启
    -NoLaunch         装完不启动
    -TestDownload     只测试下载通道（下载安装包到临时目录后退出）
#>
[CmdletBinding()]
param(
  [switch]$SkipAppInstall,
  [switch]$SkipAutostart,
  [switch]$SkipTalk,
  [switch]$NoLaunch,
  [switch]$TestDownload
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'Continue'

# ── 常量 ────────────────────────────────────────────────────────────────
$APP_REPO = 'MerZlin/dsh-pet-indesktop'      # 独立桌宠程序（载体）
$APP_ASSET_PATTERN = 'webm-setup\.exe$'      # 选 WebM 变体的安装包
$CHAR_NAME = 'simiao'
$CHAR_DIR_NAME = 'simiao'
$SRC_CHAR = Join-Path $PSScriptRoot 'characters\simiao'

function Say($msg, $color = 'Gray') { Write-Host $msg -ForegroundColor $color }
function Step($n, $msg) { Write-Host ''; Write-Host "【$n】$msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

# ── 工具：下载（多通道兜底）─────────────────────────────────────────────
function Get-Url($url, $outFile) {
  try {
    Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing -Headers @{ 'User-Agent' = 'simiao-installer' }
    return $true
  } catch {
    Warn "Invoke-WebRequest 失败（$($_.Exception.Message)），改用 curl.exe 重试"
  }
  try {
    & curl.exe -L --ssl-no-revoke -o $outFile $url 2>$null
    return (Test-Path $outFile) -and ((Get-Item $outFile).Length -gt 0)
  } catch { return $false }
}

function Get-LatestAppInstaller($dir) {
  Say '  正在向 GitHub 查询最新版独立桌宠程序…'
  $api = "https://api.github.com/repos/$APP_REPO/releases/latest"
  $rel = $null
  try {
    $rel = Invoke-RestMethod -Uri $api -UseBasicParsing -Headers @{ 'User-Agent' = 'simiao-installer' }
  } catch {
    Warn "查询 Release 失败：$($_.Exception.Message)"
  }
  if (-not $rel) { return $null }
  $asset = $rel.assets | Where-Object { $_.name -match $APP_ASSET_PATTERN } | Select-Object -First 1
  if (-not $asset) { return $null }
  Say ("  最新版：{0} → {1}（{2:N1} MB）" -f $rel.tag_name, $asset.name, ($asset.size / 1MB))
  $dest = Join-Path $dir $asset.name
  Say '  下载中，请耐心等待（约 140MB，视网速 1~5 分钟）…'
  if (-not (Get-Url $asset.browser_download_url $dest)) { return $null }
  Ok ("已下载：{0}（{1:N1} MB）" -f (Split-Path $dest -Leaf), ((Get-Item $dest).Length / 1MB))
  return $dest
}

# ── 工具：找已安装的独立程序 ────────────────────────────────────────────
function Find-InstalledApp {
  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs'),
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)}
  ) | Where-Object { $_ -and (Test-Path $_) }
  foreach ($root in $roots) {
    $hit = Get-ChildItem $root -Directory -Filter 'dsh-pet-standalone*' -ErrorAction SilentlyContinue | ForEach-Object {
      $exe = Get-ChildItem $_.FullName -Filter '*.exe' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike 'unins*' -and $_.Name -like 'dsh-pet-standalone*' } | Select-Object -First 1
      if ($exe) { [pscustomobject]@{ Exe = $exe.FullName; Dir = $_.FullName; AppDirName = $_.Name } }
    }
    if ($hit) { return $hit | Select-Object -First 1 }
  }
  return $null
}

# ── 工具：无 BOM 写 JSON（带 BOM 会让该程序解析失败并静默退回内置角色）──
function Set-CharacterInConfig($cfgPath) {
  $text = [System.IO.File]::ReadAllText($cfgPath)
  $text = $text.TrimStart([char]0xFEFF)
  $cfg = $text | ConvertFrom-Json
  $old = $cfg.character
  $cfg.character = $CHAR_NAME
  $json = $cfg | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($cfgPath, $json, [System.Text.UTF8Encoding]::new($false))
  Ok "角色已切换：$old → $CHAR_NAME"
}

function Enable-Autostart($exe, $exeDir, $appDirName) {
  $cmd = "cmd /c start `"`" /D `"$exeDir`" `"$exe`" --slot 0"
  Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name $appDirName -Value $cmd
  $read = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name $appDirName).$appDirName
  if ($read -eq $cmd) { Ok '已开启开机自启（可在桌宠右键菜单里关闭）' } else { Warn '开机自启写入后校验不一致' }
}

# 让肆喵"会说话"：写自定义台词 + 过程汇报概率门 + 自言自语，并把气泡配图放到用户目录。
# 全程无 BOM 写入；对方的其他设置原样保留（只覆盖这几个键）。
function Enable-SimiaoTalk($userDataDir, $talkDir) {
  if (-not (Test-Path $talkDir)) { Warn "跳过说话配置（找不到 $talkDir）"; return }

  $facesDst = Join-Path $userDataDir 'simiao-faces'
  New-Item -ItemType Directory -Force -Path $facesDst | Out-Null
  Copy-Item (Join-Path $talkDir 'faces\*.png') $facesDst -Force

  $cfgPath = Join-Path $userDataDir 'config.json'
  $text = ([System.IO.File]::ReadAllText($cfgPath)).TrimStart([char]0xFEFF)
  $cfg = $text | ConvertFrom-Json

  $phrPath = Join-Path $talkDir 'simiao-phrases.json'
  if (Test-Path $phrPath) {
    $phrText = ([System.IO.File]::ReadAllText($phrPath)).TrimStart([char]0xFEFF)
    $cfg.dialogue_mode = 'custom'
    $cfg.dialogue_phrases = $phrText | ConvertFrom-Json
  }

  if (-not $cfg.agent_link) { $cfg | Add-Member -NotePropertyName agent_link -NotePropertyValue ([pscustomobject]@{}) -Force }
  $cfg.agent_link | Add-Member -NotePropertyName report_gates -NotePropertyValue ([pscustomobject]@{
    state = 1.0; activity = 1.0; approval = 1.0; done = 1.0
    exec_failed = 1.0; model_access = 1.0; stuck = 1.0; bridge = 1.0
  }) -Force
  $cfg.agent_link | Add-Member -NotePropertyName notify_activity -NotePropertyValue $true -Force

  $cfg | Add-Member -NotePropertyName self_talk_enabled -NotePropertyValue $true -Force
  $cfg | Add-Member -NotePropertyName self_talk_min_interval -NotePropertyValue 8.0 -Force
  $cfg | Add-Member -NotePropertyName self_talk_max_interval -NotePropertyValue 18.0 -Force
  $cfg | Add-Member -NotePropertyName self_talk_duration_seconds -NotePropertyValue 4.0 -Force
  $cfg | Add-Member -NotePropertyName self_talk_image_dir -NotePropertyValue $facesDst -Force
  $cfg | Add-Member -NotePropertyName self_talk_texts -NotePropertyValue @(
    '主人～肆喵在这儿守着，放心忙吧喵。',
    '要不要喝口水呀？肆喵帮您看着屏幕。',
    '唔…眼镜又滑下来了，推一下。',
    '这个任务看起来好难，主人加油喵！',
    '肆喵的尾巴有点痒……不管了，先盯着进度。',
    '主人，累了就歇一会儿嘛。',
    '刚才那个文件改好了吗？肆喵有点好奇。',
    '偷偷告诉主人：肆喵觉得您挺厉害的。'
  ) -Force

  $json = $cfg | ConvertTo-Json -Depth 30
  [System.IO.File]::WriteAllText($cfgPath, $json, [System.Text.UTF8Encoding]::new($false))
  Ok '已开启「会说话」：自定义台词 + 干活汇报 + 自言自语（气泡图已就位）'
}

# ══════════════════════════════════════════════════════════════════════
Say ''
Say '  ╭──────────────────────────────────────────╮' 'Magenta'
Say '  │   肆喵 · 独立桌面版  一键安装（Windows）  │' 'Magenta'
Say '  ╰──────────────────────────────────────────╯' 'Magenta'

if (-not (Test-Path $SRC_CHAR)) {
  Say ''
  Say "  ✗ 找不到角色素材目录：$SRC_CHAR" 'Red'
  Say '    请确认本脚本与 characters 文件夹在同一个目录（不要只把脚本单独拷出来）。' 'Red'
  Read-Host '按回车退出'
  exit 1
}

# ── ① 独立程序 ─────────────────────────────────────────────────────────
$app = $null
if (-not $SkipAppInstall) {
  Step 1 '检查是否已安装独立桌宠程序（dsh-pet-indesktop）'
  $app = Find-InstalledApp
  if ($app) {
    Ok "已安装：$($app.Exe)"
  } else {
    Warn '没有检测到，需要先安装它（这是让宠物显示在桌面上的程序本体，开源免费）'
    $tmp = Join-Path $env:TEMP ('simiao-install-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $installer = Get-LatestAppInstaller $tmp

    if ($TestDownload) {
      Say ''
      if ($installer) { Ok '下载通道正常（仅测试，未安装）' } else { Say '  ✗ 下载失败' 'Red' }
      Read-Host '按回车退出'
      exit 0
    }

    if (-not $installer) {
      Say ''
      Say '  ✗ 自动下载失败（可能是网络/代理原因）。请手动完成这一步：' 'Red'
      Say "    1. 打开 https://github.com/$APP_REPO/releases/latest" 'Red'
      Say '    2. 下载文件名以「-webm-setup.exe」结尾的安装包，双击装好' 'Red'
      Say '    3. 重新运行本脚本即可' 'Red'
      Read-Host '按回车退出'
      exit 1
    }

    Say '  正在静默安装（不会弹窗，约 1~2 分钟）…'
    $proc = Start-Process -FilePath $installer -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-' -PassThru -Wait
    if ($proc.ExitCode -ne 0) { Warn "安装程序退出码 $($proc.ExitCode)（可能已安装过，继续尝试）" }
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    $app = Find-InstalledApp
    if (-not $app) {
      Say ''
      Say '  ✗ 安装后仍找不到程序，请手动安装后再运行本脚本。' 'Red'
      Read-Host '按回车退出'
      exit 1
    }
    Ok "安装完成：$($app.Exe)"
  }
} else {
  $app = Find-InstalledApp
  if (-not $app) { Say '  ✗ 未找到独立程序（已指定 -SkipAppInstall）' 'Red'; Read-Host '按回车退出'; exit 1 }
}

$exe = $app.Exe
$exeDir = $app.Dir
$appDirName = $app.AppDirName
$userDataDir = Join-Path $env:APPDATA $appDirName        # 该程序的用户数据目录（与安装目录同名）
$cfgPath = Join-Path $userDataDir 'config.json'

# ── ② 让程序生成配置 ───────────────────────────────────────────────────
Step 2 '准备程序配置'
$running = Get-Process -Name ($appDirName) -ErrorAction SilentlyContinue
if (-not (Test-Path $cfgPath)) {
  Say '  首次使用：先启动一次程序以生成配置…'
  if (-not $running) { Start-Process -FilePath $exe -WorkingDirectory $exeDir | Out-Null }
  for ($i = 0; $i -lt 30 -and -not (Test-Path $cfgPath); $i++) { Start-Sleep -Seconds 2 }
  if (-not (Test-Path $cfgPath)) {
    Say "  ✗ 等不到配置文件：$cfgPath" 'Red'
    Say '    请手动打开一次桌宠程序，然后重新运行本脚本。' 'Red'
    Read-Host '按回车退出'
    exit 1
  }
  Ok '配置已生成'
} else {
  Ok "配置已存在：$cfgPath"
}

# ── ③ 装角色 ───────────────────────────────────────────────────────────
Step 3 '安装肆喵角色素材'
$charDst = Join-Path $userDataDir "characters\$CHAR_DIR_NAME"
New-Item -ItemType Directory -Force -Path $charDst | Out-Null
Copy-Item (Join-Path $SRC_CHAR '*') $charDst -Recurse -Force
$n = (Get-ChildItem (Join-Path $charDst 'videos') -Recurse -Filter *.webm -ErrorAction SilentlyContinue | Measure-Object).Count
Ok "角色已就位：$charDst（$n 段动画）"

Step 4 '切换当前角色为「肆喵」'
Copy-Item $cfgPath "$cfgPath.bak" -Force -ErrorAction SilentlyContinue
Set-CharacterInConfig $cfgPath

# ── ④ 让她会说话 ───────────────────────────────────────────────────────
if (-not $SkipTalk) {
  Step 5 '配置「会说话」（台词 / 干活汇报 / 自言自语）'
  Enable-SimiaoTalk $userDataDir (Join-Path $PSScriptRoot 'talk')
}

# ── ⑤ 开机自启 ─────────────────────────────────────────────────────────
if (-not $SkipAutostart) {
  Step 6 '设置开机自启'
  Enable-Autostart $exe $exeDir $appDirName
}

# ── ⑥ 启动 ─────────────────────────────────────────────────────────────
Step 7 '启动桌宠'
Get-Process -Name $appDirName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 4
if (-not $NoLaunch) {
  Start-Process -FilePath $exe -WorkingDirectory $exeDir | Out-Null
  Start-Sleep -Seconds 8
  if (Get-Process -Name $appDirName -ErrorAction SilentlyContinue) { Ok '桌宠已启动，看你的桌面右下角 🐾' }
  else { Warn '启动命令已发出，但暂时看不到进程；稍等一下或手动打开桌宠' }
} else {
  Say '  已跳过启动（-NoLaunch）'
}

Say ''
Say '  ╭────────────────────────────────────────╮' 'Green'
Say '  │   ✅  安装完成，肆喵已经在桌面上了！    │' 'Green'
Say '  ╰────────────────────────────────────────╯' 'Green'
Say ''
Say '  常用操作：' 'DarkGray'
Say '    · 左键拖动 = 挪位置；点她 = 看反应；拖着甩出去 = 会被扔飞' 'DarkGray'
Say '    · 右键 = 菜单（换角色 / 播放速度 / 关掉开机自启 / 退出）' 'DarkGray'
Say '    · 卸载角色：删掉 characters\simiao 文件夹即可' 'DarkGray'
Say ''
Read-Host '按回车关闭本窗口'
