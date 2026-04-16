@echo off
cd /d E:\productManager
set PORT=3001
set WS_PORT=3002
set HOST=0.0.0.0
echo Starting backend server...
echo Environment: PORT=%PORT%, WS_PORT=%WS_PORT%, HOST=%HOST%
echo.
node server\dist\index.js
pause
