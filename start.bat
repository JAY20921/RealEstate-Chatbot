@echo off
echo ========================================
echo Starting RealEstate Chatbot
echo ========================================
echo.

echo Starting Backend Server...
start "Backend - Django" cmd /k "cd backend && python manage.py runserver"

timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
start "Frontend - React" cmd /k "cd frontend && npm start"

echo.
echo ========================================
echo Both servers are starting...
echo ========================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to stop servers and exit...
pause > nul

taskkill /FI "WindowTitle eq Backend - Django*" /T /F
taskkill /FI "WindowTitle eq Frontend - React*" /T /F
