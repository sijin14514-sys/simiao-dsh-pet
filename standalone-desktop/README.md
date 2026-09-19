# 肆喵 · 独立桌面版（脱离 DSH）

让肆喵**完全不依赖 DSH** 跑在桌面上——由 [dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop)
（Python + PySide6 的独立桌宠）承载。本包提供**角色素材 + 一键安装脚本**。

> 同样的 20 段素材，也支持装在 DSH 的 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 插件里（见仓库主 README）。

## 一、安装（傻瓜版：双击一个文件）

**Windows**：解压本包 → **双击「一键安装-肆喵.cmd」** → 等它跑完 → 桌面上就有肆喵了。

它全程自动（不需要命令行知识、不需要管理员权限）：

| 步骤 | 自动做的事 |
|---|---|
| ① | 检查有没有装独立桌宠程序 —— **没装就从 GitHub 自动下载并静默安装**（约 140MB） |
| ② | 启动一次程序以生成它的配置 |
| ③ | 把 `characters/simiao/`（20 段动画）拷进程序的角色目录 |
| ④ | 把当前角色切换为「肆喵」（**写入无 BOM 的 UTF-8**） |
| ⑤ | 打开开机自启（可在桌宠右键菜单里随时关） |
| ⑥ | 启动桌宠 |

> 📖 **图文教程 + 常见问题**见 [`安装教程.md`](安装教程.md)（含"双击一闪而过""还是蓝色那只"等排错）。

**macOS / Linux**：

```sh
sh install.sh
```

载体程序（dsh-pet-indesktop）各平台打包形式不同，需自行从
[它的 Releases](https://github.com/MerZlin/dsh-pet-indesktop/releases/latest) 装好并**运行过一次**，再执行上面的命令。

### 高级 / 自定义用法

只装角色、不动开机自启、不启动程序等：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -SkipAutostart -NoLaunch
# 参数：-SkipAppInstall（不检查/不装载体程序） -SkipAutostart -NoLaunch -TestDownload（只测下载通道）
```

安装脚本做两件事：把 `characters/simiao/` 拷进程序的用户数据目录；把 `config.json` 的 `character`
改成 `simiao`（**写入时去掉 UTF-8 BOM**）。重启程序即可看到肆喵。不想改配置也行：只拷角色目录，
然后在桌宠上**右键 → 角色菜单 → 肆喵**手动切换（热加载，不用重启、不用重新打包）。

### 手动安装（完全不想用脚本）

把 `characters/simiao/` 整个目录放进：

| 平台 | 目标路径 |
|---|---|
| Windows | `%APPDATA%\dsh-pet-standalone-webm\characters\simiao\` |
| macOS | `~/Library/Application Support/dsh-pet-standalone-webm/characters/simiao/` |
| Linux | `~/.config/dsh-pet-standalone-webm/characters/simiao/` |

> ⚠️ 目录名带 **`-webm`** 后缀（对应 WebM 变体）。脚本会自动尝试
> `dsh-pet-standalone-webm` 与 `dsh-pet-standalone` 两个目录。

> ⚠️ **改配置一定要写无 BOM 的 UTF-8**。我们实测过：带 BOM 的 `config.json` 会让应用解析失败、
> 静默退回内置角色（日志里仍是 `当前形象: shenshen`）。脚本已处理这一点。

## 二、为什么能直接搬（零改代码）

两个项目用的是**同一套素材规范**：

|  | dsh-pet | dsh-pet-indesktop |
|---|---|---|
| 画布 / 帧率 | 640×360 / 24fps | 640×360 / 24fps |
| 编码 | VP9-alpha webm | VP9-alpha webm |
| 脚底线 | y = 330 | `FEET_Y = 330`（`PAD = 30`） |
| 可点击区 | `HIT_BOX {200,50,440,335}` | `manifest.json` 的 `body_box` |
| 素材组织 | pet pack | 外部角色目录（支持热加载） |

本包 `manifest.json` 里的 `body_box` 为 `[210, 58, 429, 336]`——**用素材实测**出来的角色包围盒。

## 三、动作映射

| 该项目的分类 | 放入的动画 |
|---|---|
| `videos/idle/` | 待机呼吸 |
| `videos/click/` | 点击回应-开心跃动 / 被吓一跳 / 生气跺脚 / 鼓掌庆祝 / 鞠躬 |
| `videos/drag/` | 被鼠标拖拽悬空反抗 |
| `videos/move/` | 小碎步走路 |
| `videos/random/` | 左右张望 / 招手打招呼 / 摇头晃脑 / 冒爱心 / 原地转圈 / 打瞌睡 / 抱着枕头睡觉 / 看书 / 擦汗 / 戴耳机听歌 / 吃零食 |
| `videos/events/balance/` | 余额-钱袋如常 |

**两点已知差异**：

- 本项目没有 `turn/`（转身）动画，该目录留空。想要转身效果，把 `random/原地转圈.webm` 复制一份到 `videos/turn/`。
- `events/balance/` 只有 **1 段**，而内置角色是 6 段对应 6 个余额档位。如果该应用的档位映射要求 6 个文件，
  把这一份复制成 6 个文件名即可。

## 四、实测结果（Windows / v4.2.0）

| 步骤 | 结果 |
|---|---|
| 装角色到用户目录 + 改 `character` | ✓ |
| 应用启动日志 | `当前形象: simiao`、`素材加载完成：simiao 20 段动画` |
| 画面 | ✓ 桌面上出现肆喵，播放 `待机呼吸` |
| 是否需要 DSH | **完全不需要**，独立进程运行 |

## 五、授权与署名

- 载体程序 [MerZlin/dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop)：MIT。
- 角色素材源自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的衍生创作。
- **转载 / 展示 / 分发请同时附上这两个项目的地址**。
- 动画由**即梦 AI** 生成，仅供学习交流、**禁止商用**；商用请自行确认与平台的服务条款及角色形象权利。
