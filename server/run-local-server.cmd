@echo off
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "JAVA_EXE="
if exist "%JAVA_HOME%\bin\java.exe" set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
if not defined JAVA_EXE if exist "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\bin\java.exe" set "JAVA_EXE=C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\bin\java.exe"
if not defined JAVA_EXE set "JAVA_EXE=java"

set "APP_JAR=%SCRIPT_DIR%target\auto-platform-0.0.1-SNAPSHOT.jar"

if not defined SPRING_PROFILES_ACTIVE set "SPRING_PROFILES_ACTIVE=local-mysql"
if not defined DB_URL set "DB_URL=jdbc:mysql://127.0.0.1:3306/auto_platform?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai"
if not defined DB_USERNAME set "DB_USERNAME=auto_user"
if not defined DB_PASSWORD set "DB_PASSWORD=auto123456"
if not defined DB_DRIVER set "DB_DRIVER=com.mysql.cj.jdbc.Driver"
set "LAN_IP="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike 'vEthernet*' -and $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do if not defined LAN_IP set "LAN_IP=%%A"
if not defined LAN_IP for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /R /C:"IPv4"') do if not defined LAN_IP for /f "tokens=* delims= " %%A in ("%%I") do set "LAN_IP=%%A"
if not defined APP_PUBLIC_FRONTEND_BASE_URL (
  if defined LAN_IP (
    set "APP_PUBLIC_FRONTEND_BASE_URL=http://!LAN_IP!:4173"
  ) else (
    set "APP_PUBLIC_FRONTEND_BASE_URL=http://%COMPUTERNAME%:4173"
  )
)
if not defined APP_PUBLIC_BACKEND_BASE_URL (
  if defined LAN_IP (
    set "APP_PUBLIC_BACKEND_BASE_URL=http://!LAN_IP!:8080"
  ) else (
    set "APP_PUBLIC_BACKEND_BASE_URL=http://%COMPUTERNAME%:8080"
  )
)
if not defined AUTOPLATFORM_PUBLIC_BASE_URL set "AUTOPLATFORM_PUBLIC_BASE_URL=%APP_PUBLIC_BACKEND_BASE_URL%"

echo Building backend jar...
call "%SCRIPT_DIR%mvnw.cmd" -DskipTests package
if errorlevel 1 (
  echo.
  echo [ERROR] Backend build failed.
  pause
  exit /b 1
)

if not exist "%APP_JAR%" (
  echo [ERROR] Missing server jar after build: "%APP_JAR%"
  pause
  exit /b 1
)

if exist "%SCRIPT_DIR%data\auto-platform.lock.db" del /f /q "%SCRIPT_DIR%data\auto-platform.lock.db" >nul 2>nul

echo Starting backend from "%APP_JAR%"
"%JAVA_EXE%" -jar "%APP_JAR%"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Backend exited with code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
