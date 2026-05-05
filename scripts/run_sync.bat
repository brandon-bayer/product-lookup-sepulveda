@echo off
REM Wrapper for the nightly QFloors -> Neon sync.
REM Task Scheduler calls this file directly.

py -3.11-32 "C:\QFloors_Sync\2_sync_qfloors.py"
