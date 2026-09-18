// 肆喵喵 · 浏览器控制台：用本机已装的 Chrome 起一个"专用配置"的可见窗口，
// 并开一个本地控制口，让我能一步步驱动它（登录只需一次，配置目录持久保存）。
//
// 启动：node 工具/浏览器.mjs
// 控制：POST http://127.0.0.1:7799/cmd  {"action":"...","...":...}
//   status | goto {url} | eval {js} | screenshot {path,fullPage} | click {selector}
//   type {selector,text} | upload {selector,files} | wait {ms} | pages | stop
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';

const CHROME = process.env.DSH_PET_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = fileURLToPath(new URL('../临时/chrome-profile', import.meta.url));
const PORT = 7799;
mkdirSync(PROFILE, { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: false,
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
  args: ['--disable-blink-features=AutomationControlled'],
});
const page0 = context.pages()[0] ?? (await context.newPage());
console.log('[浏览器] 已启动，配置目录：' + PROFILE);

const server = createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/cmd') {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('POST /cmd only');
    return;
  }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    let cmd;
    try {
      cmd = JSON.parse(raw || '{}');
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'bad json' }));
      return;
    }
    try {
      const result = await run(cmd);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, result }));
    } catch (error) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) }));
    }
  });
});

function currentPage() {
  const pages = context.pages();
  return pages.length ? pages[pages.length - 1] : page0;
}

async function run(cmd) {
  const page = currentPage();
  switch (cmd.action) {
    case 'status':
      return {
        pages: context.pages().map((p) => ({ url: p.url(), title: safeTitle(p) })),
        current: { url: page.url(), title: safeTitle(page) },
      };
    case 'pages':
      return context.pages().map((p, i) => ({ i, url: p.url(), title: safeTitle(p) }));
    case 'goto': {
      await page.goto(cmd.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(cmd.settleMs ?? 2500);
      return { url: page.url(), title: await page.title() };
    }
    case 'eval': {
      const value = await page.evaluate(cmd.js);
      return value;
    }
    case 'screenshot': {
      await page.screenshot({ path: cmd.path, fullPage: cmd.fullPage === true });
      return { path: cmd.path };
    }
    case 'click': {
      await page.click(cmd.selector, { timeout: cmd.timeoutMs ?? 15000 });
      return { clicked: cmd.selector };
    }
    case 'type': {
      await page.fill(cmd.selector, cmd.text, { timeout: cmd.timeoutMs ?? 15000 });
      return { typed: cmd.text.length };
    }
    case 'upload': {
      await page.setInputFiles(cmd.selector, cmd.files, { timeout: cmd.timeoutMs ?? 30000 });
      return { uploaded: cmd.files };
    }
    case 'uploadViaChooser': {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: cmd.timeoutMs ?? 20000 }),
        page.click(cmd.clickSelector, { timeout: cmd.timeoutMs ?? 20000 }),
      ]);
      await chooser.setFiles(cmd.files);
      await page.waitForTimeout(cmd.settleMs ?? 3000);
      return { uploaded: cmd.files };
    }
    case 'press': {
      await page.keyboard.press(cmd.key);
      return { pressed: cmd.key };
    }
    case 'saveUrl': {
      // 用浏览器上下文下载（带 cookie；可指定 Referer 绕过 CDN 防盗链）
      const resp = await context.request.get(cmd.url, {
        headers: cmd.headers ?? { referer: 'https://jimeng.jianying.com/' },
        timeout: cmd.timeoutMs ?? 180000,
      });
      if (!resp.ok()) throw new Error('HTTP ' + resp.status());
      const body = await resp.body();
      writeFileSync(cmd.path, body);
      return { bytes: body.length, path: cmd.path };
    }
    case 'clickDownload': {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: cmd.timeoutMs ?? 60000 }),
        page.click(cmd.selector),
      ]);
      await download.saveAs(cmd.path);
      return { path: cmd.path, suggested: download.suggestedFilename() };
    }
    case 'dropFile': {
      // 有些上传入口只响应真实拖放：在页面内用 DataTransfer 伪造 drop 事件
      const b64 = readFileSync(cmd.path).toString('base64');
      const name = basename(cmd.path);
      const mime = name.toLowerCase().endsWith('.png') ? 'image/png' : 'application/octet-stream';
      const outcome = await page.evaluate(
        async ({ selector, b64, name, mime }) => {
          const el = selector ? document.querySelector(selector) : document.body;
          if (!el) return 'no-element';
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          const file = new File([arr], name, { type: mime });
          const dt = new DataTransfer();
          dt.items.add(file);
          for (const type of ['dragenter', 'dragover', 'drop']) {
            el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
          }
          return 'dropped:' + el.className.toString().slice(0, 40) + ':' + bin.length;
        },
        { selector: cmd.selector ?? '', b64, name, mime },
      );
      await page.waitForTimeout(cmd.settleMs ?? 5000);
      return { outcome };
    }
    case 'typeInto': {
      // 富文本输入框（contenteditable）用键盘输入，React 受控组件也能收到事件
      await page.click(cmd.selector, { timeout: cmd.timeoutMs ?? 15000 });
      await page.keyboard.type(cmd.text, { delay: cmd.delayMs ?? 8 });
      return { typed: cmd.text.length };
    }
    case 'findByText': {
      const found = await page.evaluate((wanted) => {
        const leaves = [...document.querySelectorAll('button, a, div, span, [role=button]')].filter(
          (e) => e.children.length === 0 && e.textContent.trim() === wanted,
        );
        return leaves.map((e) => {
          const r = e.getBoundingClientRect();
          return { tag: e.tagName, cls: (e.className || '').toString().slice(0, 80), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 };
        });
      }, cmd.text);
      return found;
    }
    case 'clickText': {
      const clicked = await page.evaluate((wanted) => {
        const leaves = [...document.querySelectorAll('button, a, div, span, [role=button]')].filter(
          (e) => e.children.length === 0 && e.textContent.trim() === wanted,
        );
        const target = leaves.find((e) => e.getBoundingClientRect().width > 0);
        if (!target) return false;
        target.click();
        return true;
      }, cmd.text);
      await page.waitForTimeout(cmd.settleMs ?? 1200);
      return { clicked: clicked ? cmd.text : null };
    }
    case 'wait': {
      await page.waitForTimeout(cmd.ms ?? 1000);
      return { waited: cmd.ms ?? 1000 };
    }
    case 'newPage': {
      const p = await context.newPage();
      if (cmd.url) await p.goto(cmd.url, { waitUntil: 'domcontentloaded' });
      return { url: p.url() };
    }
    case 'stop': {
      setTimeout(() => process.exit(0), 200);
      return { stopping: true };
    }
    default:
      throw new Error('未知 action: ' + String(cmd.action));
  }
}

function safeTitle(page) {
  try {
    return page.url();
  } catch {
    return '';
  }
}

server.listen(PORT, '127.0.0.1', () => console.log(`[浏览器] 控制口 http://127.0.0.1:${PORT}/cmd`));
context.on('close', () => process.exit(0));
