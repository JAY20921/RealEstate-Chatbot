@echo off
echo ========================================
echo RealEstate Chatbot - Setup Script
echo ========================================
echo.

echo [1/5] Generating sample dataset...
cd backend
python generate_sample_data.py
if errorlevel 1 (
    echo Warning: Sample data generation failed. Continuing...
)

echo.
echo [2/5] Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo Error: Failed to install Python dependencies
    pause
    exit /b 1
)

echo.
echo [3/5] Running Django migrations...
python manage.py migrate --noinput
if errorlevel 1 (
    echo Error: Failed to run migrations
    pause
    exit /b 1
)

cd ..

echo.
echo [4/5] Installing Node.js dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo Error: Failed to install Node.js dependencies
    pause
    exit /b 1
)

cd ..

echo.
echo [5/5] Setup complete!
echo.
echo ========================================
echo Next steps:
echo ========================================
echo 1. Start backend:  cd backend  ^&  python manage.py runserver
echo 2. Start frontend: cd frontend ^&  npm start
echo.
echo Or use: start.bat to run both servers
echo ========================================
pause
