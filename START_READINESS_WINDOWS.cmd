@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo TIEN404: Chua cai Node.js 22. Hay cai Node.js 22 tu website chinh thuc.
  echo Script KHONG chay backup, KHONG doi du lieu.
) else (
  node "%~dp0qa\store-authority-v18619\guided-readiness.cjs"
)
echo.
echo Chi gui ma trang thai GUIDED_READINESS_ONLY_PASS hoac GUIDED_READINESS_BLOCKED.
pause
