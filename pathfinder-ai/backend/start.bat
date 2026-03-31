@echo off
echo ============================================================
echo  Pathfinder AI — Starting Backend (FastAPI + LangChain)
echo ============================================================

REM Change to project root (D:\browser_agent\pathfinder-ai\)
cd /d "%~dp0.."

echo.
echo [Backend] Starting FastAPI on http://localhost:8000 ...
echo [Docs]    http://localhost:8000/docs
echo.

python -m backend.main

pause
