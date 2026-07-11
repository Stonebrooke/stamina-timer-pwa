# start.ps1 - PWA Local Startup Script
# Auto-detects Node.js, probes available port, starts zero-dependency server, opens browser
# Uses node server.mjs directly (no npx, no http-server dependency, no network needed)

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

# ========== 2. Check server.mjs exists ==========
$serverScript = Join-Path $ScriptDir "server.mjs"
if (-not (Test-Path $serverScript)) {
    Write-Host ""
    Write-Host "[ERROR] server.mjs not found" -ForegroundColor Red
    exit 1
}

# ========== 3. Probe port (3000-3002, fast TcpClient) ==========
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

# ========== 4. Start server (direct node process, no npx) ==========
Write-Host "[..] Starting server..." -ForegroundColor Cyan
$env:PORT = $port
$serverProc = Start-Process -FilePath $nodePath -ArgumentList $serverScript -WorkingDirectory $ScriptDir -PassThru -NoNewWindow

# ========== 5. Wait for server ready (up to 5s, usually <1s) ==========
$url = "http://127.0.0.1:$port/"
$ready = $false
$timeout = 5
$elapsed = 0

while (-not $ready -and $elapsed -lt $timeout) {
    Start-Sleep -Milliseconds 200
    $elapsed += 0.2

    if ($serverProc.HasExited) {
        Write-Host ""
        Write-Host "[ERROR] Server process exited unexpectedly (exit code: $($serverProc.ExitCode))" -ForegroundColor Red
        exit 1
    }

    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
        if ($response.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        # Server not ready yet, keep waiting
    }
}

if (-not $ready) {
    Write-Host ""
    Write-Host "[ERROR] Server startup timeout (no response in ${timeout}s)" -ForegroundColor Red
    if (-not $serverProc.HasExited) { Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue }
    exit 1
}

Write-Host "[OK] Server started" -ForegroundColor Green

# ========== 6. Open browser ==========
Start-Process $url
Write-Host "[OK] Browser opened" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  URL: $url" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop server and exit" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ========== 7. Foreground wait, Ctrl+C cleanup ==========
try {
    while (-not $serverProc.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "[..] Stopping server..." -ForegroundColor Yellow
    if ($serverProc -and -not $serverProc.HasExited) {
        Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[OK] Server stopped, bye!" -ForegroundColor Green
}
