# AI Product Manager - 快速开始指南

## 项目结构

```
productManager/
├── server/          # Node.js 后端服务
├── web/             # React 前端应用
├── axure/           # Axure 原型文件（被管理的文件）
└── package.json     # 根项目配置
```

## 快速启动

### 方式 1：同时启动前后端（推荐）

```bash
# 在项目根目录执行
npm run dev
```

### 方式 2：分别启动

```bash
# 终端 1：启动后端
cd server
npm run dev

# 终端 2：启动前端
cd web
npm run dev
```

## 访问应用

启动后在浏览器访问：**http://localhost:3000**

## 功能说明

### 1. 文件树（左侧）
- 📁 显示 `axure/` 文件夹下的所有文件
- 点击文件夹可展开/收起
- 点击 HTML 文件可在中间区域预览

### 2. 预览区（中间）
- 渲染选中的 HTML 文件
- 支持热更新：当 HTML 文件被修改时自动刷新
- 非 HTML 文件不显示内容

### 3. 终端（右侧）
- 嵌入的 xterm.js 终端
- 可以执行任何 Windows 命令
- 支持使用各种 AI CLI 工具：
  - `qwen-code` - Qwen Code CLI
  - `cursor` - Cursor CLI
  - `claude` - Claude Code CLI
  - `aider` - Aider CLI

## 使用场景

### 场景 1：查看原型效果
1. 在左侧文件树选择 HTML 文件
2. 中间区域自动渲染预览

### 场景 2：使用 AI 修改文件
1. 在右侧终端输入 AI CLI 命令
2. 例如：`qwen-code "把 page_1.html 的标题改为红色"`
3. AI 执行修改后，预览区自动刷新

### 场景 3：热更新测试
1. 使用外部编辑器修改 HTML 文件
2. 保存后预览区自动刷新

## 技术架构

- **后端**: Node.js + Express + WebSocket
- **前端**: React + TypeScript + Vite
- **终端**: xterm.js
- **文件监听**: chokidar

## 端口说明

| 端口 | 用途 |
|------|------|
| 3000 | 前端开发服务器 |
| 3001 | 后端 HTTP API |
| 3002 | 后端 WebSocket（热更新） |

## 下一步开发

当前是 MVP 版本，后续将添加：
- UI 元素选中功能（集成 ai-ui-runtime）
- 拖拽/缩放调整
- 资源管理
- 更完善的错误处理
