// 给 dsh-pet 打「设置页支持 pet pack」补丁（可选，非必需）
//
// 背景：dsh-pet 的设置页把宠物列表写死成只读 main 条目（客户端 applyConfig 里取的是
// merged.main.pets，保存也只写 main-config.jsonc）。所以 pet/<名>-config.json 里的
// 宠物（比如肆喵）不会出现在列表里，只能改文件。
//
// 本补丁：列表聚合成所有条目 + 新增 PUT /config/entry/<名>，保存时按条目各自写回。
// 代价：改的是 node_modules 里的第三方产物，升级 dsh-pet 会覆盖，需要重跑本脚本。
//
// 注意：上游 main 已于 2026-10-27 实现同一功能（commit d15ad4d「桌宠配置支持文件宠物与种类切换」，
// 落在 src/client/settings/config/pack-writes.ts 与 src/host/routes/config/entry.ts），
// 但还没发版（npm 最新仍是 0.3.8）。0.3.9 之后请直接升级插件，不要再打这个补丁。
//
// 用法：
//   node 补丁-设置页支持petpack.mjs                     干跑（只检查锚点，不动文件）
//   node 补丁-设置页支持petpack.mjs --apply              打补丁（先备份到 DSH_HOME/plugin-registry/backups）
//   node 补丁-设置页支持petpack.mjs --apply --lib <dir>  指定 dsh-pet/lib 目录
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const libFlag = argv.indexOf('--lib');
const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh');

function resolveLib() {
  if (libFlag >= 0) {
    const dir = argv[libFlag + 1];
    if (!dir || !existsSync(join(dir, 'client.js'))) throw new Error(`--lib 下没有 client.js：${dir}`);
    return dir;
  }
  const hits = [];
  const direct = join(DSH_HOME, 'node_modules', 'dsh-pet', 'lib');
  if (existsSync(join(direct, 'client.js'))) hits.push(direct);
  const profiles = join(DSH_HOME, 'profiles');
  if (existsSync(profiles)) {
    for (const p of readdirSync(profiles)) {
      const cand = join(profiles, p, 'node_modules', 'dsh-pet', 'lib');
      if (existsSync(join(cand, 'client.js'))) hits.push(cand);
    }
  }
  if (!hits.length) throw new Error(`在 ${DSH_HOME} 下找不到 dsh-pet/lib，请用 --lib 指定`);
  if (hits.length > 1) throw new Error(`找到多个 dsh-pet：\n  ${hits.join('\n  ')}\n请用 --lib 指定一个`);
  return hits[0];
}

const LIB = resolveLib();

const CLIENT_OLD_A = `\t\t\tconst m = merged.main;
\t\t\tif (!m || !Array.isArray(m.pets)) throw new Error("Invalid config response");
\t\t\tconst loadedPets = m.pets;`;

const CLIENT_NEW_A = `\t\t\tconst m = merged.main;
\t\t\tif (!m || !Array.isArray(m.pets)) throw new Error("Invalid config response");
\t\t\tconst loadedPets = [];
\t\t\tfor (const [__entryId, __conf] of Object.entries(merged)) {
\t\t\t\tconst __list = Array.isArray(__conf?.pets) ? __conf.pets : [];
\t\t\t\tfor (const __p of __list) loadedPets.push({ ...__p, __entry: __entryId });
\t\t\t}`;

const CLIENT_OLD_B = `\t\t\t\tconst body = {
\t\t\t\t\tpets,`;

const CLIENT_NEW_B = `\t\t\t\tconst __mainPets = pets.filter((p) => (p.__entry ?? "main") === "main").map(({ __entry: __e, ...__rest }) => __rest);
\t\t\t\tconst __otherPets = {};
\t\t\t\tfor (const __p of pets) {
\t\t\t\t\tconst __e = __p.__entry ?? "main";
\t\t\t\t\tif (__e === "main") continue;
\t\t\t\t\t(__otherPets[__e] ??= []).push(__p);
\t\t\t\t}
\t\t\t\tconst body = {
\t\t\t\t\tpets: __mainPets,`;

const CLIENT_OLD_C = `\t\t\t\tpetBridge.reload(await res.json());`;
const CLIENT_NEW_C = `\t\t\t\tconst __merged = await res.json();
\t\t\t\tfor (const [__e, __list] of Object.entries(__otherPets)) {
\t\t\t\t\tawait fetch("/dsh-pet-7340/config/entry/" + encodeURIComponent(__e), {
\t\t\t\t\t\tmethod: "PUT",
\t\t\t\t\t\theaders: { "content-type": "application/json" },
\t\t\t\t\t\tbody: JSON.stringify({ pets: __list.map(({ __entry: __x, ...__rest }) => __rest) })
\t\t\t\t\t});
\t\t\t\t}
\t\t\t\tpetBridge.reload(__merged);`;

