<#
  肆喵 · DSH 侧桥接插件一键安装（Windows）

  用法（一般直接用默认值）：
    powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1

  参数：
    -DshHome <路径>    DSH 根目录；不给就依次读 $env:DSH_HOME、D:\dsh、~/dsh
    -Profile <名字>    profile 名，默认 web
    -SkipPetConfig     只装 DSH 侧，不动桌宠的 config.json

  这个脚本做五件事：
    ① 定位 DSH_HOME 与 profile
    ② 备份 profile 的 package.json
    ③ 把 @dsh-pet/bridge 以 file: 写进依赖，并加进 dsh.profile.bundles
    ④ 在 profile 目录执行 pnpm install
    ⑤ 打开桌宠侧的 agent_link.dsh（写 UTF-8 无 BOM）

  不联网、不写注册表、不需要管理员权限。
#>
[CmdletBinding()]
param(
  [string]$DshHome,
  [string]$Profile = 'web',
  [switch]$SkipPetConfig
)

$ErrorActionPreference = 'Stop'
$BridgeDir = $PSScriptRoot

function Say($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }
function Step($n, $m) { Write-Host ''; Write-Host "【$n】$m" -ForegroundColor Cyan }
function Ok($m) { Write-Host "  ✓ $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  ! $m" -ForegroundColor Yellow }

# ── ① 定位 DSH_HOME ────────────────────────────────────────────────────
Step 1 '定位 DSH'
if (-not $DshHome) {
  if ($env:DSH_HOME -and (Test-Path $env:DSH_HOME)) { $DshHome = $env:DSH_HOME }
  else {
    foreach ($c in @('D:\dsh', (Join-Path $HOME 'dsh'), (Join-Path $HOME 'deepseek-harness'))) {
      if (Test-Path (Join-Path $c 'profiles')) { $DshHome = $c; break }
    }
  }
}
if (-not $DshHome -or -not (Test-Path $DshHome)) {
  Warn "没找到 DSH 根目录。请用 -DshHome <路径> 指定（里面应有 profiles 目录）"
  exit 1
}
$DshHome = (Resolve-Path $DshHome).Path
Ok "DSH_HOME = $DshHome"

$ProfileDir = Join-Path $DshHome "profiles\$Profile"
$PkgPath = Join-Path $ProfileDir 'package.json'
if (-not (Test-Path $PkgPath)) {
  Warn "profile「$Profile」不存在：$ProfileDir"
  Warn "看看 $DshHome\profiles 下有哪些 profile，再用 -Profile 指定"
  exit 1
}
Ok "profile = $Profile  ($ProfileDir)"

# ── ② 备份 ─────────────────────────────────────────────────────────────
Step 2 '备份 profile 配置'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bak = "$PkgPath.before-dsh-bridge-$stamp"
Copy-Item $PkgPath $bak -Force
Ok "已备份：$(Split-Path $bak -Leaf)"

# ── ③ 写入依赖与 bundle ────────────────────────────────────────────────
Step 3 '登记插件（依赖 + bundles）'
$env:BRIDGE_PKG = $PkgPath
$env:BRIDGE_DIR = $BridgeDir
node -e "
const fs = require('fs');
const pkgPath = process.env.BRIDGE_PKG;
const dir = process.env.BRIDGE_DIR.replace(/\\\\/g, '/');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/, ''));
pkg.dependencies = pkg.dependencies || {};
const before = pkg.dependencies['@dsh-pet/bridge'] || '(无)';
pkg.dependencies['@dsh-pet/bridge'] = 'file:' + dir;
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
pkg.dsh.profile.bundles = pkg.dsh.profile.bundles || [];
let added = false;
if (!pkg.dsh.profile.bundles.includes('@dsh-pet/bridge')) { pkg.dsh.profile.bundles.push('@dsh-pet/bridge'); added = true; }
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', { encoding: 'utf8' });  // 无 BOM
const check = fs.readFileSync(pkgPath);
console.log('  依赖: ' + before + ' → ' + JSON.parse(check.toString('utf8')).dependencies['@dsh-pet/bridge']);
console.log('  bundles: ' + (added ? '已追加 @dsh-pet/bridge' : '已有 @dsh-pet/bridge'));
console.log('  编码: ' + (check[0] === 0xEF ? '⚠ 带 BOM（异常）' : '✓ 无 BOM'));
"
if ($LASTEXITCODE -ne 0) { Warn '写配置失败'; exit 1 }

# ── ④ pnpm install ─────────────────────────────────────────────────────
Step 4 '安装依赖（pnpm install）'
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
  Warn '找不到 pnpm。DSH 本身依赖 pnpm，请先装好 pnpm 再重跑本脚本'
  Warn "或者手动在 $ProfileDir 里执行：pnpm install"
  exit 1
}
Push-Location $ProfileDir
try {
  & pnpm install
  if ($LASTEXITCODE -ne 0) { Warn 'pnpm install 失败，请把上面的报错发给作者'; Pop-Location; exit 1 }
} finally { Pop-Location }

$installed = Join-Path $ProfileDir 'node_modules\@dsh-pet\bridge\index.js'
if (Test-Path $installed) { Ok "已装到 node_modules：$((Get-Item $installed).Length) 字节" }
else { Warn 'node_modules 里没看到 @dsh-pet\bridge —— 检查 pnpm 输出'; exit 1 }

# ── ⑤ 桌宠侧开关 ───────────────────────────────────────────────────────
if (-not $SkipPetConfig) {
  Step 5 '打开桌宠侧的 DSH 联动开关'
  $petDirs = @(
    (Join-Path $env:APPDATA 'dsh-pet-standalone-webm'),
    (Join-Path $env:APPDATA 'dsh-pet-standalone')
  ) | Where-Object { Test-Path (Join-Path $_ 'config.json') }

  if ($petDirs) {
    $petCfg = Join-Path $petDirs[0] 'config.json'
    Copy-Item $petCfg "$petCfg.before-dsh-bridge" -Force
    $env:PET_CFG = $petCfg
    node -e "
const fs = require('fs');
const p = process.env.PET_CFG;
const c = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
c.agent_link = c.agent_link || {};
const before = c.agent_link.dsh;
c.agent_link.dsh = true;
if (c.agent_link.notify_state === undefined) c.agent_link.notify_state = true;
fs.writeFileSync(p, JSON.stringify(c, null, 2), { encoding: 'utf8' });  // 无 BOM
const b = fs.readFileSync(p).subarray(0, 3);
console.log('  agent_link.dsh: ' + before + ' → ' + JSON.parse(fs.readFileSync(p, 'utf8')).agent_link.dsh);
console.log('  编码: ' + (b[0] === 0xEF ? '⚠ 带 BOM（异常）' : '✓ 无 BOM'));
"
    Ok "已改：$petCfg（备份 .before-dsh-bridge）"
  } else {
    Warn '没找到桌宠的用户目录（说明还没装独立桌宠）。装好桌宠后，把它的 config.json 里'
    Warn 'agent_link.dsh 改成 true 即可；或者重跑本脚本。'
  }
}

# ── 收尾 ───────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '装好了。还差最后一步：' -ForegroundColor Yellow
Write-Host '  重启 DSH（bundles 变更不是热加载项）——例如重新执行你的 dsh web 启动方式。' -ForegroundColor Yellow
Write-Host ''
Write-Host '重启后验证：' -ForegroundColor Cyan
Write-Host "  node `"$(Join-Path $BridgeDir 'check.mjs')`""
Write-Host ''
Write-Host '然后跟肆喵说句话，她应该切到工作状态并冒气泡。' -ForegroundColor Cyan
