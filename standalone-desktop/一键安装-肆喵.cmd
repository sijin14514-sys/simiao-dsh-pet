@echo off
rem Simiao desktop pet - one click installer (Windows)
rem ASCII-only on purpose: mid-file chcp plus non-ASCII bytes inside a batch
rem file is a known source of cmd parsing bugs. All Chinese text lives in install.ps1.
chcp 65001 >nul
title Simiao Pet Installer
echo.
echo   ==========================================
echo    Simiao Pet - One Click Installer
echo   ==========================================
echo.
echo   Starting, please wait (do not close this window)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
