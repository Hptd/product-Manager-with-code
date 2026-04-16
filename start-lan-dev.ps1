# 局域网开发启动脚本（不修改源码）
# 使用方式：.\start-lan-dev.ps1

$ErrorActionPreference = "Continue"
$originalLocation = Get-Location

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🚀 局域网开发模式启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取本机局域网 IP（更可靠的方式）
$ipAddress = $null
try {
    $ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.InterfaceAlias -notlike "*Loopback*" -and 
        $_.AddressFamily -ne 23 -and
        ($_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*")
    } | Select-Object -First 1).IPAddress
} catch {}

if (-not $ipAddress) {
    $ipconfig = ipconfig | Out-String
    $match = [regex]::Match($ipconfig, 'IPv4 地址 [^:]*:\s*(\d+\.\d+\.\d+\.\d+)')
    if ($match.Success) {
        $ipAddress = $match.Groups[1].Value
    }
}

if (-not $ipAddress) {
    $ipAddress = (ipconfig | Select-String "IPv4" | Select-Object -First 1).Line -replace '.*:\s*', ''
}

if (-not $ipAddress -or $ipAddress -eq "") {
    $ipAddress = "localhost"
}

Write-Host "📍 本机局域网 IP: $ipAddress" -ForegroundColor Green
Write-Host ""

# 检查后端是否已构建
if (-not (Test-Path "server\dist\index.js")) {
    Write-Host "⚠️  后端未构建，正在构建..." -ForegroundColor Yellow
    Set-Location server
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 后端构建失败" -ForegroundColor Red
        Set-Location $originalLocation
        pause
        exit 1
    }
    Set-Location $originalLocation
    Write-Host "✅ 后端构建完成" -ForegroundColor Green
}

# 停止旧的进程（只停止本项目的进程）
Write-Host "🧹 清理旧进程..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        $path = $_.Path
        # 只停止在项目目录下的 node 进程
        if ($path -like "*productManager*") {
            Write-Host "   停止进程 PID: $($_.Id)" -ForegroundColor Gray
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}
Start-Sleep -Seconds 1

# 1. 启动后端（从 server 目录启动以正确加载 .env）
Write-Host "📡 启动后端服务..." -ForegroundColor Yellow
Set-Location server
$backend = Start-Process -FilePath "node" -ArgumentList "dist/index.js" -PassThru -WorkingDirectory (Get-Location).Path
Set-Location $originalLocation
Start-Sleep -Seconds 3
Write-Host "✅ 后端已启动 (端口：8001, 8002)" -ForegroundColor Green

# 2. 启动前端
Write-Host "🌐 启动前端服务..." -ForegroundColor Yellow
$frontend = Start-Process -FilePath "npm" -ArgumentList "run", "dev:web", "--", "--config", "vite.config.local.ts", "--host", "0.0.0.0" -PassThru -WorkingDirectory (Get-Location).Path
Start-Sleep -Seconds 5
Write-Host "✅ 前端已启动 (端口：5173)" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ 启动完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 访问地址:" -ForegroundColor Yellow
Write-Host "   本机访问：http://localhost:5173" -ForegroundColor White
Write-Host "   局域网访问：http://$ipAddress`:5173" -ForegroundColor White
Write-Host ""
Write-Host "📝 其他信息:" -ForegroundColor Yellow
Write-Host "   后端 API: http://$ipAddress`:8001" -ForegroundColor White
Write-Host "   WebSocket: ws://$ipAddress`:8002" -ForegroundColor White
Write-Host ""
Write-Host "🛑 停止服务:" -ForegroundColor Yellow
Write-Host "   关闭此窗口或按 Ctrl+C" -ForegroundColor White
Write-Host "   或执行：Get-Process -Name 'node' | Stop-Process" -ForegroundColor White
Write-Host ""
Write-Host "提示：保持此窗口打开以维持服务运行" -ForegroundColor Cyan
Write-Host ""

# 保持窗口打开
Write-Host "服务正在运行中... (关闭窗口停止服务)" -ForegroundColor Green
while ($true) {
    Start-Sleep -Seconds 5
    if ($backend.HasExited) {
        Write-Host "⚠️  后端服务已停止" -ForegroundColor Red
        break
    }
}
