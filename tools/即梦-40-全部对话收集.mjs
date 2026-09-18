import { fileURLToPath } from 'node:url';
// 遍历所有"对话"，逐个滚动收集 (提示词, 视频) 对，合并去重
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

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
const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/, '') + '\\';
const SCSEL = `[...document.querySelectorAll('div')].filter((e)=>e.scrollHeight>e.clientHeight+200).sort((a,b)=>b.scrollHeight-a.scrollHeight)[0]`;

const scanOnce = () => post({
  action: 'eval',
  js: `(() => {
    const sc = ${SCSEL};
    if (!sc) return { error: 'no-scroller' };
    const base = sc.getBoundingClientRect().top - sc.scrollTop;
    const prompts = [...document.querySelectorAll('div,p,span')].filter((e) => {
      const t = e.textContent || '';
      return t.includes('动作：') && t.includes('镜头完全固定') && t.length < 800 && e.children.length <= 2 && e.getBoundingClientRect().width > 0;
    }).map((e) => ({ y: e.getBoundingClientRect().top - base, m: (e.textContent.match(/动作：([\\s\\S]{5,160})/) || [])[1] || null })).filter((p) => p.m);
    const vids = [...document.querySelectorAll('video')].filter((v) => (v.src || '').includes('vlabvod.com')).map((v) => { const r = v.getBoundingClientRect(); return { src: v.src, y: r.top - base, w: Math.round(r.width) }; }).filter((v) => v.w > 180);
    const out = [];
    for (const v of vids) {
      let best = null;
      for (const p of prompts) { const d = v.y - p.y; if (d < -800 || d > 4000) continue; if (!best || Math.abs(d) < Math.abs(best.d)) best = { d, m: p.m }; }
      out.push({ src: v.src, y: Math.round(v.y), desc: best ? best.m : null });
    }
    return { out, scrollTop: Math.round(sc.scrollTop), max: sc.scrollHeight - sc.clientHeight };
  })()`,
});

const collected = new Map();
const convs = [...new Set((await post({
  action: 'eval',
  js: `[...document.querySelectorAll('[class*=workspace-name]')].map((e) => e.textContent.trim())`,
})) ?? [])];
console.log(`对话数 ${convs.length}:`, JSON.stringify(convs));

for (const [ci, conv] of convs.entries()) {
  await post({
    action: 'eval',
    js: `(() => { const el = [...document.querySelectorAll('[class*=workspace-name]')].find((e) => e.textContent.trim() === ${JSON.stringify('__C__')}); if (el) (el.closest('a,li,[class*=item]') || el).click(); return !!el; })()`.replace('__C__', conv),
  });
  await sleep(7000);
  await post({ action: 'eval', js: `(() => { const sc = ${SCSEL}; if (sc) sc.scrollTop = 0; return 0; })()` });
  await sleep(2000);

  const before = collected.size;
  let last = -1;
  for (let i = 1; i <= 30; i++) {
    const r = await scanOnce();
    if (r.error) break;
    for (const p of r.out) if (!collected.has(p.src)) collected.set(p.src, { ...p, conv });
    if (r.scrollTop >= r.max - 5) break;
    if (r.scrollTop === last) break;
    last = r.scrollTop;
    await post({ action: 'eval', js: `(() => { const sc = ${SCSEL}; if (sc) sc.scrollTop += 400; return sc.scrollTop; })()` });
    await sleep(2200);
  }
  console.log(`[${ci + 1}/${convs.length}] ${conv}：本次新增 ${collected.size - before} 条（累计 ${collected.size}）`);
}

const rows = [...collected.values()].filter((x) => x.desc);
writeFileSync(ROOT + '临时\\全部结果.json', JSON.stringify(rows, null, 2));
console.log(`\n共收集 ${rows.length} 条带提示词的结果`);
const seen = new Set();
for (const r of rows) {
  const key = r.desc.slice(0, 20);
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`  ${r.desc.slice(0, 40)}`);
}
