import { fileURLToPath } from 'node:url';
// 按 pet/simiao-animation 里实际存在的 AI 动画，自动生成 pet pack 配置并安装到 DSH。
// 只写"文件确实存在"的动画名，避免池子引用缺失文件导致播放时 404。
import { readdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/, '') + '\\';
const DSH = 'D:\\dsh\\dsh-pet\\pet\\';
const ANIM_DIR = ROOT + 'pet\\simiao-animation\\';
const available = new Set(readdirSync(ANIM_DIR).filter((f) => f.endsWith('.webm')).map((f) => f.replace(/\.webm$/, '')));
const keep = (names) => names.filter((n) => available.has(n));

// 动作 → 池子归属（只在文件存在时才写进去）
// 节奏设计：idle 池只放"站着不动"的呼吸，权重给到 70 —— 每次动作播完都大概率回到站立呼吸，
// 再偶尔做个小动作，避免看起来"一直在忙"。
const POOLS = {
  idle: ['待机呼吸-AI'],                                   // 站着不动的那个
  clicks: ['点击回应-开心跃动-AI', '被吓一跳-AI', '生气跺脚-AI', '鼓掌庆祝-AI', '鞠躬-AI'],
  drag: ['被鼠标拖拽悬空反抗-AI'],
  moves: ['小碎步走路-AI'],
  balance: ['余额-钱袋如常-AI'],
  categories: [
    { id: '小动作', weight: 12, names: ['左右张望-AI', '招手打招呼-AI', '摇头晃脑-AI', '冒爱心-AI', '原地转圈-AI'] },
    { id: '待机小动作', weight: 10, names: ['打瞌睡-AI', '抱着枕头睡觉-AI', '看书-AI', '擦汗-AI', '戴耳机听歌-AI'] },
    { id: '吃喝', weight: 8, names: ['吃零食-AI'] },
  ],
};
// idle 权重（剩下的按上面分类权重分配：这里的分类权重合计 = 100 - idle）
const IDLE_WEIGHT = 65;

const idle = keep(POOLS.idle);
if (!idle.length) { console.error('没有可用的 idle 动画，中止'); process.exit(1); }

const categories = POOLS.categories
  .map((c) => ({ id: c.id, weight: c.weight, actions: keep(c.names) }))
  .filter((c) => c.actions.length);

const balancePool = keep(POOLS.balance);
const balance = balancePool.length ? Array.from({ length: 6 }, () => balancePool[0]) : idle.slice(0, 1).concat(Array(5).fill(idle[0]));

const movesActions = keep(POOLS.moves);
const moveWeight = movesActions.length ? 5 : 0;

const config = {
  pets: [
    {
      id: 'simiao',
      name: '肆喵',
      size: 380,
      balanceEnabled: true,
      whisperEnabled: false,
      workStatusEnabled: false,
      display: 'desktop',
      position: { corner: 'bottom-right', marginX: 24, marginY: 24 },
    },
  ],
  animations: {
    idle,
    turn: [],
    drag: keep(POOLS.drag),
    clicks: keep(POOLS.clicks),
    moves: {
      default: { minDist: 60, maxDist: 240, margin: 20, leadSec: 2, tailSec: 2 },
      actions: movesActions.map((name) => ({ name })),
    },
    categories,
    events: { balance },
  },
  animationWeights: { idle: IDLE_WEIGHT, turn: 0, move: moveWeight },
  eventsRefreshSec: { balance: 1800 },
};

writeFileSync(ROOT + 'pet\\simiao-config.json', JSON.stringify(config, null, 2) + '\n');
copyFileSync(ROOT + 'pet\\simiao-config.json', DSH + 'simiao-config.json');

// 同步动画文件到 DSH
let copied = 0;
for (const name of available) {
  const src = ROOT + `pet\\simiao-animation\\${name}.webm`;
  const dst = DSH + `simiao-animation\\${name}.webm`;
  if (!existsSync(dst)) { copyFileSync(src, dst); copied++; }
}

console.log(`可用 AI 动画 ${available.size} 条，新复制到 DSH ${copied} 条`);
console.log('idle      :', JSON.stringify(idle));
console.log('clicks    :', JSON.stringify(config.animations.clicks));
console.log('drag      :', JSON.stringify(config.animations.drag));
console.log('moves     :', JSON.stringify(movesActions));
console.log('categories:', categories.map((c) => `${c.id}(${c.weight}) ${c.actions.length} 条`).join(' / '));
console.log('balance   :', JSON.stringify(balancePool));
console.log('权重      :', JSON.stringify(config.animationWeights));
