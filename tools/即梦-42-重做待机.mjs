import { fileURLToPath } from 'node:url';
// 重做「待机呼吸」：加【发型一致】约束，生成 → 质检（挂首帧 / 查重 / 纯绿幕 / 未裁腿）→ 存成 视频源/待机呼吸-AI-v2.mp4
import { readFileSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/, '') + '\\';
const FFMPEG = (() => {
  const stack = [ROOT + '工具\\ffmpeg'];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = dir + '\\' + e.name;
      if (e.isDirectory()) stack.push(p);
      else if (e.name === 'ffmpeg.exe') return p;
    }
  }
  throw new Error('找不到 ffmpeg');
})();

const LOCK = '【角色锁定】严格保持首帧中的角色外貌完全不变：棕色蓬松短发（额前一缕卷发）、头顶一对猫耳（内侧粉色）、白色蕾丝女仆头饰、黑色方框眼镜、橙色圆眼、白色围裙女仆装与深色缎带领结。严禁改变发色、发型、眼镜、服装与配色，严禁换成其他角色。';
const HAIR = '【发型严格一致】头顶不得出现首帧中没有的呆毛、直立发丝或翘起的头发；头饰覆盖处必须是平整的头发，不得有任何竖起的发绺。';
const FRAME = '【构图强制】人物全身必须完整入画：头顶距画幅顶边约 15%~20%，脚底位于画幅高度约 85% 处，人物总高度不超过画幅高度的 60%，水平居中；严禁把人物放大到画面之外，严禁裁掉头顶、腿、脚或任何身体部位。';
const ACTION = '动作：她原地站立做自然的呼吸起伏（身体轻微上下，幅度小），双眼平视前方、每隔几秒眨眼一次，裙摆极轻微摆动。';
const TAIL = '镜头完全固定，人物大小与位置全程不变、不移动、不出画；背景保持纯绿幕色 #00FF00 完全不变，无阴影、无杂物、无文字、无水印；最后一帧回到与首帧完全一致的正面站立姿态。';
const PROMPT = `${LOCK}${HAIR}${FRAME}${ACTION} ${TAIL}`;

const post = async (body) => {
  const res = await fetch('http://127.0.0.1:7799/cmd', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!json.ok) console.log('  ⚠', body.action, '→', json.error);
  return json.result;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...a);
const hashOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);

const readState = () => post({
  action: 'eval',
  js: `(() => {
    const text = document.body.innerText.replace(/\\s+/g, ' ');
    const credits = Number((text.match(/\\+?\\s*(\\d+)\\s*基础会员/) || [])[1] ?? -1);
    const tasks = [...document.querySelectorAll('a,div,li,span,p')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.x < 260 && r.y > 150 && r.y < 900 && e.children.length === 0 && e.textContent.trim().length > 2; }).map((e) => e.textContent.trim());
    const refAttached = [...document.querySelectorAll('img')].some((i) => i.src.startsWith('blob:') && i.naturalWidth >= 600);
    const vids = [...document.querySelectorAll('video')].filter((v) => (v.src || '').includes('vlabvod.com')).map((v) => { const r = v.getBoundingClientRect(); return { src: v.src, w: Math.round(r.width) }; }).filter((v) => v.w > 200);
    const btn = [...document.querySelectorAll('button')].filter((e) => e.className.includes('lv-btn-primary') && e.className.includes('circle')).pop();
    return { credits, tasks: [...new Set(tasks)], refAttached, vids, canSubmit: btn ? !btn.disabled : false };
  })()`,
});

function inspect(mp4) {
  const tmp = ROOT + '临时\\qc7.png';
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', '2.5', '-i', mp4, '-frames:v', '1', '-pix_fmt', 'rgb24', tmp], { stdio: 'ignore' });
  const png = PNG.sync.read(readFileSync(tmp));
  const ch = png.data.length / (png.width * png.height);
  const wmW = Math.round(png.width * 0.22), wmH = Math.round(png.height * 0.14);
  let green = 0;
  for (const [x, y] of [[png.width - 20, 20], [20, png.height - 20], [png.width - 20, png.height - 20]]) {
    const o = (y * png.width + x) * ch;
    const r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
    if (g > 150 && g > r * 1.4 && g > b * 1.4) green++;
  }
  let last = -1;
  for (let y = png.height - 1; y >= 0; y--) {
    let n = 0;
    for (let x = 0; x < png.width; x++) {
      if (x < wmW && y < wmH) continue;
      const o = (y * png.width + x) * ch;
      const r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
      if (!(g > 110 && g > r * 1.25 && g > b * 1.25)) n++;
    }
    if (n > 30) { last = y; break; }
  }
  return { green, gap: png.height - 1 - last };
}

