# 局域网部署配置说明

## 📋 概述

本文档说明如何将本项目部署在局域网内，供其他设备访问。**所有配置均不修改源码**，避免 git 更新时产生冲突。

---

## 🚀 方式一：开发模式（推荐用于开发调试）

### 前置条件

1. Node.js 20+ 已安装
2. 项目依赖已安装：`npm install`

### 启动步骤

```powershell
# 1. 以普通用户权限打开 PowerShell
# 2. 切换到项目目录
cd E:\productManager

# 3. 执行局域网启动脚本
.\start-lan-dev.ps1
```

### 访问地址

- **本机访问**: http://localhost:5173
- **局域网访问**: http://<你的 IP>:5173

### 停止服务

```powershell
Get-Process -Name 'node','npm' | Stop-Process
```

---

## 🚀 方式二：Docker 沙箱模式（推荐用于生产环境）

### 前置条件

1. Docker Desktop for Windows 已安装并运行
2. Node.js 20+ 已安装

### 启动步骤

```powershell
# 1. 以管理员身份打开 PowerShell
# 2. 切换到项目目录
cd E:\productManager

# 3. 执行部署脚本
.\deploy-windows.ps1
```

### 访问地址

部署完成后会显示：
- **本机访问**: http://localhost:5173
- **局域网访问**: http://<你的 IP>:5173

### 停止服务

```powershell
Get-Process -Name 'node' | Stop-Process
```

---

## 🔧 方式三：生产构建模式

### 步骤

```powershell
# 1. 构建前端
cd web
npm run build

# 2. 构建后端
cd ../server
npm run build

# 3. 配置环境变量
cd ..
Copy-Item server\.env.example server\.env

# 4. 编辑 server\.env，设置 HOST=0.0.0.0
notepad server\.env

# 5. 启动后端（前端静态文件由后端托管）
cd server
node dist/index.js
```

---

## 📱 局域网访问说明

### 获取本机 IP 地址

```powershell
# PowerShell 命令
ipconfig

# 查找 IPv4 地址，通常是 192.168.x.x 或 10.x.x.x
```

### 防火墙配置

如果其他设备无法访问，可能需要开放端口：

```powershell
# 以管理员身份运行 PowerShell

# 开放 3001 端口（后端 API）
netsh advfirewall firewall add rule name="PM-Backend-3001" dir=in action=allow protocol=TCP localport=3001

# 开放 3002 端口（WebSocket）
netsh advfirewall firewall add rule name="PM-WS-3002" dir=in action=allow protocol=TCP localport=3002

# 开放 5173 端口（前端 Vite）
netsh advfirewall firewall add rule name="PM-Frontend-5173" dir=in action=allow protocol=TCP localport=5173
```

### 关闭防火墙规则

```powershell
netsh advfirewall firewall delete rule name="PM-Backend-3001"
netsh advfirewall firewall delete rule name="PM-WS-3002"
netsh advfirewall firewall delete rule name="PM-Frontend-5173"
```

---

## 🔄 代码更新流程

### 开发模式

```powershell
# 1. 停止当前服务
Get-Process -Name 'node','npm' | Stop-Process

# 2. 拉取新代码
git pull

# 3. 重新启动
.\start-lan-dev.ps1
```

### Docker 模式

```powershell
# 1. 停止服务
Get-Process -Name 'node' | Stop-Process

# 2. 拉取新代码
git pull

# 3. 重新部署
.\deploy-windows.ps1
```

---

## ⚠️ 注意事项

### 1. 代码更新冲突

本项目配置遵循**不修改源码**原则：
- ✅ `start-lan-dev.ps1` - 本地启动脚本（git 忽略）
- ✅ `server/.env` - 环境变量文件（git 忽略）
- ❌ 不要修改 `vite.config.ts` - 会产生 git 冲突

### 2. 安全建议

局域网部署时请注意：
- 仅在可信网络环境下开放
- 建议设置强密码
- 生产环境建议使用 HTTPS
- 定期更新 JWT 密钥

### 3. 性能优化

- 生产环境建议使用 Nginx 反向代理
- 开启 Gzip 压缩
- 静态资源使用 CDN

---

## 📊 端口说明

| 端口 | 用途 | 是否开放 |
|------|------|----------|
| 5173 | 前端 Vite 开发服务器 | 局域网需开放 |
| 3001 | 后端 HTTP API | 局域网需开放 |
| 3002 | 后端 WebSocket | 局域网需开放 |

---

## 🛠️ 故障排查

### 问题 1: 其他设备无法访问

**检查清单**:
- [ ] 确认本机 IP 地址正确
- [ ] 确认防火墙已开放端口
- [ ] 确认服务正在运行
- [ ] 确认设备在同一局域网

### 问题 2: 前端可以访问但 API 调用失败

**原因**: 前端代理配置问题

**解决**: 
- 开发模式：前端会自动代理到 localhost:3001
- 生产模式：需要配置正确的 API 地址

### 问题 3: Docker 部署失败

**检查**:
```powershell
# 检查 Docker 是否运行
docker info

# 检查端口是否被占用
netstat -ano | findstr :3001
netstat -ano | findstr :3002
netstat -ano | findstr :5173
```

---

## 📞 获取帮助

如有问题，请检查：
1. `logs/server.log` - 后端日志
2. 浏览器控制台 - 前端错误
3. Docker 日志 - 容器问题
