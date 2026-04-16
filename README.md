# AI Product Manager

**AI 驱动的产品原型管理系统** — 将原型预览、AI CLI 工具与 Docker 沙箱终端无缝集成，实现实时预览、智能编辑和完全隔离的终端体验。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-GPL--3.0-blue)

---

## 📖 目录

- [功能特点](#-功能特点)
- [快速开始](#-快速开始)
- [核心功能详解](#-核心功能详解)
- [技术架构](#-技术架构)
- [API 接口](#-api-接口)
- [部署指南](#-部署指南)
- [开发指南](#-开发指南)
- [常见问题](#-常见问题)

---

## ✨ 功能特点

### 🎯 核心能力

| 功能 | 描述 |
|------|------|
| **📁 多项目管理** | 创建、删除、切换独立项目，每个项目拥有独立文件空间 |
| **👁️ 实时预览** | iframe 渲染 HTML/CSS/JS，支持热更新自动刷新 |
| **🎨 UI 选择器** | 点击选择页面元素，查看完整 DOM 信息与样式 |
| **✋ 拖拽/缩放** | 直接拖动元素调整位置，拖拽边角调整尺寸 |
| **💻 Docker 沙箱终端** | 每个会话都是独立的 Docker 容器，支持任意 AI CLI 工具 |
| **🔐 用户系统** | 完整的注册/登录、JWT 认证、权限管理、强制改密码 |

### 🛠️ 文件管理

- **文件浏览**: 树形结构展示项目文件，支持展开/收起
- **文件操作**: 新建文件/文件夹、上传、重命名、删除
- **多格式支持**: HTML、CSS、JS、JSON、Markdown、图片、视频
- **代码编辑**: 内置代码编辑器，支持语法高亮和保存
- **资源导出**: 一键导出 HTML 及所有依赖资源为 ZIP

### 🎨 UI 选择系统

基于 `ai-ui-runtime` 设计理念，提供四种操作模式：

| 模式 | 功能 | 颜色 |
|------|------|------|
| **选择 (Select)** | 点击元素查看详情 | 🔵 蓝色 |
| **移动 (Move)** | 拖拽元素调整位置 | 🟢 绿色 |
| **缩放 (Resize)** | 拖拽边角调整尺寸 | 🟠 橙色 |
| **描述 (Describe)** | 生成元素自然语言描述 | 🟣 紫色 |

**元素信息展示**:
- DOM 路径、CSS 选择器
- 标签名、类名、ID
- 位置坐标、尺寸
- 完整属性列表
- 计算样式
- 无障碍属性 (ARIA)

### 💻 Docker 沙箱终端

每个终端会话都是独立的 Docker 容器：

```
┌─────────────────────────────────────────┐
│  🐳 Docker 沙箱容器                      │
│  ├─ 独立文件系统 (挂载用户项目目录)       │
│  ├─ 独立环境变量 (用户自定义配置)         │
│  ├─ 资源限制 (2GB 内存 + 1 CPU 核心)      │
│  ├─ 安全隔离 (CapDrop ALL, no-new-privs)│
│  └─ 自动清理 (30 分钟无活动自动销毁)      │
└─────────────────────────────────────────┘
```

**支持的 AI CLI 工具**:
```bash
qwen-code "修改页面标题为红色"
cursor "给按钮添加 hover 效果"
claude "优化页面布局"
aider "重构这个组件"
```

### 🔐 安全特性

- **JWT 认证**: Access Token + Refresh Token 双令牌机制
- **自动刷新**: Token 过期自动刷新，无感知切换
- **权限控制**: USER / ADMIN 角色分离
- **安全审计**: 操作日志记录
- **防暴力破解**: 登录失败次数限制
- **强制改密**: 管理员可强制用户重置密码

---

## 🚀 快速开始

### 前置要求

- Node.js 20+
- npm 或 yarn
- (可选) Docker Desktop - 用于沙箱终端功能

### 安装依赖

```bash
# 1. 安装根项目依赖
npm install

# 2. 安装后端依赖
cd server && npm install

# 3. 安装前端依赖
cd ../web && npm install
```

### 初始化数据库

```bash
cd server
npx prisma generate
npx prisma db push
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

1. 浏览器打开：**http://localhost:3000**
2. 注册账号并登录
3. 创建新项目
4. 开始使用！

---

## 📖 核心功能详解

### 1. 项目管理

#### 创建项目
```
1. 点击右上角 ➕ 按钮
2. 输入项目名称
3. 点击"创建"
4. 系统自动生成默认 index.html
```

#### 切换项目
```
1. 点击项目名称下拉框
2. 选择目标项目
3. 自动切换到该项目的工作区
```

#### 删除项目
```
1. 点击项目名旁的 🗑️ 图标
2. 确认删除操作
3. 项目文件与数据库记录同时删除
```

### 2. 文件管理

#### 文件树操作

| 操作 | 方法 |
|------|------|
| 展开文件夹 | 点击文件夹图标 |
| 选择文件 | 点击文件名 |
| 新建文件夹 | 右键 → 📁 新建文件夹 |
| 新建文件 | 右键 → 📄 新建文件 |
| 上传文件 | 右键 → 📤 上传文件 |
| 重命名 | 右键 → ✏️ 重命名 |
| 删除 | 右键 → 🗑️ 删除 |

#### 支持的文件类型

| 类型 | 扩展名 | 处理方式 |
|------|--------|----------|
| HTML | `.html`, `.htm` | 预览 + 代码编辑 |
| 样式表 | `.css` | 代码编辑 |
| JavaScript | `.js`, `.ts`, `.jsx`, `.tsx` | 代码编辑 |
| 数据 | `.json`, `.xml`, `.yaml`, `.yml` | 代码编辑 |
| 文档 | `.md`, `.markdown`, `.txt` | 预览/编辑 |
| 图片 | `.png`, `.jpg`, `.gif`, `.svg`, `.webp` | 图片查看器 |
| 视频 | `.mp4`, `.mov`, `.avi`, `.webm` | 视频播放器 |

### 3. UI 选择器

#### 启用方式
```
1. 选择 HTML 文件进入预览模式
2. 点击左侧面板 "🎯" 选项卡
3. 在渲染区右上角开启 "UI 选择器" 开关
4. 选择操作模式（选择/移动/缩放/描述）
```

#### 操作流程

**选择模式**:
```
1. 鼠标悬停 → 元素高亮 + 信息提示框
2. 点击元素 → 固定高亮 + 详情面板更新
3. 查看元素完整信息
4. 可复制标准格式 (JSON/Markdown/纯文本)
```

**移动模式**:
```
1. 选择目标元素
2. 切换到"移动"模式
3. 拖拽元素到新位置
4. 生成 Move Intent 输出到控制台
```

**缩放模式**:
```
1. 选择目标元素
2. 切换到"缩放"模式
3. 拖拽四角调整尺寸
4. 生成 Resize Intent 输出到控制台
```

#### Intent 输出格式

```typescript
// 移动操作
{
  type: 'move',
  widget_id: 'button.cta',
  widget_path: 'html > body > div#app > button.cta',
  widget_type: 'button',
  before: { x: 100, y: 200, width: 120, height: 40 },
  after: { x: 150, y: 180, width: 120, height: 40 }
}

// 缩放操作
{
  type: 'resize',
  widget_id: 'div.container',
  widget_path: 'html > body > div#app > div.container',
  widget_type: 'div',
  before: { x: 50, y: 50, width: 800, height: 600 },
  after: { x: 50, y: 50, width: 1000, height: 700 }
}

// 描述操作
{
  type: 'describe',
  widget_id: 'nav.main',
  widget_path: 'html > body > nav.main',
  widget_type: 'nav',
  description: '主导航栏，包含 Logo 和三个菜单项'
}
```

### 4. Docker 沙箱终端

#### 工作原理

```
用户点击终端
    ↓
创建 Docker 容器
    ├─ 镜像：pm-sandbox:latest
    ├─ 挂载：用户项目目录 → /workspace
    ├─ 挂载：用户持久化卷 → /root
    ├─ 环境变量：USER_ID, PROJECT_NAME, 用户自定义变量
    └─ 资源限制：2GB 内存，1 CPU 核心，200 进程
    ↓
返回终端流到前端 (PowerShell 风格)
    ↓
用户执行命令 (AI CLI 等)
    ↓
关闭终端/超时 → 销毁容器 (用户卷保留)
```

#### 配置环境变量

编辑 `server/.env`:

```env
# 沙箱配置
SANDBOX_IMAGE=pm-sandbox:latest
SANDBOX_MEMORY_MB=2048
SANDBOX_IDLE_TIMEOUT_MINUTES=30
```

#### 构建沙箱镜像

```bash
cd server/docker
docker build -t pm-sandbox:latest -f Dockerfile.sandbox .
```

### 5. 导出功能

#### 导出 HTML 及资源

```
1. 选择 HTML 文件进入预览模式
2. 点击右上角 "📦 导出" 按钮
3. 系统自动提取所有资源路径
4. 批量获取资源文件
5. 打包为 ZIP 下载
```

**支持导出的资源**:
- CSS 样式表
- JavaScript 脚本
- 图片文件 (PNG, JPG, GIF, SVG, WebP)
- 字体文件
- 其他 HTML 依赖

---

## 🏗️ 技术架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器 (前端)                         │
│  ┌─────────────┬──────────────────┬─────────────┐           │
│  │   文件树    │    预览/编辑器    │    终端     │           │
│  │  (280px)    │    (弹性)        │   (400px)   │           │
│  └─────────────┴──────────────────┴─────────────┘           │
│         │ HTTP (3001)              │ WebSocket (3002)        │
└─────────┼──────────────────────────┼─────────────────────────┘
          ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js 后端服务                          │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │  Express   │  WebSocket  │   认证中间件 │  文件监听   │  │
│  │  Router    │   Server    │   (JWT)     │  (chokidar) │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │  用户管理   │  项目管理   │  文件操作   │  沙箱管理   │  │
│  │  (Prisma)  │  (SQLite)   │  (multer)  │  (Docker)   │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐      ┌─────────────────┐
│   SQLite DB     │      │  Docker 沙箱    │
│  (用户/项目数据) │      │  (终端隔离)     │
│  - User         │      │  - 独立容器     │
│  - Project      │      │  - 用户持久化卷 │
│  - RefreshToken │      │  - 资源限制     │
│  - AuditLog     │      │  - 自动清理     │
└─────────────────┘      └─────────────────┘
```

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **前端框架** | React | 19.x |
| **构建工具** | Vite | 8.x |
| **语言** | TypeScript | 6.x |
| **路由** | React Router | 7.x |
| **HTTP 客户端** | Axios | 1.x |
| **终端** | xterm.js | 6.x |
| **拖拽库** | interactjs | 1.x |
| **Markdown** | react-markdown | 10.x |
| **后端框架** | Express | 4.x |
| **WebSocket** | ws | 8.x |
| **ORM** | Prisma | 7.x |
| **数据库** | SQLite (better-sqlite3) | - |
| **认证** | JWT (jsonwebtoken) | 9.x |
| **密码** | bcryptjs | 3.x |
| **文件监听** | chokidar | 3.x |
| **文件上传** | multer | 2.x |
| **容器** | dockerode | 4.x |
| **终端 PTY** | node-pty | 1.x |
| **限流** | express-rate-limit | 8.x |
| **ZIP 导出** | jszip | 3.x |

### 项目结构

```
productManager/
├── server/                     # Node.js 后端服务
│   ├── src/
│   │   ├── db/                # 数据库 (Prisma)
│   │   ├── middleware/        # 认证中间件
│   │   │   └── auth.ts        # JWT 验证
│   │   ├── routes/            # API 路由
│   │   │   ├── auth.ts        # 认证接口
│   │   │   ├── users.ts       # 用户管理
│   │   │   └── files.ts       # 文件操作
│   │   └── utils/             # 工具函数
│   │       ├── sandbox.ts     # 沙箱管理
│   │       ├── jwt.ts         # JWT 工具
│   │       ├── userProjects.ts # 用户项目目录
│   │       └── initAdmin.js   # 管理员初始化
│   ├── docker/                # Docker 配置
│   │   └── Dockerfile.sandbox # 沙箱镜像
│   ├── prisma/                # Prisma Schema
│   │   └── schema.prisma      # 数据模型
│   ├── index.ts               # 服务器入口
│   └── package.json
│
├── web/                        # React 前端应用
│   ├── src/
│   │   ├── api/               # API 客户端
│   │   │   └── client.ts      # Axios 封装 + Token 管理
│   │   ├── components/        # React 组件
│   │   │   ├── FileTree.tsx   # 文件树
│   │   │   ├── RenderFrame.tsx # 渲染区
│   │   │   ├── Terminal.tsx   # 终端
│   │   │   ├── UISelector.tsx # UI 选择器核心
│   │   │   ├── UISelectorComponents.tsx # UI 组件
│   │   │   ├── UISelectorOverlay.tsx # 覆盖层
│   │   │   ├── UISelectorTooltip.tsx # 提示框
│   │   │   ├── CodeEditor.tsx # 代码编辑器
│   │   │   ├── ImageViewer.tsx # 图片查看器
│   │   │   ├── VideoPlayer.tsx # 视频播放器
│   │   │   ├── MarkdownViewer.tsx # Markdown 预览
│   │   │   ├── ProtectedRoute.tsx # 路由守卫
│   │   │   └── UserHeader.tsx # 用户信息栏
│   │   ├── pages/             # 页面组件
│   │   │   ├── LoginPage.tsx  # 登录页
│   │   │   ├── RegisterPage.tsx # 注册页
│   │   │   ├── ChangePasswordPage.tsx # 改密码
│   │   │   ├── ProfilePage.tsx # 个人主页
│   │   │   └── AdminUsersPage.tsx # 用户管理
│   │   ├── utils/             # 工具函数
│   │   │   └── exportHelper.ts # ZIP 导出工具
│   │   ├── App.tsx            # 主应用
│   │   ├── Router.tsx         # 路由配置
│   │   └── main.tsx           # 入口
│   ├── package.json
│   └── vite.config.ts
│
├── axure/                      # 项目文件存储 (用户数据，Git 忽略)
├── deploy-windows.ps1          # Windows 部署脚本
├── deploy.sh                   # Linux/Mac 部署脚本
├── DEPLOYMENT.md               # 部署文档
├── LICENSE                     # GPL v3 许可证
├── QUICKSTART.md               # 快速开始
├── PROJECT_PLAN.md             # 项目计划
└── package.json                # 根项目配置
```

---

## 🔌 API 接口

### 认证接口

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 用户注册 | ❌ |
| POST | `/api/auth/login` | 用户登录 | ❌ |
| POST | `/api/auth/logout` | 用户登出 | ✅ |
| POST | `/api/auth/refresh-token` | 刷新 Token | ❌ |
| GET | `/api/auth/me` | 获取当前用户 | ✅ |
| POST | `/api/auth/change-password` | 修改密码 | ✅ |
| POST | `/api/auth/reset-password/:userId` | 重置密码 (Admin) | ✅ |

### 用户管理接口 (Admin)

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/users` | 获取用户列表 (支持分页/搜索) |
| GET | `/api/users/:id` | 获取用户详情 |
| PUT | `/api/users/:id` | 更新用户信息 (角色/状态) |
| DELETE | `/api/users/:id` | 删除用户 |

### 项目接口

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/projects` | 获取项目列表 |
| POST | `/api/projects` | 创建项目 |
| DELETE | `/api/projects/:name` | 删除项目 |

### 文件接口

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/files` | 获取文件树 |
| GET | `/api/file` | 读取文件内容 |
| POST | `/api/file` | 保存文件 |
| GET | `/api/file/blob` | 读取文件 Blob (图片/视频) |
| POST | `/api/folder` | 创建文件夹 |
| POST | `/api/create-file` | 创建文件 |
| DELETE | `/api/item` | 删除文件/文件夹 |
| POST | `/api/rename` | 重命名 |
| POST | `/api/upload` | 上传文件 (支持多文件) |
| POST | `/api/files/batch` | 批量获取资源 |

### WebSocket 接口

**连接地址**: `ws://localhost:3002?token=<JWT_TOKEN>&session=<SESSION_ID>`

**消息格式**:

```json
// 终端消息
{
  "type": "terminal-data",
  "session": "session-123",
  "data": "命令输出..."
}

// 文件变更通知
{
  "type": "file-change",
  "path": "project-1/index.html",
  "timestamp": 1234567890
}
```

---

## 🏖️ 部署指南

### Docker 沙箱部署

详细部署步骤请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

#### Windows 快速部署

```powershell
# 以管理员身份运行 PowerShell
cd F:\js-vue-project\productManager
.\deploy-windows.ps1
```

#### Linux/Mac 快速部署

```bash
cd /path/to/productManager
chmod +x deploy.sh
./deploy.sh
```

### 生产环境配置

1. **构建项目**
```bash
cd server && npm run build
cd ../web && npm run build
```

2. **配置环境变量**
```bash
cd server
cp .env.production .env
# 编辑 .env 修改 JWT 密钥等配置
```

3. **启动服务**
```bash
cd server
node dist/index.js
```

### 端口说明

| 端口 | 用途 |
|------|------|
| 3000 | 前端开发服务器 |
| 3001 | 后端 HTTP API |
| 3002 | 后端 WebSocket |
| 5173 | 生产环境前端 (Vite 默认) |

---

## 🛠️ 开发指南

### 开发命令

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

### 数据库迁移

```bash
cd server

# 生成 Prisma 客户端
npx prisma generate

# 同步数据库结构
npx prisma db push

# 创建新迁移
npx prisma migrate dev --name init

# 应用迁移
npx prisma migrate deploy
```

### 添加新功能

1. **后端 API**
   - 在 `server/src/routes/` 创建新路由
   - 在 `server/index.ts` 注册路由
   - 添加认证中间件 (如需要)

2. **前端组件**
   - 在 `web/src/components/` 创建新组件
   - 在页面中引用组件
   - 更新 API 客户端 (如需要)

3. **数据库变更**
   - 修改 `server/prisma/schema.prisma`
   - 运行 `npx prisma db push`

### 数据模型

```prisma
model User {
  id                  String         @id @default(uuid())
  username            String         @unique
  email               String         @unique
  passwordHash        String
  role                Role           @default(USER)
  avatarUrl           String?
  status              UserStatus     @default(ACTIVE)
  failedLogins        Int            @default(0)
  lockedUntil         DateTime?
  forcePasswordChange Boolean        @default(false)
  passwordResetBy     String?
  passwordResetAt     DateTime?
  lastLoginAt         DateTime?
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  projects            Project[]
  refreshTokens       RefreshToken[]
}

model Project {
  id        String   @id @default(uuid())
  name      String
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, name])
}

enum Role {
  USER
  ADMIN
}

enum UserStatus {
  ACTIVE
  LOCKED
  DISABLED
}
```

---

## ❓ 常见问题

### Q: 终端无法连接怎么办？

**A**: 检查以下几点：
1. Docker Desktop 是否已启动
2. 沙箱镜像是否已构建：`docker images | grep pm-sandbox`
3. 查看服务器日志是否有错误信息
4. 确认端口 3002 未被占用

### Q: 文件热更新不生效？

**A**: 
1. 确认 WebSocket 连接正常 (端口 3002)
2. 检查文件是否在监听范围内 (排除 node_modules)
3. 尝试手动刷新页面
4. 检查浏览器控制台是否有错误

### Q: 如何修改默认端口？

**A**: 编辑 `server/.env`:
```env
PORT=3001      # HTTP API 端口
WS_PORT=3002   # WebSocket 端口
```

前端端口在 `web/vite.config.ts` 中修改。

### Q: 用户数据存储在何处？

**A**: 
- **数据库**: `server/prisma/dev.db` (SQLite)
- **项目文件**: `axure/users/<USER_ID>/projects/`
- **用户持久化卷**: Docker Volume `pm-user-<USER_ID>`

### Q: 如何备份用户数据？

**A**: 备份以下目录：
```bash
# 数据库
cp server/prisma/dev.db backup.db

# 项目文件
cp -r axure/users/ backup/users/

# Docker 用户卷 (可选)
docker run --rm -v pm-user-xxx:/data -v $(pwd):/backup busybox tar czf /backup/user-xxx.tar.gz /data
```

### Q: 沙箱容器太多如何清理？

**A**: 
```bash
# 查看活跃沙箱
docker ps --filter "label=managed-by=product-manager"

# 手动清理所有沙箱
docker ps --filter "label=managed-by=product-manager" -q | xargs docker rm -f

# 调整空闲超时 (server/.env)
SANDBOX_IDLE_TIMEOUT_MINUTES=15
```

### Q: Token 过期如何处理？

**A**: 系统会自动刷新 Token，无需手动处理。如果刷新失败，会自动跳转到登录页。

---

## 📄 License

本项目采用 **GNU General Public License v3.0** 开源许可证。

- ✅ 允许商业使用
- ✅ 允许修改和分发
- ⚠️ **传染性要求**：任何衍生作品必须同样采用 GPL v3 开源
- 📄 完整许可证文件见 [LICENSE](./LICENSE)

---

## 🙏 致谢

本项目使用了以下优秀开源项目：

- [React](https://react.dev/) - 前端框架
- [Vite](https://vitejs.dev/) - 构建工具
- [Express](https://expressjs.com/) - 后端框架
- [Prisma](https://www.prisma.io/) - ORM
- [xterm.js](https://xtermjs.org/) - 终端组件
- [interactjs](https://interactjs.io/) - 拖拽库
- [Docker](https://www.docker.com/) - 容器化
- [JWT](https://jwt.io/) - 认证
- [Axios](https://axios-http.com/) - HTTP 客户端
- [react-markdown](https://react-markdown.js.org/) - Markdown 渲染
- [jszip](https://stuk.github.io/jszip/) - ZIP 导出

---

**🎉 开始你的 AI 驱动产品设计之旅吧！**
