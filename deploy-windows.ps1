# 产品管理系统 - Windows 部署脚本
# 以管理员身份运行 PowerShell 执行此脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🚀 产品管理系统部署脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ 请以管理员身份运行此脚本" -ForegroundColor Red
    Write-Host "   右键 PowerShell → 以管理员身份运行 → 再执行此脚本" -ForegroundColor Red
    pause
    exit 1
}

# 1. 检查 Docker
Write-Host "📦 检查 Docker..." -ForegroundColor Yellow
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 Docker,请先安装 Docker Desktop for Windows" -ForegroundColor Red
    Write-Host "   下载地址: https://www.docker.com/products/docker-desktop" -ForegroundColor Red
    pause
    exit 1
}

$dockerVersion = docker --version
Write-Host "✅ Docker 已安装: $dockerVersion" -ForegroundColor Green

# 检查 Docker 是否运行
$dockerRunning = docker info 2>&1
if ($dockerRunning -like "*error*") {
    Write-Host "❌ Docker 未运行,请启动 Docker Desktop" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✅ Docker 正在运行" -ForegroundColor Green
Write-Host ""

# 2. 构建沙箱镜像
Write-Host "🔨 构建沙箱镜像..." -ForegroundColor Yellow
Set-Location "server\docker"
docker build -t pm-sandbox:latest -f Dockerfile.sandbox .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 沙箱镜像构建失败" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✅ 沙箱镜像构建完成" -ForegroundColor Green
Set-Location "..\.."
Write-Host ""

# 3. 安装依赖
Write-Host "📥 安装服务器依赖..." -ForegroundColor Yellow
Set-Location "server"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 服务器依赖安装失败" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✅ 服务器依赖安装完成" -ForegroundColor Green

Write-Host "📥 安装前端依赖..." -ForegroundColor Yellow
Set-Location "..\web"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端依赖安装失败" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✅ 前端依赖安装完成" -ForegroundColor Green
Set-Location "..\server"
Write-Host ""

# 4. 初始化数据库
Write-Host "💾 初始化数据库..." -ForegroundColor Yellow
npx prisma generate
npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 数据库初始化失败" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✅ 数据库初始化完成" -ForegroundColor Green
Write-Host ""

# 5. 配置环境变量
if (-not (Test-Path ".env")) {
    Write-Host "⚙️  创建环境变量配置..." -ForegroundColor Yellow
    Copy-Item ".env.production" ".env"
    
    # 生成随机 JWT 密钥
    $jwtAccessSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    $jwtRefreshSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    
    (Get-Content ".env") -replace "CHANGE_ME_TO_RANDOM_STRING_.*", $jwtAccessSecret | Set-Content ".env"
    
    Write-Host "✅ 环境变量配置已创建 (server/.env)" -ForegroundColor Green
    Write-Host "   请检查并修改 JWT 密钥为更安全的随机字符串" -ForegroundColor Yellow
} else {
    Write-Host "✅ 环境变量配置已存在 (server/.env)" -ForegroundColor Green
}
Write-Host ""

# 6. 构建项目
Write-Host "🏗️  构建服务器..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 服务器构建失败" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✅ 服务器构建完成" -ForegroundColor Green
Write-Host ""

# 7. 创建日志目录
if (-not (Test-Path "..\logs")) {
    New-Item -ItemType Directory -Path "..\logs" | Out-Null
}

# 8. 启动服务
Write-Host "🚀 启动服务器..." -ForegroundColor Yellow
Start-Process -FilePath "node" -ArgumentList "dist\index.js" -WindowStyle Hidden -WorkingDirectory (Get-Location).Path
Write-Host "✅ 服务器已启动" -ForegroundColor Green
Write-Host ""

# 9. 获取本机 IP
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" } | Select-Object -First 1).IPAddress

if (-not $ipAddress) {
    $ipAddress = "localhost"
}

# 完成
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ 部署完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 访问地址:" -ForegroundColor Yellow
Write-Host "   本机访问: http://localhost:5173" -ForegroundColor White
Write-Host "   局域网访问: http://$ipAddress`:5173" -ForegroundColor White
Write-Host ""
Write-Host "📝 其他信息:" -ForegroundColor Yellow
Write-Host "   后端 API: http://$ipAddress`:3001" -ForegroundColor White
Write-Host "   WebSocket: ws://$ipAddress`:3002" -ForegroundColor White
Write-Host "   日志文件: ..\logs\server.log" -ForegroundColor White
Write-Host ""
Write-Host "🛑 停止服务:" -ForegroundColor Yellow
Write-Host "   Get-Process -Name 'node' | Stop-Process" -ForegroundColor White
Write-Host ""
Write-Host "提示: 首次使用请在浏览器访问后注册管理员账号" -ForegroundColor Cyan
Write-Host ""

pause
