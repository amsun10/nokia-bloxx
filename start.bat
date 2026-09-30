@echo off
chcp 65001 >nul
echo ========================================================
echo   经典诺基亚《摩天大楼》（Tower Bloxx）网页复刻版
echo ========================================================
echo.
echo 正在启动本地游戏服务器 (端口: 8080)...
start http://localhost:8080
python -m http.server 8080
pause
