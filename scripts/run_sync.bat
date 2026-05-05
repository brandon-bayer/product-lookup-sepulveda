@echo off
REM Nightly QFloors → Neon sync
REM Run this file manually or let Task Scheduler call it every night.
REM Requires 32-bit Python 3.11 and the pyodbc + psycopg2 packages.

set SCRIPT_DIR=%~dp0
set LOG_FILE=%SCRIPT_DIR%sync_log.txt

echo [%DATE% %TIME%] Starting sync >> "%LOG_FILE%"

py -3.11-32 "%SCRIPT_DIR%sync_qfloors.py" >> "%LOG_FILE%" 2>&1

if %ERRORLEVEL% EQU 0 (
    echo [%DATE% %TIME%] Sync finished OK >> "%LOG_FILE%"
) else (
    echo [%DATE% %TIME%] Sync FAILED with error %ERRORLEVEL% >> "%LOG_FILE%"
)
