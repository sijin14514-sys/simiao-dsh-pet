// 本地控制口的命令行入口（PowerShell 传中文会乱码，统一用 node 发指令）
// 用法：node 工具/浏览器命令.mjs '<json>'
const [, , raw] = process.argv;
const res = await fetch('http://127.0.0.1:7799/cmd', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: raw ?? '{"action":"status"}',
});
const json = await res.json();
console.log(JSON.stringify(json, null, 2));
