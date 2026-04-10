# AI Product Manager

AI 对话驱动的产品管理系统 - 通过嵌入终端和 AI CLI 实现实时原型修改

## 🎯 项目特点

- **📁 文件管理**: 浏览和管理 Axure 原型文件
- **👁️ 实时预览**: iframe 渲染 HTML 效果，支持热更新
- **🎯 UI 选择器**: 点击选择页面元素，查看组件信息
- **✋ 拖拽/缩放**: 直接拖动调整元素位置和大小
- **💻 嵌入终端**: 支持任意 AI CLI 工具（Qwen Code、Cursor、Claude Code 等）
- **🔄 热更新**: 文件修改后自动刷新预览

## 📦 项目结构

```
productManager/
├── server/              # Node.js 后端服务
│   ├── index.ts         # 服务器入口
│   ├── package.json
│   └── tsconfig.json
├── web/                 # React 前端应用
│   ├── src/
│   │   ├── api/         # API 客户端
│   │   ├── components/  # React 组件
│   │   │   ├── FileTree.tsx       # 文件树
│   │   │   ├── RenderFrame.tsx    # 渲染区
│   │   │   ├── Terminal.tsx       # 终端
│   │   │   └── UISelector.tsx     # UI 选择器
│   │   ├── App.tsx      # 主应用
│   │   └── App.css      # 样式
│   ├── package.json
│   └── vite.config.ts
├── axure/               # Axure 原型文件（被管理）
├── package.json         # 根项目配置
├── PROJECT_PLAN.md      # 项目规划
└── README.md            # 本文档
```

## 🚀 快速开始

### 安装依赖

```bash
# 安装根项目依赖
npm install

# 安装后端依赖
cd server && npm install

# 安装前端依赖
cd ../web && npm install
```

### 启动开发环境

```bash
# 方式 1：同时启动前后端（推荐）
npm run dev

# 方式 2：分别启动
# 终端 1：后端
cd server && npm run dev

# 终端 2：前端
cd web && npm run dev
```

### 访问应用

在浏览器打开：**http://localhost:3000**

## 📖 使用说明

### 1. 查看原型

1. 左侧文件树浏览 `axure/` 目录下的文件
2. 点击 HTML 文件在中间区域预览
3. 文件夹可展开/收起

### 2. UI 元素选择与调整

1. 勾选右上角 "🎯 UI 选择器" 启用选择功能
2. 点击 iframe 内的任意元素进行选择
3. 查看组件信息（标签、类名、DOM 路径、位置尺寸）
4. **拖拽移动**: 拖动元素调整位置
5. **缩放调整**: 拖动元素右下角调整大小
6. 所有操作会生成 UI Intent 并输出到控制台

### 3. 使用 AI CLI 修改文件

在右侧终端执行任意 AI CLI 命令：

```bash
# 示例（具体命令取决于你使用的 AI CLI 工具）
qwen-code "把 page_1.html 的标题改成红色"
# 或
cursor "给按钮添加 hover 效果"
# 或
claude "优化这个页面的布局"
```

修改后预览区会自动刷新。

### 4. 热更新测试

1. 使用外部编辑器修改 `axure/` 下的 HTML 文件
2. 保存文件
3. 预览区自动刷新显示最新效果

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| 状态管理 | React Hooks |
| 终端 | xterm.js |
| 拖拽库 | interactjs |
| 后端 | Node.js + Express |
| WebSocket | ws |
| 文件监听 | chokidar |

## 🔌 API 接口

### HTTP API (端口 3001)

- `GET /api/files` - 获取文件列表
- `GET /api/file?path=xxx` - 读取文件内容
- `POST /api/file` - 保存文件

### WebSocket (端口 3002)

用于热更新推送：

```json
{
  "type": "file-change",
  "path": "page_1.html",
  "timestamp": 1234567890
}
```

## 🎨 界面布局

```
┌─────────────┬──────────────────┬─────────────┐
│             │                  │             │
│  文件树     │   预览区         │   终端      │
│  (280px)    │   (弹性)         │   (400px)   │
│             │                  │             │
│  📁 axure/  │  👁️ HTML 渲染    │  💻 CLI     │
│  - page_1   │  🎯 UI 选择器     │  任意命令  │
│  - index    │  ✋ 拖拽缩放     │             │
│             │                  │             │
└─────────────┴──────────────────┴─────────────┘
```

## 📝 UI Intent 输出

当使用 UI 选择器调整元素时，会生成如下 Intent：

```typescript
{
  action: 'move',           // 或 'resize'
  componentId: 'button.cta',
  deltaX: 20,               // X 轴移动距离
  deltaY: -10,              // Y 轴移动距离
  before: { x: 100, y: 200, width: 120, height: 40 },
  after: { x: 120, y: 190, width: 120, height: 40 }
}
```

可以在 `App.tsx` 的 `handleIntent` 函数中处理这些 Intent，例如：
- 发送到 AI 生成修改建议
- 记录操作历史
- 生成代码补丁

## 🔧 开发命令

```bash
# 开发
npm run dev          # 同时启动前后端
npm run dev:server   # 仅后端
npm run dev:web      # 仅前端

# 构建
npm run build        # 构建全部
npm run build:web    # 仅前端
npm run build:server # 仅后端

# 生产环境
npm start            # 启动后端服务
```

## 📋 端口说明

| 端口 | 用途 |
|------|------|
| 3000 | 前端开发服务器 |
| 3001 | 后端 HTTP API |
| 3002 | 后端 WebSocket（热更新） |

## 🚧 后续规划

- [ ] 资源管理面板（图片、CSS、JS）
- [ ] 多页面跳转配置
- [ ] 对话历史管理
- [ ] AI Intent 自动生成提示
- [ ] 代码差异预览
- [ ] 撤销/重做功能

## 📄 License

MIT
