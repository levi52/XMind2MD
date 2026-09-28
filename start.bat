@echo off
setlocal enableextensions
REM ============================================================
REM  XMind2MD - start local web converter (Flask)
REM  Usage: double-click this file.
REM  It starts the local service and opens it in your browser.
REM ============================================================

cd /d "%~dp0"

set "PYEXE=%~dp0.venv\Scripts\python.exe"

if not exist "%PYEXE%" goto try_sys
goto run

:try_sys
echo [i] Project virtualenv (.venv) not found, falling back to python on PATH.
echo [i] If startup fails, run:  pip install -r requirements.txt
echo.
where python >nul 2>&1
if errorlevel 1 goto no_python
set "PYEXE=python"

:run
echo ============================================
echo   XMind2MD  local service
echo ============================================
echo.
echo Starting... your browser will open shortly.
echo Runs on 127.0.0.1 (auto free port from 5000). Close this window to stop.
echo.
"%PYEXE%" app.py
echo.
echo Service stopped.
pause
exit /b 0

:no_python
echo [ERROR] Python was not found on PATH.
echo Please install Python 3, or create the virtualenv:
echo     py -3 -m venv .venv
echo     .venv\Scripts\pip install -r requirements.txt
echo.
pause
exit /b 1
