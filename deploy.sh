#!/bin/bash

# 产品管理系统 - Linux/Mac 部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh

set -e

echo "========================================"
echo "  🚀 产品管理系统部署脚本"
echo "========================================"
echo ""

# 1. 检查 Docker
echo "📦 检查 Docker..."
if ! command -v docker &> /dev/null; then
  echo "❌ 未找到 Docker,请先安装 Docker"
  echo "   下载地址: https://docs.docker.com/get-docker/"
  exit 1
fi

echo "✅ Docker 已安装: $(docker --version)"

# 检查 Docker 是否运行
if ! docker info &> /dev/null; then
  echo "❌ Docker 未运行,请启动 Docker 服务"
  exit 1
fi
echo "✅ Docker 正在运行"
echo ""

# 2. 构建沙箱镜像
echo "🔨 构建沙箱镜像..."
cd server/docker
docker build -t pm-sandbox:latest -f Dockerfile.sandbox .
if [ $? -ne 0 ]; then
  echo "❌ 沙箱镜像构建失败"
  exit 1
fi
echo "✅ 沙箱镜像构建完成"
cd ../..
echo ""

# 3. 安装依赖
echo "📥 安装服务器依赖..."
cd server
npm install
if [ $? -ne 0 ]; then
  echo "❌ 服务器依赖安装失败"
  exit 1
fi
echo "✅ 服务器依赖安装完成"

echo "📥 安装前端依赖..."
cd ../web
npm install
if [ $? -ne 0 ]; then
  echo "❌ 前端依赖安装失败"
  exit 1
fi
echo "✅ 前端依赖安装完成"
cd ../server
echo ""

# 4. 初始化数据库
echo "💾 初始化数据库..."
npx prisma generate
npx prisma db push
if [ $? -ne 0 ]; then
  echo "❌ 数据库初始化失败"
  exit 1
fi
echo "✅ 数据库初始化完成"
echo ""

# 5. 配置环境变量
if [ ! -f ".env" ]; then
  echo "⚙️  创建环境变量配置..."
  cp .env.production .env
  
  # 生成随机 JWT 密钥
  JWT_ACCESS_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  
  sed -i "s/CHANGE_ME_TO_RANDOM_STRING_.*$/$JWT_ACCESS_SECRET/g" .env
  
  echo "✅ 环境变量配置已创建 (server/.env)"
  echo "   请检查并修改 JWT 密钥"
else
  echo "✅ 环境变量配置已存在 (server/.env)"
fi
echo ""

# 6. 构建项目
echo "🏗️  构建服务器..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ 服务器构建失败"
  exit 1
fi
echo "✅ 服务器构建完成"
echo ""

# 7. 创建日志目录
mkdir -p ../logs

# 8. 启动服务
echo "🚀 启动服务器..."
nohup node dist/index.js > ../logs/server.log 2>&1 &
SERVER_PID=$!
echo "✅ 服务器已启动 (PID: $SERVER_PID)"
echo ""

# 9. 获取本机 IP
IP_ADDRESS=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")

# 完成
echo "========================================"
echo "  ✅ 部署完成!"
echo "========================================"
echo ""
echo "📍 访问地址:"
echo "   本机访问: http://localhost:5173"
echo "   局域网访问: http://$IP_ADDRESS:5173"
echo ""
echo "📝 其他信息:"
echo "   后端 API: http://$IP_ADDRESS:3001"
echo "   WebSocket: ws://$IP_ADDRESS:3002"
echo "   日志文件: ../logs/server.log"
echo ""
echo "🛑 停止服务:"
echo "   kill $SERVER_PID"
echo "   或者: pkill -f 'node dist/index.js'"
echo ""
echo "提示: 首次使用请在浏览器访问后注册管理员账号"
echo ""
