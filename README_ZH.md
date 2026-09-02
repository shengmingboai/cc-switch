# AI Switch

**AI Switch** 是一个统一的桌面应用，用于管理多个 AI 开发工具的配置。通过可视化界面一键导入供应商、即时切换、内置精选预设、统一的 MCP 和 Skills 管理，以及系统托盘快速切换——所有配置都由可靠的 SQLite 数据库支持，采用原子写入保护配置免受损坏。

## 功能特性

### 🎯 核心功能

- **统一供应商管理**：可视化界面管理所有 AI 工具的 API 配置
- **一键切换**：在不同供应商之间即时切换，无需手动编辑配置文件
- **精选预设**：内置主流 AI 服务商的配置预设，开箱即用
- **本地代理**：可选的本地代理模式，支持自动故障转移和健康检查
- **MCP 服务器管理**：统一管理 Model Context Protocol 服务器配置
- **Skills 管理**：集中管理和部署 AI 技能插件
- **系统托盘集成**：快速访问常用操作，支持后台运行

### 🛡️ 可靠性

- **SQLite 数据库**：所有配置存储在单一的 SQLite 数据库中
- **原子写入**：配置更新采用原子操作，防止数据损坏
- **自动备份**：定期自动备份，保留最近 10 个备份
- **跨平台**：支持 Windows、macOS 和 Linux

### 🎨 用户体验

- **现代化 UI**：基于 React + TypeScript + shadcn/ui 构建
- **深色模式**：内置明暗主题切换
- **国际化**：支持中文和英文界面
- **便携模式**：配置文件存储在应用同级目录，方便迁移

## 支持的 AI 工具

AI Switch 支持以下 AI 开发工具：

- **Claude Code**：Anthropic 的命令行工具
- **Claude Desktop**：Anthropic 的桌面应用
- **Codex**：AI 代码助手
- **Grok Build**：xAI 的构建工具
- **OpenCode**：开源 AI 编码工具
- **Pi**：个人 AI 助手

每个工具都有专门的供应商预设和配置管理。

## 安装

### Windows

下载 `.msi` 或 `.exe` 安装包，双击安装即可。

### macOS

```bash
# 使用 Homebrew 安装
brew install --cask ai-switch

# 升级
brew upgrade --cask ai-switch
```

或下载 `.dmg` 文件手动安装。

### Linux

```bash
# Arch Linux (AUR)
paru -S ai-switch-bin

# 或下载 .AppImage / .deb / .rpm 包
```

## 快速开始

1. **首次启动**：应用会自动检测已安装的 AI 工具并导入现有配置
2. **添加供应商**：点击"添加供应商"选择预设或手动配置
3. **切换供应商**：在供应商列表中点击"设为当前"即可切换
4. **MCP 配置**：在 MCP 页面管理 Model Context Protocol 服务器
5. **Skills 配置**：在 Skills 页面安装和启用技能插件

## 数据存储

- **数据库**：`./data/ai-switch.db`（相对于可执行文件位置）
- **本地设置**：`./data/settings.json`（设备级 UI 偏好）
- **备份**：`./data/backups/`（自动轮转，保留 10 个最新）
- **Skills**：`./data/skills/`（默认符号链接到对应应用）
- **Skill 备份**：`./data/skill-backups/`（卸载前自动创建，保留 20 个最新）

## 技术架构

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **后端**：Rust + Tauri 2.0 + tokio
- **数据库**：SQLite + rusqlite
- **构建工具**：Cargo + pnpm

## 开发

```bash
# 克隆仓库
git clone https://github.com/shengmingboai/ai-switch.git
cd ai-switch

# 安装依赖
pnpm install

# 开发模式
pnpm tauri dev

# 构建
pnpm tauri build
```

## 许可证

MIT License

## 版本

当前版本：**1.0.0**