const HOST_OLD = `\t\tif (rest === "anim") {`;

const HOST_NEW = `\t\tif (rest.startsWith("config/entry/")) {
\t\t\tconst entryId = decodeURIComponent(rest.slice("config/entry/".length)).trim();
\t\t\tif (!entryId) return {
\t\t\t\tkind: "json",
\t\t\t\tstatus: 400,
\t\t\t\tobj: { error: "missing entry id" }
\t\t\t};
\t\t\tconst hit = readPetConfigEntry(configPaths, entryId);
\t\t\tif (!hit) return {
\t\t\t\tkind: "json",
\t\t\t\tstatus: 404,
\t\t\t\tobj: { error: "unknown pet pack: " + entryId }
\t\t\t};
\t\t\tif (method !== "PUT") return {
\t\t\t\tkind: "json",
\t\t\t\tstatus: 405,
\t\t\t\tobj: { error: "method not allowed" }
\t\t\t};
\t\t\tlet parsed;
\t\t\ttry {
\t\t\t\tparsed = JSON.parse(body ?? "");
\t\t\t} catch {
\t\t\t\treturn {
\t\t\t\t\tkind: "json",
\t\t\t\t\tstatus: 400,
\t\t\t\t\tobj: { error: "invalid JSON body" }
\t\t\t\t};
\t\t\t}
\t\t\tconst clean = saveUserConfig(parsed, hit.raw);
\t\t\tif (!clean) return {
\t\t\t\tkind: "json",
\t\t\t\tstatus: 400,
\t\t\t\tobj: { error: "invalid pet config for entry " + entryId }
\t\t\t};
\t\t\tconst next = {
\t\t\t\t...hit.raw,
\t\t\t\tpets: clean.pets
\t\t\t};
\t\t\tawait writeFile(hit.path, JSON.stringify(next, null, 2), "utf8");
\t\t\tsyncDesktop();
\t\t\treturn {
\t\t\t\tkind: "json",
\t\t\t\tstatus: 200,
\t\t\t\tobj: readAllConfig(configPaths)
\t\t\t};
\t\t}
\t\tif (rest === "anim") {`;

const jobs = [
  { file: 'client.js', label: '列表聚合（所有条目）', old: CLIENT_OLD_A, neu: CLIENT_NEW_A },
  { file: 'client.js', label: '保存时按条目拆分', old: CLIENT_OLD_B, neu: CLIENT_NEW_B },
  { file: 'client.js', label: '保存后回写各条目', old: CLIENT_OLD_C, neu: CLIENT_NEW_C },
  { file: 'index.js', label: '新增 PUT /config/entry/<名>', old: HOST_OLD, neu: HOST_NEW },
];

const src = {
  'client.js': readFileSync(join(LIB, 'client.js'), 'utf8'),
  'index.js': readFileSync(join(LIB, 'index.js'), 'utf8'),
};

let ver = '未知版本';
try {
  ver = JSON.parse(readFileSync(join(LIB, '..', 'package.json'), 'utf8')).version;
} catch {
  // 备份目录里没有 package.json，不阻塞锚点检查
}
console.log(`dsh-pet ${ver}  lib = ${LIB}\n`);

let ok = true;
const pending = [];
for (const j of jobs) {
  const count = src[j.file].split(j.old).length - 1;
  console.log(`${count === 1 ? '✓' : '✗'} ${j.label}：锚点 ${count} 处`);
  if (count === 1) pending.push(j);
  if (count !== 1) ok = false;
}

if (!ok) {
  console.error(
    '\n锚点对不上——这个补丁只针对 dsh-pet 0.3.8 的产物。\n' +
      '要么版本变了（上游改过这段代码），要么已经打过补丁。未改动任何文件。',
  );
  process.exit(1);
}
if (!APPLY) {
  console.log('\n干跑通过。加 --apply 实际写入（先备份到 DSH_HOME/plugin-registry/backups）。');
  process.exit(0);
}

const stamp = new Date()
  .toISOString()
  .replace(/[-:T]/g, '')
  .slice(0, 14);
const bak = join(DSH_HOME, 'plugin-registry', 'backups', `${stamp}-dsh-pet-pack-settings`);
mkdirSync(bak, { recursive: true });
copyFileSync(join(LIB, 'client.js'), join(bak, 'client.js'));
copyFileSync(join(LIB, 'index.js'), join(bak, 'index.js'));

for (const j of pending) src[j.file] = src[j.file].replace(j.old, j.neu);
writeFileSync(join(LIB, 'client.js'), src['client.js']);
writeFileSync(join(LIB, 'index.js'), src['index.js']);

console.log(`\n已写入。备份：${bak}`);
console.log('下一步：重启 DSH（宿主那半要重启才生效），然后刷新页面。');
console.log(`回滚：把 ${bak} 里的 client.js / index.js 拷回 ${LIB}，再重启。`);