const out = ROOT + '视频源\\待机呼吸-AI-v2.mp4';
if (existsSync(out)) unlinkSync(out);

for (let attempt = 1; attempt <= 3; attempt++) {
  log(`=== 第 ${attempt} 次尝试 ===`);
  await post({ action: 'goto', url: 'https://jimeng.jianying.com/ai-tool/generate/?type=video', settleMs: 9000 });
  let st = await readState();
  log(`额度 ${st.credits}`);
  if (st.credits >= 0 && st.credits < 30) { log('额度不足'); break; }
  const before = st.tasks;

  let attached = false;
  for (let a = 1; a <= 3 && !attached; a++) {
    await post({ action: 'dropFile', selector: 'div[class*=reference-upload]', path: ROOT + '立绘\\肆喵-全身立绘.png', settleMs: 7000 });
    attached = (await readState()).refAttached;
    log(`  首帧校验 ${a}/3: ${attached ? '✓' : '✗'}`);
  }
  if (!attached) { log('  首帧挂不上，重来'); continue; }

  await post({ action: 'typeInto', selector: 'div.tiptap.ProseMirror', text: ' ', delayMs: 1 });
  await post({ action: 'press', key: 'Control+A' });
  await post({ action: 'press', key: 'Delete' });
  await post({ action: 'typeInto', selector: 'div.tiptap.ProseMirror', text: PROMPT, delayMs: 1 });
  await post({ action: 'wait', ms: 2000 });
  st = await readState();
  if (!st.canSubmit) { log('  按钮不可用，重来'); continue; }
  await post({ action: 'eval', js: `(() => { const b = [...document.querySelectorAll('button')].filter((e) => e.className.includes('lv-btn-primary') && e.className.includes('circle')); b[b.length - 1].click(); return 'ok'; })()` });
  log('  已提交');

  let newTask = null;
  for (let k = 1; k <= 70 && !newTask; k++) {
    await sleep(12000);
    const s = await readState();
    const fresh = s.tasks.filter((t) => !before.includes(t));
    if (fresh.length) newTask = fresh[fresh.length - 1];
    else if (k % 5 === 0) log(`    ${Math.round((k * 12) / 60)} 分钟：仍在生成`);
  }
  if (!newTask) { log('  未出现新任务'); continue; }
  await post({
    action: 'eval',
    js: `(() => { const el = [...document.querySelectorAll('*')].find((e) => e.textContent.trim() === ${JSON.stringify('__N__')} && e.getBoundingClientRect().x < 260 && e.getBoundingClientRect().width > 0); if (el) (el.closest('a,li,[class*=item]') || el).click(); return !!el; })()`.replace('__N__', newTask),
  });

  const tried = new Set();
  for (let k = 1; k <= 45; k++) {
    await sleep(12000);
    const s = await readState();
    for (const v of s.vids) {
      if (tried.has(v.src)) continue;
      tried.add(v.src);
      const r = await post({ action: 'saveUrl', url: v.src, path: out });
      if (!r || !r.bytes) continue;
      const qc = inspect(out);
      log(`  质检：绿幕角 ${qc.green}/3，距画幅底 ${qc.gap}px`);
      if (qc.green < 2 || qc.gap < 8) { log('  ✗ 不合格（背景/构图），换一个结果'); unlinkSync(out); continue; }
      log(`  ✓ 通过：${(r.bytes / 1048576).toFixed(2)} MB  哈希 ${hashOf(out)}`);
      await post({ action: 'screenshot', path: ROOT + '临时\\重做待机-完成.png' });
      process.exit(0);
    }
    if (k % 5 === 0) log(`    等渲染… ${Math.round((k * 12) / 60)} 分钟`);
  }
}
log('未拿到合格结果');
process.exit(1);
