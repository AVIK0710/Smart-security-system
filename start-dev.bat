@echo off
echo Starting backend on port 8001...
start "Backend" cmd /k "cd /d %~dp0 && python -m uvicorn app.main:app --reload --port 8001"
timeout /t 2 /nobreak >nul
echo Starting frontend on http://localhost:5173 ...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
echo.
echo Open http://localhost:5173 in your browser.
echo Backend API: http://127.0.0.1:8001
