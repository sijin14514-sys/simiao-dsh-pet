@echo off
chcp 65001 >nul
title 肆喵 · 一键安装
echo.
echo   正在启动安装程序，请稍候…
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0安装肆喵.ps1"
