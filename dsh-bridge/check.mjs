// 肆喵 DSH 联动自检：桌宠侧开关 → 桥接事件文件 → 桌宠是否真的在跟随
// 用法：node check.mjs  [--dsh-home <路径>]
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const dshHomeArg = args.includes('--dsh-home') ? args[args.indexOf('--dsh-home') + 1] : null;

/** 桌宠（dsh-pet-indesktop）的用户数据目录，按平台惯例猜 */
function petDirs() {
  const names = ['dsh-pet-standalone-webm', 'dsh-pet-standalone'];
  const bases = [];
  if (process.platform === 'win32') bases.push(process.env.APPDATA ?? '');
  else if (process.platform === 'darwin') bases.push(path.join(homedir(), 'Library', 'Application Support'));
  else bases.push(process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'));
  return bases.flatMap((b) => names.map((n) => path.join(b, n))).filter((d) => existsSync(d));
}

/** 桥接事件目录，与插件内的判定保持一致 */
function bridgeDir() {
  if (process.platform === 'win32' && process.env.APPDATA) return path.join(process.env.APPDATA, 'dsh-pet-bridge');
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'), 'dsh-pet-bridge');
}

let ok = 0;
let bad = 0;

// ── 1) 桌宠侧开关 ──────────────────────────────────────────────────────
console.log('=== 1) 桌宠侧开关 ===');
const pets = petDirs();
if (!pets.length) {
  console.log('  ✗ 没找到桌宠用户目录 —— 先装独立桌宠（见 standalone-desktop/）');
  bad++;
} else {
  for (const dir of pets) {
    const cfgPath = path.join(dir, 'config.json');
    if (!existsSync(cfgPath)) continue;
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));
      const link = cfg.agent_link ?? {};
      console.log(`  ${dir}`);
      console.log(`    agent_link.dsh = ${link.dsh}    notify_state = ${link.notify_state}    dialogue_mode = ${cfg.dialogue_mode ?? '-'}`);
      if (link.dsh === true) { console.log('    ✓ 已开启'); ok++; }
      else { console.log('    ✗ 未开启（DSH 侧装了插件也联动不起来）'); bad++; }
    } catch (error) {
      console.log(`  ✗ 读不了 ${cfgPath}：${error.message}`);
      bad++;
    }
  }
}

// ── 2) 桥接事件文件 ────────────────────────────────────────────────────
console.log('\n=== 2) 桥接事件文件 ===');
const bDir = bridgeDir();
if (!existsSync(bDir)) {
  console.log(`  ✗ 还没有 ${bDir}`);
  console.log('    DSH 启动时没加载桥接插件：确认 profile 的 package.json 里');
  console.log('    dependencies 有 @dsh-pet/bridge、dsh.profile.bundles 里有它，然后重启 DSH');
  bad++;
} else {
  const files = readdirSync(bDir)
    .filter((f) => f.startsWith('dsh-') && f.endsWith('.jsonl'))
    .map((f) => ({ f, st: statSync(path.join(bDir, f)) }))
    .sort((a, b) => b.st.mtime - a.st.mtime);
  if (!files.length) {
    console.log('  目录在，但还没有事件文件（DSH 刚启动？）');
  } else {
    const newest = files[0];
    const lines = readFileSync(path.join(bDir, newest.f), 'utf8').trim().split('\n').filter(Boolean);
    console.log(`  目录：${bDir}`);
    console.log(`  共 ${files.length} 个实例文件，最新是 ${newest.f}`);
    console.log(`  ${(newest.st.size / 1024).toFixed(1)} KB / ${lines.length} 条事件 / 最后写入 ${newest.st.mtime.toLocaleTimeString()}`);
    for (const line of lines.slice(-4)) {
      try {
        const o = JSON.parse(line);
        console.log(`    [${o.event ?? o.kind ?? '?'}] state=${o.state ?? '-'}${o.tool ? ' tool=' + o.tool : ''}`);
      } catch { console.log('    ' + line.slice(0, 100)); }
    }
    const ageMin = (Date.now() - newest.st.mtime.getTime()) / 60000;
    if (ageMin > 30) { console.log(`  ! 最新事件是 ${ageMin.toFixed(0)} 分钟前的：DSH 可能没在跑`); }
    else { ok++; }
    if (files.length > 5) console.log(`  · 旧实例文件可以直接删（保留最新的即可）`);
  }
}

// ── 3) 桌宠是否在跟随 ──────────────────────────────────────────────────
console.log('\n=== 3) 桌宠是否在跟随 DSH 状态 ===');
if (!pets.length) {
  console.log('  （跳过：没找到桌宠）');
} else {
  const dir = pets[0];
  const logs = readdirSync(dir)
    .filter((f) => f.startsWith('pet-') && f.endsWith('.log'))
    .map((f) => ({ f, t: statSync(path.join(dir, f)).mtime }))
    .sort((a, b) => b.t - a.t);
  if (!logs.length) console.log('  没有桌宠日志（她还没启动过？）');
  else {
    const lines = readFileSync(path.join(dir, logs[0].f), 'utf8').split('\n').filter((l) => l.includes('[DSH STATE]'));
    const states = new Set();
    for (const line of lines) {
      const m = line.match(/\[DSH STATE\]\s*([^\r\n]+)/);
      if (!m) continue;
      for (const s of m[1].split('->').map((x) => x.trim().split(/\s+/)[0])) if (s) states.add(s);
    }
    console.log(`  ${logs[0].f}：${lines.length} 条状态记录`);
    for (const line of lines.slice(-4)) console.log('    ' + line.trim().slice(0, 110));
    const list = [...states];
    console.log(`  出现过的状态：${list.join(' / ') || '(无)'}`);
    if (list.some((s) => s !== 'idle')) { console.log('  ✓ 联动生效（跟随到过非 idle 状态）'); ok++; }
    else { console.log('  · 目前只有 idle —— 让 agent 干点活（发一条消息）再看'); }
  }
}

// ── 4) 顺带核对 DSH 侧登记（可选）─────────────────────────────────────
const dshHome = dshHomeArg ?? process.env.DSH_HOME ?? null;
if (dshHome && existsSync(dshHome)) {
  console.log('\n=== 4) DSH 侧登记 ===');
  const profilesDir = path.join(dshHome, 'profiles');
  if (existsSync(profilesDir)) {
    let registered = false;
    for (const name of readdirSync(profilesDir)) {
      const pkgPath = path.join(profilesDir, name, 'package.json');
      if (!existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/, ''));
        const dep = pkg.dependencies?.['@dsh-pet/bridge'];
        const bundled = (pkg.dsh?.profile?.bundles ?? []).includes('@dsh-pet/bridge');
        if (dep || bundled) {
          console.log(`  profile「${name}」：依赖 ${dep ?? '(无)'} ｜ bundles ${bundled ? '有' : '没有'}`);
          if (dep && bundled) { console.log('    ✓ 登记完整'); registered = true; }
          else { console.log('    ✗ 依赖和 bundles 必须同时有，重跑 install.ps1'); bad++; }
        }
      } catch { /* 单个 profile 读不了不影响整体判定 */ }
    }
    if (!registered) console.log('  没有 profile 登记 @dsh-pet/bridge —— 跑一下 install.ps1');
  }
}

console.log('');
console.log(ok && !bad ? '结论：联动链路是通的。' : '结论：上面标 ✗ 的地方还没通，照提示修。');
