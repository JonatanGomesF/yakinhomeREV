@echo off
setlocal

set "APP_URL=https://yakinhomeitu1.vercel.app/admin/pedidos"
set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME_EXE%" (
  set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
)

if not exist "%CHROME_EXE%" (
  echo Google Chrome nao encontrado.
  echo Abra o Chrome manualmente com --kiosk-printing.
  pause
  exit /b 1
)

start "" "%CHROME_EXE%" --kiosk-printing --user-data-dir="%TEMP%\yakinhome-kiosk-printing" "%APP_URL%"
