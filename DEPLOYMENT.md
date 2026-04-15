# 🏖️ 沙箱终端部署指南

## 📋 概述

本项目现已支持**Docker 沙箱终端**,每个用户使用终端时都会获得一个**完全独立的"新电脑"环境**:

- ✅ 独立的文件系统 (挂载用户项目目录)
- ✅ 独立的环境变量 (用户自定义配置)
- ✅ 资源限制 (2GB 内存 + 1 CPU 核心)
- ✅ 安全隔离 (不影响宿主机和其他用户)
- ✅ 自动清理 (30 分钟无活动自动销毁)

---

## 🚀 快速部署

### Windows 系统

**前置要求**:
1. 安装 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
2. 启用 WSL2 后端
3. 安装 Node.js 20+

**部署步骤**:
```powershell
# 1. 以管理员身份打开 PowerShell
# 2. 切换到项目目录
cd F:\js-vue-project\productManager

# 3. 执行部署脚本
.\deploy-windows.ps1
```

### Linux/Mac 系统

**前置要求**:
1. 安装 Docker
2. 安装 Node.js 20+

**部署步骤**:
```bash
# 1. 切换到项目目录
cd /path/to/productManager

# 2. 执行部署脚本
chmod +x deploy.sh
./deploy.sh
```

---

## 🔧 手动部署

### 1. 构建沙箱镜像

```bash
cd server/docker
docker build -t pm-sandbox:latest -f Dockerfile.sandbox .
```

### 2. 安装依赖

```bash
cd server
npm install

cd ../web
npm install
```

### 3. 初始化数据库

```bash
cd server
npx prisma generate
npx prisma db push
```

### 4. 配置环境变量

```bash
cd server
cp .env.production .env

# 编辑 .env 文件，修改 JWT 密钥为随机字符串
```

### 5. 构建项目

```bash
cd server
npm run build

cd ../web
npm run build
```

### 6. 启动服务

```bash
cd server
node dist/index.js
```

---

## 🎯 使用流程

### 用户首次使用

1. **访问系统**: 浏览器打开 `http://服务器IP:5173`
2. **注册账号**: 创建用户账号
3. **登录系统**: 使用账号登录
4. **创建项目**: 输入项目名称创建项目

### 使用终端

1. **选择项目**: 在左侧面板选择要操作的项目
2. **点击终端**: 点击 "💻" 终端选项卡
3. **自动连接**: 系统自动创建沙箱容器并连接到项目目录
4. **开始操作**: 在终端中执行任何命令

### 沙箱特性

- **打开终端** → 自动创建全新 Docker 容器
- **关闭终端** → 容器自动销毁
- **下次打开** → 又是全新的容器
- **项目文件** → 持久化保存 (不受沙箱销毁影响)

---

## ⚙️ 配置说明

### 环境变量 (server/.env)

```env
# 服务器配置
PORT=3001          # HTTP API 端口
WS_PORT=3002       # WebSocket 端口

# 沙箱配置
SANDBOX_IMAGE=pm-sandbox:latest    # 沙箱镜像名称
SANDBOX_MEMORY_MB=2048             # 每个沙箱内存限制 (MB)
SANDBOX_IDLE_TIMEOUT_MINUTES=30    # 空闲超时 (分钟)
```

### 资源限制

| 资源 | 限制 |
|------|------|
| 内存 | 2GB/容器 |
| CPU | 1 核心/容器 |
| 进程数 | 200/容器 |
| 空闲超时 | 30 分钟 |

---

## 🛡️ 安全保障

### 用户隔离
- ✅ 每个用户独立的项目目录
- ✅ 每个终端会话独立的 Docker 容器
- ✅ 容器间完全隔离，互不影响

### 系统安全
- ✅ 删除所有 Linux 能力 (CapDrop ALL)
- ✅ 禁止提权 (no-new-privileges)
- ✅ 只挂载用户项目目录
- ✅ 自动清理空闲容器

### 资源管控
- ✅ 内存限制防止耗尽
- ✅ CPU 限制防止独占
- ✅ 进程数限制防止 fork 炸弹
- ✅ 超时自动回收

---

## 📊 监控和维护

### 查看活跃沙箱

```bash
docker ps --filter "label=managed-by=product-manager"
```

### 查看沙箱日志

```bash
docker logs <container_id>
```

### 手动清理沙箱

```bash
docker ps --filter "label=managed-by=product-manager" -q | xargs docker rm -f
```

### 查看服务器日志

```bash
# Windows
Get-Content logs\server.log -Tail 50

# Linux/Mac
tail -f logs/server.log
```

---

## 🔍 故障排查

### Docker 无法启动

**问题**: `Cannot connect to the Docker daemon`

**解决**:
```bash
# Windows: 启动 Docker Desktop
# Linux: sudo systemctl start docker
```

### 沙箱创建失败

**问题**: `Error creating sandbox: Cannot find image`

**解决**:
```bash
cd server/docker
docker build -t pm-sandbox:latest -f Dockerfile.sandbox .
```

### 端口被占用

**问题**: `Error: listen EADDRINUSE: address already in use`

**解决**: 修改 `.env` 文件中的端口配置

### 内存不足

**问题**: 沙箱频繁崩溃

**解决**: 增加服务器内存或减少 `SANDBOX_MEMORY_MB`

---

## 📈 性能优化

### 推荐服务器配置

| 用户数 | CPU | 内存 | 磁盘 |
|--------|-----|------|------|
| 5-10   | 4 核 | 16GB | 50GB |
| 10-20  | 8 核 | 32GB | 100GB |
| 20-30  | 16 核| 64GB | 200GB |

### 优化建议

1. **使用 SSD**: 提升文件读写性能
2. **增加内存**: 支持更多并发用户
3. **调整超时**: 根据使用习惯调整 `SANDBOX_IDLE_TIMEOUT_MINUTES`
4. **镜像预热**: 提前构建好镜像，避免首次使用等待

---

## 📝 更新日志

### v1.0.0 - 沙箱终端

- ✅ 新增 Docker 沙箱镜像
- ✅ 新增沙箱管理器
- ✅ 终端连接改为容器模式
- ✅ 自动清理空闲容器
- ✅ 资源限制和安全加固

---

## 🆘 获取帮助

如有问题，请检查:
1. Docker 是否正常运行
2. 端口是否被占用
3. 日志文件是否有错误信息
4. 环境变量配置是否正确
