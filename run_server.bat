@echo off
title Iniciando Proyecto Completo
echo =======================================
echo   Iniciando todos los servicios...
echo =======================================

REM --- Backend Flask ---
echo.
echo Iniciando backend Flask...
cd backend
start cmd /k "python main.py"
timeout /t 2 >nul

REM --- Emulador GPS ---
echo.
echo Iniciando emulador GPS...
start cmd /k "python emulator_gps.py"
timeout /t 2 >nul

REM --- Frontend React ---
echo.
echo 💻 Iniciando frontend React...
cd ..\frontend
start cmd /k "npm start"

echo.
echo =======================================
echo  Todos los servicios fueron iniciados correctamente.
echo  Cierra las ventanas para detenerlos.
echo =======================================
pause
