@echo off
chcp 65001 >nul
cd /d "%~dp0"
python tien404_dash.py --watch 60 %*
pause
