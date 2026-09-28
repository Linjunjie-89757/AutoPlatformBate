[CmdletBinding()]
param(
  [switch]$BuildBackend,
  [int]$WaitSeconds = 45
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$serverRoot = Join-Path $repoRoot 'server'
$jarPath = Join-Path $serverRoot 'target\auto-platform-0.0.1-SNAPSHOT.jar'
$frontendOut = Join-Path $repoRoot 'frontend-local.out.log'
$frontendErr = Join-Path $repoRoot 'frontend-local.err.log'
$backendOut = Join-Path $serverRoot 'server-local.out.log'
$backendErr = Join-Path $serverRoot 'server-local.err.log'

function Test-LocalPort([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-LocalPort([int]$Port, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    if (Test-LocalPort $Port) { return }
    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)
  throw "等待端口 $Port 超时。请检查对应日志。"
}

Write-Host '[local] 检查 Docker MySQL...'
$mysqlExists = docker inspect auto-platform-mysql 2>$null
if (-not $mysqlExists) {
  throw '未找到 Docker 容器 auto-platform-mysql，请先创建项目 MySQL 容器。'
}
$mysqlState = docker inspect --format '{{.State.Status}}' auto-platform-mysql 2>$null
if ($mysqlState -ne 'running') {
  Write-Host '[local] MySQL 容器未运行，尝试启动 auto-platform-mysql...'
  docker start auto-platform-mysql | Out-Null
}
$mysqlHealth = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' auto-platform-mysql 2>$null
Write-Host "[local] MySQL: $mysqlHealth"

$java = $null
if ($env:JAVA_HOME) {
  $candidate = Join-Path $env:JAVA_HOME 'bin\java.exe'
  if (Test-Path $candidate) { $java = $candidate }
}
if (-not $java -and (Test-Path 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\bin\java.exe')) {
  $java = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\bin\java.exe'
}
if (-not $java) {
  $javaCommand = Get-Command java.exe -ErrorAction SilentlyContinue
  if ($javaCommand) { $java = $javaCommand.Source }
}
if (-not $java) { throw '未找到 Java 21。' }

if (-not (Test-LocalPort 8080)) {
  if ($BuildBackend -or -not (Test-Path $jarPath)) {
    Write-Host '[local] 构建后端 JAR...'
    Push-Location $serverRoot
    try { & .\mvnw.cmd -DskipTests package } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw '后端构建失败。' }
  }
  if (-not (Test-Path $jarPath)) { throw "后端 JAR 不存在: $jarPath" }
  Write-Host '[local] 启动后端（local-mysql，3306）...'
  $env:SPRING_PROFILES_ACTIVE = 'local-mysql'
  $env:DB_URL = 'jdbc:mysql://127.0.0.1:3306/auto_platform?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai'
  $env:DB_USERNAME = 'auto_user'
  $env:DB_PASSWORD = 'auto123456'
  Start-Process -FilePath $java -ArgumentList @('-jar', $jarPath) -WorkingDirectory $serverRoot -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr | Out-Null
} else {
  Write-Host '[local] 后端 8080 已在监听，保留现有进程。'
}

if (-not (Test-LocalPort 4173)) {
  Write-Host '[local] 启动前端（4173）...'
  $env:VITE_API_BASE_URL = 'http://localhost:8080/api'
  Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev', '--', '--host', 'localhost', '--port', '4173') -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr | Out-Null
} else {
  Write-Host '[local] 前端 4173 已在监听，保留现有进程。'
}

Wait-LocalPort 8080 $WaitSeconds
Wait-LocalPort 4173 $WaitSeconds
Write-Host '[local] 前后端端口均已就绪。'
& (Join-Path $repoRoot 'check-local.ps1')
