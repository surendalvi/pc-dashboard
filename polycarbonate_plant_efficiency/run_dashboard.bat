@echo off
echo ====================================================================
echo Starting Saudi Kayan Polycarbonate Digital Twin Dashboard Server...
echo ====================================================================
echo.

:: Check if port 8085 is in use
netstat -ano | findstr :8085 > nul
if %errorlevel% equ 0 (
    echo Server is already running on port 8085.
) else (
    echo Launching Python HTTP server on port 8085...
    start /b python -m http.server 8085
    timeout /t 2 /nobreak > nul
)

echo Opening default browser...
start http://localhost:8085/
echo.
echo Dashboard successfully deployed.
echo Keep this window open if the server was newly started.
echo Close this window to exit this launcher prompt.
echo ====================================================================
pause
