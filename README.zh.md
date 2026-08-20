# RolePlay Catalogue Client

[![License: GPL v3](https://www.gnu.org/graphics/gplv3-88x31.png)](https://www.gnu.org/licenses/gpl-3.0.en.html)

为 [SillyTavern](https://docs.sillytavern.app) 及 RolePlay Catalogue 服务管理的其他资源的可视化编辑器和 AI 辅助写作客户端。如需查看 RolePlay Catalogue 服务本身，请参阅 [RolePlay Catalogue](https://github.com/Firefox2100/roleplay-catalogue)。

## 项目描述

本桌面应用程序为角色资源提供结构化、按字段的编辑体验。数据由远程目录服务权威存储，本地草稿为一次性缓存。Rust 负责所有网络请求、凭据和应用文件 I/O；React 不会看到原始密钥。草稿保存使用乐观并发控制（`If-Match` / ETag），并在冲突时弹出三向合并对话框。

**核心原则：**

- 作为远程服务的客户端运行，不自行托管或提供内容。部分功能依赖远程服务处理，例如旧版本转换、存储和同步。
- 目录服务是唯一数据源；本地草稿可丢弃。
- Rust 拥有所有网络请求、凭据和文件 I/O；React 永远不会看到原始密钥。这能提供更安全、更一致的跨平台支持，并便于未来与其他客户端（包括基于 Web 的客户端）集成。
- 使用乐观并发控制（`If-Match` / ETag）的草稿保存，配合三向合并冲突对话框。
- 辅助创作工具旨在帮助写作和编辑，或在更自动化的工作流中直接生成内容。用户始终掌控保存至目录的最终内容。

## 功能特性

- **可视化编辑** — 按资源类型的多页面、多字段编辑器。
- **全面资源支持** — 角色卡、世界书、独立发行版。更多资源（如对话预设、WorldSE 世界等）计划实现中。
- **世界观概览规划器** — 本地存储的场景描述、基调、主题、角色结构和创作约束。
- **世界书编辑器** — 含激活测试器、正则表达式校验、优先级排序和递归扫描模拟。
- **关联世界书** — 将角色卡与独立世界书资源和已固定发行版关联。
- **扩展编排器** — 正则脚本、Tavern Helper 脚本和运行时变量，支持内联测试。
- **MVU 编排器** — 类型安全的变量模型，可生成协调的脚本、世界书条目和正则构件。
- **封面与资产管理器** — 上传目录封面、从图库选择、为 V3 资产嵌入 data URI。
- **AI 共同创作者** — 对话历史、结构化修改建议、单字段或全文草稿编辑上下文。
- **确定性概览诊断** — 完成度百分比、Token 估算、结构性错误和警告。
- **国际化** — 英语（英国）和简体中文界面；资源内容语言驱动 LLM 提示词。
- **暗色 / 亮色 / 跟随系统** 主题支持，尊重 `prefers-color-scheme`。

## 快速开始

### 系统要求

从源码编译构建时，需要以下环境：

- **Node.js** 18+ 和 **npm**（或 **pnpm**）
- **Rust** 1.76+（需安装 `rustup`）
- **Tauri CLI** — `npm install -g @tauri-apps/cli`
- **Linux**：`libwebkit2gtk-4.1`、`libssl3`、`rustc`、`cargo`、`clang`、`make`
- **Windows**：Visual Studio Build Tools 2022（包含「桌面 C++ 开发」工作负载）
- **macOS**：Xcode Command Line Tools

使用预编译发行版时，仅需在支持的操作系统架构上运行（Linux x86_64、Windows x86_64、macOS x86_64 或 arm64）。

### 从源码构建

```bash
# 安装前端依赖
npm install

# 启动开发服务器（支持热重载）
npm run tauri dev

# 构建生产版本
npm run tauri build
```

编译后的二进制文件将置于 `src-tauri/target/release/bundle/` 目录中（Linux：AppImage、Debian、Flatpak；Windows：NSIS、MSIX；macOS：dmg、pkg）。

### 使用预编译发行版

从发行渠道下载压缩包，安装或解压后启动。首次打开时：

1. 打开 **设置**（导航抽屉中的齿轮图标）。
2. 填入 **Catalogue** 基础 URL 和 API 密钥。
3. （可选）配置 **LLM provider** 以使用 AI 共同创作者。
4. 点击 **保存设置**。

完成配置后，即可进入资源选择器，创建或选择一个角色卡或世界书进行编辑。

## 项目结构

```
├── src/                     # React 前端
│   ├── App.tsx              # 外壳、路由、状态绑定
│   ├── types.ts             # TypeScript 接口
│   ├── backend.ts           # Tauri invoke 封装
│   ├── i18n.ts              # en-GB / zh-CN 翻译
│   ├── threeWayMerge.ts     # 乐观并发三向合并
│   └── *.tsx                # 编辑器页面
├── src-tauri/
│   ├── src/lib.rs           # 全部 Tauri 命令（目录、LLM、SQLite）
│   ├── Cargo.toml           # Rust 依赖
│   └── capabilities/        # Tauri 权限模式
├── plans/                   # 设计文档与分析结果
└── docs/                    # 额外文档
```

## 许可

GNU General Public License v3.0 — 详见 [LICENSE](LICENSE)。
