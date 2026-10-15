# 05 · 接入 DSH：让肆喵跟着 Agent 动

独立桌面版的肆喵离开 DSH 也能活，但那样她只是一只普通桌宠。**接上 DSH 之后**，她会知道你在干活：
Agent 读文件、跑命令、改代码、报错、等你审批，她都会切到对应动作，还会冒一句气泡。

这一节讲清楚链路的每一段，以及**为什么它能在 DSH 升级后继续活着**。

## 一、链路长什么样

```
 DSH 进程（Node）
   ├─ agent 生命周期事件 ──┐
   │                       │  订阅
   │                  ┌────▼─────────────────────────┐
   └─ 会话/工具调用 ───▶│ @dsh-pet/bridge（插件）      │
                       │  追加写 jsonl，零依赖        │
                       └────┬─────────────────────────┘
                            │  %APPDATA%\dsh-pet-bridge\dsh-<pid>.jsonl
                            │  （按字节偏移 tail，不回放历史）
                       ┌────▼─────────────────────────┐
                       │ 桌宠进程（Python + PySide6）  │
                       │  agent_link.dsh = true       │
                       │  → 切动作 / 冒气泡            │
                       └──────────────────────────────┘
```

三段缺一不可：

| 段 | 归属 | 开关 |
|---|---|---|
| 事件源 | DSH | —— |
| 桥接插件 | DSH | profile 的 `dependencies` + `dsh.profile.bundles` |
| 消费端 | 桌宠 | `config.json` 的 `agent_link.dsh: true` |

只开一边是最常见的"装了没反应"。

## 二、桥接写出来的是什么

文件名 `dsh-<pid>.jsonl`，**一个 DSH 实例一个文件**（多开不会互相覆盖；旧文件可以删）。
单文件超 1MB 轮转成 `.jsonl.1`。每行一条 JSON：

| 字段 | 含义 |
|---|---|
| `event` | 事件名，如 `AgentStatus` / `tool/call` / `tool/result` / `assistant/message` |
| `state` | 仅 `AgentStatus`：聚合后的忙闲状态（`working` / `idle`） |
| `tool` | 工具名（`pwsh` / `read` / `edit`…） |
| `ts` | 秒级时间戳 |

桌宠把这些事件翻译成自己的状态机，日志里写成 `[DSH STATE] working -> thinking` 这种形式，
自检时看的就是这行。

### 两个容易踩的实现细节（写在了插件源码注释里）

1. **状态抖动**：DSH 在 agent 创建/切换瞬间会抖出重复 `idle`（实测 `idle→working` 只隔 4ms），
   重复值不落盘——否则桌宠端 2 秒换帧节流会把真正的 `working` 吃掉。
2. **多 Agent 聚合**：必须**按 agent 分别记状态再聚合**（任一在忙就是忙）。全局单值去重会
   让先干完的子代理把还在干活的顶成 `idle`。

## 三、桌宠侧那几个开关

都在 `<桌宠用户目录>/config.json`（**UTF-8 无 BOM**）：

| 键 | 作用 |
|---|---|
| `agent_link.dsh` | 总开关：是否 tail 桥接文件 |
| `agent_link.notify_state` | 状态变化时是否冒气泡 |
| `agent_link.report_gates.activity` | 过程汇报（每步工具调用）的放行概率，默认 0.6，我们给 `1.0` 不抽稀 |
| `dialogue_mode` | `custom` 时用 `dialogue_phrases` 里的自定义台词 |
| `self_talk_enabled` | 空闲自言自语 |

过程汇报有**三重节流**（上游设计，不是 bug）：同一 Agent 10 秒 / 全局 8 秒 /
**同一个工具文案 60 秒内不重复**。所以连续用同一个工具，她只会说一次。

> ⚠️ 写这个文件必须**无 BOM**。带 BOM 会让应用解析失败、静默退回内置角色
> （日志里还是 `当前形象: shenshen`），这个坑我们在 `standalone-desktop/README.md` 里记过一次。

## 四、为什么它扛得住 DSH 升级

DSH 的插件 API 是 pre-stable 的，升级会打断插件，桥接的设计就是冲着"别被打断"去的：

| 风险 | 常见死法 | 桥接为什么没事 |
|---|---|---|
| 版本门禁 | 插件声明 `peerDependencies: ^0.1.1-rc.2`，在 0.2.x 上**直接被拒装**（`dsh-pet@0.2.8`、`dsh-plugin-chart` 都死在这） | **不声明任何 peer** |
| 依赖解析 | `file:` 链接的插件 pnpm 不装它自己的依赖 → 插件树初始化抛错 → **所有 profile 起不来**（2026-09 事故） | **零运行时依赖**，`verify_import.mjs` 把这条当测试跑 |
| 动态加载 | 用 `import()` 惰性加载可以绕过门禁与清单检查 | 源码**静态禁止** `require` / 动态 `import` |
| 事件名漂移 | 订阅的事件被改名 | 只订阅稳定的生命周期事件，未知事件忽略而不错抛 |

**实测**：DSH `0.1.5-rc.2` 与 `0.2.0-rc.2` 上均正常联动（`working / thinking / success / error /
waiting_question` 都跟随到了）。

## 五、排错顺序

照这个顺序走，基本三步定位：

1. **`node dsh-bridge/check.mjs`** —— 它会分别报告三段的状态；
2. 报"没有 `${APPDATA}\dsh-pet-bridge`" → DSH 侧没加载：核对 profile 的 `dependencies`
   与 `dsh.profile.bundles` **是否同时有** `@dsh-pet/bridge`，然后**重启 DSH**（bundles 不是热加载项）；
3. 报了事件文件、但桌宠日志里没有 `[DSH STATE]` → 桌宠侧开关没开（`agent_link.dsh`），
   或者在改完配置后没有重启桌宠。

其它已知现象：

| 现象 | 原因 |
|---|---|
| 她说话但动作不换 / 换动作但不出声 | 一个是 `report_gates` 抽稀，一个是 `notify_state`，两个开关独立 |
| 只有第一次工具汇报，后面不说了 | 60 秒同文案节流，正常 |
| 桌宠目录里有好几个 `dsh-*.jsonl` | 每次 DSH 启动一个文件；消费端取最新，旧的删掉无妨 |
| DSH 里装了 `dsh-pet` 插件却装不上 | 那个插件的 peer 上限是 `<0.2.0-0`，0.2.x 上被门禁拒绝——不是本仓库的问题，见第四节 |
