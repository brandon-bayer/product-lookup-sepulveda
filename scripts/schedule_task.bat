@echo off
REM Register the nightly sync as a Windows Scheduled Task.
REM Run this ONCE as Administrator on DC01.
REM Task runs every night at 11:00 PM.

set SCRIPT_DIR=%~dp0
set TASK_NAME=QFloors-Neon-Sync

schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "\"%SCRIPT_DIR%run_sync.bat\"" ^
  /sc DAILY ^
  /st 23:00 ^
  /ru SYSTEM ^
  /f

if %ERRORLEVEL% EQU 0 (
    echo Task "%TASK_NAME%" scheduled successfully - runs daily at 11:00 PM.
) else (
    echo Failed to create task. Make sure you are running as Administrator.
)

pause
