import { fileURLToPath } from 'node:url';
// 批量生成：按清单逐个提交即梦图生视频，直到额度不足为止。
// 每条都校验「首帧真的挂上了」才提交（避免模型自由发挥出别的角色）。
//
// 用法：node 工具/即梦-24-批量生成.mjs [起始序号]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/, '') + '\\';
const LIST = JSON.parse(readFileSync(ROOT + '提示词\\即梦-动作清单.json', 'utf8'));

const LOCK = '【角色锁定】严格保持首帧中的角色外貌完全不变：棕色蓬松短发（额前一缕呆毛）、头顶一对猫耳（内侧粉色）、白色蕾丝女仆头饰、黑色方框眼镜、橙色圆眼、白色围裙女仆装与深色缎带领结。严禁改变发色、发型、眼镜、服装与配色，严禁换成其他角色。';
const TAIL = '镜头完全固定，人物水平位置不变、不移动、不出画；背景保持纯绿幕色 #00FF00 完全不变，无阴影、无杂物、无文字、无水印；最后一帧回到与首帧完全一致的正面站立姿态。';
const promptFor = (name) => `${LOCK}动作：${LIST.动作[name]} ${TAIL}`;

const post = async (body) => {
  const res = await fetch('http://127.0.0.1:7799/cmd', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) console.log('  ⚠', body.action, '→', json.error);
  return json.result;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...a);

const readState = () => post({
  action: 'eval',
  js: `(() => {
    const text = document.body.innerText.replace(/\\s+/g, ' ');
    const credits = Number((text.match(/\\+?\\s*(\\d+)\\s*基础会员/) || [])[1] ?? -1);
    const tasks = [...document.querySelectorAll('a,div,li,span,p')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.x < 260 && r.y > 150 && r.y < 560 && e.children.length === 0 && e.textContent.trim().length > 2; }).map((e) => e.textContent.trim());
    const refs = [...document.querySelectorAll('img')].filter((e) => e.src.startsWith('blob:') || e.src.startsWith('data:')).length;
    const vids = [...document.querySelectorAll('video')].filter((v) => (v.src || '').includes('vlabvod.com')).map((v) => { const r = v.getBoundingClientRect(); return { src: v.src, w: Math.round(r.width), inCard: !!v.closest('[class*=info-card]') }; }).filter((v) => v.w > 200 && !v.inCard);
    const btn = [...document.querySelectorAll('button')].filter((e) => e.className.includes('lv-btn-primary') && e.className.includes('circle')).pop();
    return { credits, tasks: [...new Set(tasks)], refs, vids, canSubmit: btn ? !btn.disabled : false };
  })()`,
});

const names = LIST.顺序;
const startAt = Number(process.argv[2] ?? 0);
let done = 0;

for (let i = startAt; i < names.length; i++) {
  const name = names[i];
  const outPath = ROOT + `视频源\\${name}.mp4`;
  if (existsSync(outPath)) { log(`跳过（已存在）: ${name}`); continue; }

  log(`—— 第 ${i + 1}/${names.length} 条：${name} ——`);
  await post({ action: 'goto', url: 'https://jimeng.jianying.com/ai-tool/generate/?type=video', settleMs: 9000 });
  let st = await readState();
  log(`额度 ${st.credits}，已有任务 ${st.tasks.length} 个`);
  if (st.credits >= 0 && st.credits < 30) { log('额度不足（<30），停止'); break; }
  const before = st.tasks;

  // 上传首帧：drop 后必须出现预览图，否则重试；两次都不行就跳过这条（避免生成错角色）
  let attached = false;
  for (let attempt = 1; attempt <= 2 && !attached; attempt++) {
    await post({ action: 'dropFile', selector: 'div[class*=reference-upload]', path: ROOT + '立绘\\肆喵-全身立绘.png', settleMs: 7000 });
    const s = await readState();
    attached = s.refs > 0;
    log(`  首帧尝试 ${attempt}：预览图 ${s.refs} 张 ${attached ? '✓' : '✗'}`);
  }
  if (!attached) { log('首帧挂不上，跳过这条'); continue; }

  await post({ action: 'typeInto', selector: 'div.tiptap.ProseMirror', text: ' ', delayMs: 1 });
  await post({ action: 'press', key: 'Control+A' });
  await post({ action: 'press', key: 'Delete' });
  await post({ action: 'typeInto', selector: 'div.tiptap.ProseMirror', text: promptFor(name), delayMs: 1 });
  await post({ action: 'wait', ms: 2000 });

  st = await readState();
  if (!st.canSubmit) { log('生成按钮不可用，跳过'); continue; }
  await post({ action: 'eval', js: `(() => { const b = [...document.querySelectorAll('button')].filter((e) => e.className.includes('lv-btn-primary') && e.className.includes('circle')); b[b.length - 1].click(); return 'clicked'; })()` });
  log('  已提交，等新任务出现…');

  // 等侧边栏出现新任务
  let newTask = null;
  for (let k = 1; k <= 70 && !newTask; k++) {
    await sleep(12000);
    const s = await readState();
    const fresh = s.tasks.filter((t) => !before.includes(t));
    if (fresh.length) newTask = fresh[fresh.length - 1];
    if (k % 5 === 0) log(`    ${Math.round((k * 12) / 60)} 分钟：仍在生成（${fresh.length ? '已有新任务' : '无新任务'}）`);
  }
  if (!newTask) { log('  未出现新任务，跳过'); continue; }
  log(`  新任务：${newTask}`);

  // 点开新任务，等视频出现后下载
  await post({
    action: 'eval',
    js: `(() => { const el = [...document.querySelectorAll('*')].find((e) => e.textContent.trim() === ${JSON.stringify('__N__')} && e.getBoundingClientRect().x < 260 && e.getBoundingClientRect().width > 0); if (el) (el.closest('a,li,[class*=item]') || el).click(); return !!el; })()`.replace('__N__', newTask),
  });
  let saved = null;
  for (let k = 1; k <= 45 && !saved; k++) {
    await sleep(12000);
    const s = await readState();
    if (s.vids.length) {
      const r = await post({ action: 'saveUrl', url: s.vids[s.vids.length - 1].src, path: outPath });
      if (r && r.bytes) {
        const hash = createHash('sha256').update(readFileSync(outPath)).digest('hex').slice(0, 12);
        log(`  ✓ ${name}  ${(r.bytes / 1048576).toFixed(2)} MB  哈希 ${hash}`);
        saved = true;
      }
    } else if (k % 5 === 0) log(`    等渲染… ${Math.round((k * 12) / 60)} 分钟`);
  }
  if (!saved) log(`  ✗ ${name} 未取到视频`);
  done++;
  await post({ action: 'screenshot', path: ROOT + `临时\\批量-${done}.png` });
}

log(`批量结束：本次尝试 ${done} 条`);
