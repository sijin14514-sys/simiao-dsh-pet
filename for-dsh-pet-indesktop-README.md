# 肆喵 · dsh-pet-indesktop 角色包

把 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的那只桌宠「肆喵」搬到
[dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop) 上——**脱离 DSH，独立跑在 Windows / macOS / Linux 桌面**。

> 两个项目用的是**同一套素材规范**（640×360、24fps、VP9-alpha、脚底对齐 y=330），
> 所以这是**纯搬运**：不改一行代码、不重新打包，放进"外部角色目录"即可热加载。

## 一、安装（30 秒）

1. 装好 [dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop/releases)（安装版或绿色版都行）。
2. 把本包的 `characters/simiao/` 整个目录拷进它的**用户数据目录**（跨升级保留）：

| 平台 | 目标路径 |
|---|---|
| Windows | `%APPDATA%\dsh-pet-standalone\characters\simiao\` |
| macOS | `~/Library/Application Support/dsh-pet-standalone/characters/simiao/` |
| Linux | `~/.config/dsh-pet-standalone/characters/simiao/` |

   （也可以放"exe 同目录的 `characters\`"，但那个会随升级被覆盖，推荐用户数据目录。）
3. **在桌宠上右键 → 角色菜单**，列表里就有「肆喵」，选中即热加载——**不用重启、不用重新打包**。

## 二、这 20 段动画放到了哪

| 该项目的分类 | 放入的动画 |
|---|---|
| `videos/idle/` | 待机呼吸 |
| `videos/click/` | 点击回应-开心跃动 / 被吓一跳 / 生气跺脚 / 鼓掌庆祝 / 鞠躬 |
| `videos/drag/` | 被鼠标拖拽悬空反抗 |
| `videos/move/` | 小碎步走路 |
| `videos/random/` | 左右张望 / 招手打招呼 / 摇头晃脑 / 冒爱心 / 原地转圈 / 打瞌睡 / 抱着枕头睡觉 / 看书 / 擦汗 / 戴耳机听歌 / 吃零食 |
| `videos/events/balance/` | 余额-钱袋如常 |

`manifest.json` 里的 `body_box` 是**用素材实测**出来的角色可点击包围盒（`[210, 58, 429, 336]`，640×360 画布坐标）。

**两点说明**：

- 本项目**没有做 `turn/`（转身）动画**——`dsh-pet` 里我们没有这个池，所以留空。想要转身效果，
  可以把 `random/原地转圈.webm` 复制一份到 `videos/turn/`。
- `events/balance/` 只放了 **1 段**。原角色（shenshen）是 6 段对应 6 个余额档位；
  如果该应用的档位映射要求 6 个文件，把它复制成 6 个文件名即可，或按它的 `manifest` 动作映射配置指向同一段。

## 三、素材来源

这些动画最初是为 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（DSH 的网页/桌宠插件）做的，
由**即梦 AI 图生视频**逐段生成，制作方法与脚本见 [simiao-dsh-pet](https://github.com/sijin14514-sys/simiao-dsh-pet)。

## 四、授权与署名

- 本角色包是 **[MerZlin/dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop)**（MIT）的**角色素材**，
  同时也是 **[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)** 的衍生作品。
  **转载 / 展示 / 分发请同时附上这两个项目的地址。**
- 动画素材由即梦 AI 生成，**仅供学习交流、禁止商用**；商用请自行确认与平台的服务条款及角色形象权利。
