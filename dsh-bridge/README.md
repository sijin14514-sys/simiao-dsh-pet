# dsh-bridge · 让肆喵跟着你的 DSH Agent 动

这是**DSH 侧的那一半**。桌宠本身跑在你的桌面上（独立进程），它不会自己去读 DSH 的内部状态；
这个插件在 DSH 进程里订阅 agent 生命周期事件，写成一份本地 jsonl，桌宠按字节偏移 tail 它——
于是 Agent 一开始干活，肆喵就切到"干活中"的状态并冒气泡说话。

> **动作 ≠ 状态。** 插件只负责把状态（idle / working / done）喂过去，具体播哪段动画由桌宠按
> **文件名关键字**在自己素材里挑。仓库里已经没有专门的 `工作状态-*` 素材了（那 6 段是复制改名的副本，
> 2026-10-28 已移除），所以现在 working 期间桌宠走普通随机池。想让干活时有专属动作，
> 得用新生成的视频并把文件名带上 `工作 / 代码 / 写 / 打字 / 敲`。

> 桌宠侧的开关是 `%APPDATA%\dsh-pet-standalone-webm\config.json` 里的 `agent_link.dsh: true`；
> 装完本插件后必须**两边都开**才联动（安装脚本会一起处理）。

## 为什么它是一个"零依赖"插件

这不是风格洁癖，是踩过事故的硬约束：

- DSH 的 profile 用 **`file:` 链接**安装本地插件，**pnpm 不会安装被链接包自己的依赖**；
- 一旦本插件声明了 `dependencies` / `peerDependencies`，插件树初始化就会整体抛错，
  **DSH 的所有 profile 都起不来**（2026-09 的真实事故：dsh web / headless / desktop 全挂）；
- 桌宠自带的那个旧版桥接就踩了这个坑：它声明了 9 个依赖，所以本仓库提供的这份是**重写的零依赖版**。

因此本目录的 `package.json` 里三个依赖字段都必须是空的，`verify_import.mjs` 会把这条红线当测试跑。

另一个好处是**它不受 DSH 的插件版本门禁影响**：不声明 peer，就不会像 `dsh-plugin-chart`、
`dsh-pet@0.2.8`（peer 上限 `<0.2.0-0`；0.3.8 已放宽）那样在 DSH 0.2.x 上被直接拒装。

## 安装

### 一键（Windows）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

它会做五件事：

| 步骤 | 动作 |
|---|---|
| ① | 找到你的 DSH_HOME 与 profile（默认 `web`） |
| ② | 备份 profile 的 `package.json` |
| ③ | 把 `@dsh-pet/bridge` 以 `file:` 形式写进依赖，并加进 `dsh.profile.bundles` |
| ④ | 在 profile 目录执行 `pnpm install` |
| ⑤ | 打开桌宠侧的 `agent_link.dsh`（写 **UTF-8 无 BOM**） |

参数：`-DshHome <路径>`、`-Profile <名字>`、`-SkipPetConfig`（只装 DSH 侧）。

macOS / Linux：

```sh
sh ./install.sh
```

### 手动（不想跑脚本）

1. 把本目录放到一个稳定路径（**不要放在临时目录**，DSH 靠这个路径加载）；
2. 编辑 `$DSH_HOME/profiles/<profile>/package.json`：

```json
{
  "dependencies": {
    "@dsh-pet/bridge": "file:/绝对路径/dsh-bridge"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@dsh-pet/bridge"
      ]
    }
  }
}
```

3. 在 profile 目录执行 `pnpm install`；
4. 编辑桌宠的 `config.json`（**UTF-8 无 BOM**）：`"agent_link": { "dsh": true }`；
5. **重启 DSH**（bundles 变更不是热加载项）。

## 验证

```sh
node check.mjs
```

打印桌宠侧开关、当前事件文件、以及桌宠日志里最近的状态跟随记录。三项都对就是这个样子：

```
=== 1) 桌宠侧开关 ===
  agent_link.dsh = true   notify_state = true   ✓ 已开启
=== 2) 桥接事件文件 ===
  dsh-12345.jsonl  98.0 KB  202 条事件  最后写入 22:10:13
=== 3) 桌宠是否在跟随 DSH 状态 ===
  ✓ 已经跟随到非 idle 状态 —— 联动生效
```

状态出现 `working / thinking / success / error / waiting_question` 就说明链路是通的。

## 事件文件放在哪

`%APPDATA%\dsh-pet-bridge\`（macOS/Linux：`~/.config/dsh-pet-bridge/`），文件名 `dsh-<pid>.jsonl`——
**每个 DSH 实例一个文件**，避免多开时互相覆盖；消费端按 mtime 取最新那个。
单文件超过 1MB 会轮转成 `dsh-<pid>.jsonl.1`。旧实例留下的文件可以直接删。

## 卸载

1. 从 profile 的 `package.json` 里删掉依赖与 bundles 里的 `@dsh-pet/bridge`，再 `pnpm install`；
2. 桌宠配置里把 `agent_link.dsh` 改成 `false`；
3. 重启 DSH；`%APPDATA%\dsh-pet-bridge\` 可整目录删除。

## 授权

MIT（见仓库根 [LICENSE](../LICENSE)）。这个插件是本仓库原创，不属于上游 dsh-pet 的衍生代码；
但它服务的那只宠物素材来自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的二创。
