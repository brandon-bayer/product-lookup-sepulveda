@echo off
REM Wrapper — runs the sync script directly from the PC.
REM Use this for manual test runs on your workstation.
REM The scheduled task on DC01 runs the .exe directly, not this file.

py -3.11-32 "C:\QFloors_Sync\2_sync_qfloors.py"
