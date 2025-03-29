@echo off
echo ====================================================
echo       AccountantAI - One-Click Installer
echo ====================================================
echo.

:: Set current directory to the location of this batch file
cd /d "%~dp0"

:: -----------------------------------------------
:: Check for required dependencies: Node.js and Python
:: -----------------------------------------------

echo Checking for Node.js...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo ERROR: Node.js is not installed or not in your PATH.
  echo Please install Node.js 14+ from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo Checking for Python...
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo ERROR: Python is not installed or not in your PATH.
  echo Please install Python 3.9+ from https://python.org/
  echo.
  pause
  exit /b 1
)

:: -----------------------------------------------
:: Verify project directory (package.json must exist)
:: -----------------------------------------------

if not exist "package.json" (
  echo ERROR: package.json not found.
  echo Please make sure this batch file is in the AccountantAI application directory.
  echo.
  pause
  exit /b 1
)

:: -----------------------------------------------
:: Install Node.js dependencies if not already installed
:: -----------------------------------------------

if not exist "node_modules" (
  echo Node modules not found. Installing Node.js dependencies...
  call npm install
  if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install Node.js dependencies.
    echo.
    pause
    exit /b 1
  )
)

:: -----------------------------------------------
:: Run directory initialization script (if available)
:: -----------------------------------------------

echo Setting up directories...
if exist "init-directories.js" (
  node init-directories.js
) else (
  echo WARNING: init-directories.js not found. Skipping directory initialization.
)

:: -----------------------------------------------
:: Check and install Python dependencies if needed
:: -----------------------------------------------

echo Checking Python dependencies...
python -c "import anthropic, dotenv, tqdm, requests" >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo Installing Python dependencies...
  python -m pip install anthropic==0.16.0 python-dotenv==1.0.0 tqdm==4.66.1 requests==2.31.0
  python -m pip install pdf2image==1.17.0 pillow==9.5.0
)

:: -----------------------------------------------
:: Build the Electron app (create installer)
:: -----------------------------------------------

echo Building AccountantAI installer...
call npm run dist
if %ERRORLEVEL% neq 0 (
  echo ERROR: Failed to build the installer.
  echo.
  pause
  exit /b 1
)

:: -----------------------------------------------
:: Run the installer from the dist folder
:: -----------------------------------------------

echo Launching the installer...
cd dist
:: Adjust the installer filename if necessary (here using a sample name based on productName and version)
start "" "AccountantAI Uploader-Setup-1.0.0.exe"
if %ERRORLEVEL% neq 0 (
  echo ERROR: Unable to launch the installer.
  echo.
  pause
  exit /b 1
)

echo.
echo AccountantAI installer is running.
echo The installer will create a desktop shortcut and launch the app after installation.
echo You can close this window once installation begins.
timeout /t 5 >nul

