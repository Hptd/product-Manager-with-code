# 项目启动指南

## 📋 前置要求

- Node.js 20+
- npm 或 yarn
- (可选) Docker Desktop - 用于沙箱终端功能

---

## 🚀 快速启动

### 方式一：开发模式（推荐）

需要打开 **三个 PowerShell 终端窗口**，分别在项目根目录下执行：

#### 终端 1 - 启动后端

```powershell
cd server
node dist/index.js
```

如果后端未构建，先执行：
```powershell
cd server
npm run build
```

#### 终端 2 - 启动前端

```powershell
cd web
npx vite --config vite.config.local.ts --host 0.0.0.0
```

如果前端依赖未安装，先执行：
```powershell
cd web
npm install
```

#### 终端 3 - 保持打开即可

---

### 访问应用

启动成功后，在浏览器中打开：

- **本机访问**: http://localhost:5173
- **局域网访问**: http://[你的局域网IP]:5173

---

## 🔧 完整启动流程（首次使用）

### 1. 安装依赖

```powershell
# 安装根项目依赖
npm install

# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../web
npm install
```

### 2. 初始化数据库

```powershell
cd server
npx prisma generate
npx prisma db push
```

### 3. 构建后端

```powershell
cd server
npm run build
```

### 4. 启动服务（按上面的方式打开三个终端）

---

## 📝 端口说明

| 端口 | 用途 |
|------|------|
| 5173 | 前端开发服务器 |
| 8001 | 后端 HTTP API |
| 8002 | 后端 WebSocket |

---

## 🛠️ 开发命令

### 后端开发

```powershell
cd server

# 开发模式（自动重启）
npm run dev

# 构建生产版本
npm run build

# 启动生产版本
node dist/index.js
```

### 前端开发

```powershell
cd web

# 开发模式（本机访问）
npm run dev

# 开发模式（局域网访问）
npx vite --config vite.config.local.ts --host 0.0.0.0

# 构建生产版本
npm run build
```

---

## ⚙️ 配置说明

### 后端配置 (server/.env)

```env
PORT=8001
WS_PORT=8002
HOST=0.0.0.0
DATABASE_URL=file:./data.db
JWT_ACCESS_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_secret_here
```

### 前端配置

- **本机开发**: `web/vite.config.ts` (默认)
- **局域网开发**: `web/vite.config.local.ts`

---

## ❓ 常见问题

### 端口被占用

```powershell
# 查找占用端口的进程
netstat -ano | findstr ":8001"
netstat -ano | findstr ":5173"

# 结束进程（替换 PID 为实际的进程ID）
taskkill /F /PID <PID>

# 或者结束所有 node 进程
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 前端无法访问

确保：
1. 前端服务已启动（看到 "Local: http://localhost:5173/"）
2. 浏览器访问的是正确的地址
3. 防火墙没有阻止连接

### 后端无法启动

确保：
1. 后端已构建（`server/dist/index.js` 存在）
2. `server/.env` 文件存在且配置正确
3. 数据库文件有读写权限

---

## 📚 更多文档

- [部署指南](./DEPLOYMENT.md) - 生产环境部署
- [README](./README.md) - 项目完整介绍
