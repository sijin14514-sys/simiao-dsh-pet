# 肆喵 · dsh-pet 宠物包（pet pack）

一只住在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 网页 / 桌面里的桌宠，
按 dsh-pet 官方支持的 **pet pack**（额外宠物种类）方式分发——**不改插件源码，装完就能用**。

- 20 段动画全部由 AI 图生视频生成（非贴图变换）：待机呼吸 / 打瞌睡 / 抱着枕头睡觉 / 看书 / 擦汗 / 戴耳机听歌 /
  左右张望 / 招手打招呼 / 摇头晃脑 / 冒爱心 / 原地转圈 / 吃零食 / 小碎步走路 /
  点击回应-开心跃动 / 被吓一跳 / 生气跺脚 / 鼓掌庆祝 / 鞠躬 / 被鼠标拖拽悬空反抗 / 余额-钱袋如常
- **点击反馈有 5 种**（每次点她随机抽一段）；**待机 65% 是站着呼吸**，动作之间会歇一歇，不会一直忙
- 640×360 VP9-alpha webm，浏览器（Chrome/Edge/Firefox）与桌面模式（Electron）通用

![预览](preview.png)

## 一、前置条件

先装好 dsh-pet 插件（本项目只是它的宠物包，不含插件本体）：

```sh
dsh plugin --profile web add dsh-pet
```

## 二、安装本宠物包

### Windows（PowerShell）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

### macOS / Linux

```sh
sh ./install.sh
```

### 手动安装

把这两个东西放进 `$DSH_HOME/dsh-pet/pet/`（`$DSH_HOME` 默认是 `~/.dsh`）：

```
$DSH_HOME/dsh-pet/pet/
├─ simiao-config.json
└─ simiao-animation/        ← 20 个 .webm 平铺在里面
```

目录名必须与配置文件名前缀一致（`simiao-config.json` ↔ `simiao-animation/`）。

## 三、安装后

- **刷新浏览器页面**即可看到肆喵（文件宠物无需重启 DSH）。
- 设置页**不会列出**文件宠物（dsh-pet 的既定行为）——要改大小 / 位置 / 显示方式，直接编辑 `simiao-config.json`：
  - `display`：`web`（只在网页，默认）/ `desktop`（只在桌面）/ `both`（两边都显示）/ `none`
  - `size`：显示尺寸（默认 380）；`position.corner`：`top-left|top-right|bottom-left|bottom-right`
  - 桌面模式首次使用会自动下载 Electron（约 138MB），不想下就保持 `web`。
- **卸载**：删掉 `$DSH_HOME/dsh-pet/pet/` 下的 `simiao-config.json` 与 `simiao-animation/` 即可。

## 四、说明与授权

- 本宠物包是 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的**衍生作品**（pet pack 形式）。
  按该项目的二创约定，**任何介绍、展示、分发本作品的地方都请附上原作者地址**：<https://github.com/PC2005-cloud/dsh-pet>
- 动画素材由**即梦 AI 图生视频**生成（角色形象来自作者本人提供的立绘），素材使用请遵循你与即梦之间的服务条款。
- 插件本体（dsh-pet）的代码许可见其仓库；本宠物包只包含配置与素材。
