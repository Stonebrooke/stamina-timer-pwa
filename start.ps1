# start.ps1 - PWA Local Startup Script
# Auto-detects Node.js, probes available port, starts http-server, opens browser
# On error: prints message and exit 1; start.bat keeps the window open via pause

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ========== 1. Detect Node.js ==========
$nodePath = $null
$localNode = Join-Path $ScriptDir "nodejs\node.exe"
if (Test-Path $localNode) {
    $nodePath = $localNode
} else {
    $sysNode = Get-Command node -ErrorAction SilentlyContinue
    if ($sysNode) {
        $nodePath = $sysNode.Source
    }
}

if (-not $nodePath) {
    Write-Host ""
    Write-Host "[ERROR] Node.js not found" -ForegroundColor Red
    Write-Host "Please ensure nodejs/ directory exists, or Node.js is in system PATH" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Node.js: $nodePath" -ForegroundColor Green

# Add node directory to PATH so npx works
$nodeDir = Split-Path -Parent $nodePath
if ($env:PATH -notlike "*$nodeDir*") {
    $env:PATH = "$nodeDir;$env:PATH"
}

# ========== 2. Probe port (3000-3002, fast TcpClient) ==========
$port = 0
for ($p = 3000; $p -le 3002; $p++) {
    $occupied = $false
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect("127.0.0.1", $p)
        $client.Close()
        $occupied = $true
    } catch {
        $occupied = $false
    }
    if ($occupied) {
        Write-Host "[..] Port $p in use, trying next..." -ForegroundColor Yellow
    } else {
        $port = $p
        Write-Host "[OK] Port $port available" -ForegroundColor Green
        break
    }
}

if ($port -eq 0) {
    Write-Host ""
    Write-Host "[ERROR] Ports 3000-3002 all in use" -ForegroundColor Red
    exit 1
}

# ========== 3. Start http-server (background job) ==========
Write-Host "[..] Starting http-server..." -ForegroundColor Cyan
$serverJob = Start-Job -ScriptBlock {
    param($workDir, $p)
    Set-Location $workDir
    npx http-server . -p $p -c-1
} -ArgumentList $ScriptDir, $port

# ========== 4. Wait for server ready (up to 15s) ==========
$url = "http://127.0.0.1:$port/"
$ready = $false
$timeout = 15
$elapsed = 0

while (-not $ready -and $elapsed -lt $timeout) {
    Start-Sleep -Seconds 1
    $elapsed++

    if ($serverJob.State -eq 'Completed' -or $serverJob.State -eq 'Failed') {
        Write-Host ""
        Write-Host "[ERROR] http-server process exited unexpectedly" -ForegroundColor Red
        $jobOutput = Receive-Job $serverJob -ErrorAction SilentlyContinue
        if ($jobOutput) {
            Write-Host "  Output: $jobOutput" -ForegroundColor Gray
        }
        Remove-Job $serverJob -Force -ErrorAction SilentlyContinue
        exit 1
    }

    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        # Server not ready yet, keep waiting
    }
}

if (-not $ready) {
    Write-Host ""
    Write-Host "[ERROR] Server startup timeout (no response in 15s)" -ForegroundColor Red
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "[OK] Server started" -ForegroundColor Green

# ========== 5. Open browser ==========
Start-Process $url
Write-Host "[OK] Browser opened" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  URL: $url" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop server and exit" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ========== 6. Foreground wait, Ctrl+C cleanup ==========
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "[..] Stopping server..." -ForegroundColor Yellow
    if ($serverJob) {
        Stop-Job $serverJob -ErrorAction SilentlyContinue
        Remove-Job $serverJob -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[OK] Server stopped, bye!" -ForegroundColor Green
}
