# NOTICE · 署名、来源与授权

本仓库（`simiao-dsh-pet`）是第三方桌宠素材与制作方法，**不是插件本体**。使用、转载、二创前请阅读本节。

## 1. 必须署名：插件的原作者

本仓库的全部素材都运行在 **[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)** 之上，
并以该项目**官方支持的 pet pack 形式**分发（只往用户数据目录放配置与素材，未修改、未重打包插件源码）。

**`standalone-desktop/` 里的角色则运行在 [MerZlin/dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop)
之上**——那是把桌宠移植到 Windows / macOS / Linux、且**不依赖 DSH** 的独立程序，同样是官方支持的
"外部角色目录（热加载）"扩展机制。

按两个项目的**二创约定**：

> 基于本项目的衍生 / 改版 / 换皮作品，在**任何介绍、展示、分发该作品的地方**，须附上原作者 GitHub 地址。

因此，**任何转载、展示、分发本仓库内容的地方，请一并写上**：

```
桌宠插件本体（DSH 版） ：https://github.com/PC2005-cloud/dsh-pet
独立桌面版       ：https://github.com/MerZlin/dsh-pet-indesktop
```

## 2. 各部分的权利归属

| 内容 | 说明 | 授权 |
|---|---|---|
| `tools/`、`docs/`、本 NOTICE 等**脚本与文档** | 本仓库作者编写 | MIT（见 [LICENSE](LICENSE)） |
| `pet-pack/`（`simiao-config.json` 与 20 段 `.webm` 动画） | 由**即梦 AI 图生视频**生成 | 仅供学习交流，**禁止商用**；再分发请保留本 NOTICE 与原作者署名 |
| `standalone-desktop/`（外部角色目录 + 安装脚本） | 同上素材，按 dsh-pet-indesktop 的目录约定重组 | 同上 |
| `assets/`（角色立绘、证件照） | 角色形象来自本仓库作者；素材同样由即梦生成 | 同上 |

关于 AI 生成内容：不同平台对生成物的使用与再分发规则不同，**商用前请自行确认**与即梦（ByteDance）之间的
服务条款，以及角色形象本身的权利归属。本仓库不对上述合规性作任何担保。

## 3. 依赖项目的许可

- **dsh-pet**：代码 MIT；其素材「允许开源使用、禁止商用」。本仓库不含该项目的任何文件（`pet-pack` 的目录约定、
  配置字段是它公开的扩展机制）。
- **DeepSeek Harness**：见其仓库许可。

## 4. 免责

本仓库按「现状」提供，不附带任何担保。因使用本仓库内容（包括但不限于素材合规、生成内容版权、
第三方平台条款）产生的风险由使用者自行承担。
