@echo off
REM Register the nightly sync with Windows Task Scheduler.
REM Run this ONCE as Administrator on your workstation.
REM Task fires every night at 11:00 PM.

schtasks /create ^
  /tn "QFloors Neon Sync" ^
  /tr "py -3.11-32 C:\QFloors_Sync\2_sync_qfloors.py" ^
  /sc DAILY ^
  /st 23:00 ^
  /ru SYSTEM ^
  /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Task scheduled successfully. Runs nightly at 11:00 PM.
    echo Check C:\QFloors_Sync\sync_log.txt the next morning to verify.
) else (
    echo.
    echo FAILED. Make sure you right-clicked and chose "Run as administrator".
)

pause
