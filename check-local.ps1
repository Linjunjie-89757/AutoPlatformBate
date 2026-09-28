[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Get-PortState([int]$Port) {
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($connection) {
    return [pscustomobject]@{ Port = $Port; Listening = $true; ProcessId = $connection.OwningProcess }
  }
  return [pscustomobject]@{ Port = $Port; Listening = $false; ProcessId = $null }
}

$mysqlContainer = docker inspect auto-platform-mysql 2>$null
$mysqlStatus = if ($mysqlContainer) { docker inspect --format '{{.State.Status}}' auto-platform-mysql 2>$null } else { 'missing' }
$mysqlHealth = if ($mysqlContainer) { docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' auto-platform-mysql 2>$null } else { 'missing' }
$ports = @(
  Get-PortState 3306
  Get-PortState 8080
  Get-PortState 4173
)

[pscustomobject]@{
  MySqlContainer = 'auto-platform-mysql'
  MySqlStatus = $mysqlStatus
  MySqlHealth = $mysqlHealth
  Ports = $ports
} | ConvertTo-Json -Depth 4

$failed = $false
if ($mysqlStatus -ne 'running') { $failed = $true }
if ($mysqlHealth -notin @('healthy', 'no-healthcheck')) { $failed = $true }
if (-not ($ports | Where-Object Port -eq 8080 | Where-Object Listening)) { $failed = $true }
if (-not ($ports | Where-Object Port -eq 4173 | Where-Object Listening)) { $failed = $true }
if ($failed) { exit 1 }
