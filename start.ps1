$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs/node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js ist nicht verfügbar. Bitte das Skript im PyCharm-Terminal starten, in dem node verfügbar ist.' }
$existing = $null
try { $existing = Invoke-RestMethod -Uri 'http://127.0.0.1:25001/health' -TimeoutSec 2 } catch { }
if ($existing.app -eq 'Martin-Drexler-Portfolio') {
    Write-Host 'Das CV-Portfolio läuft bereits: http://localhost:25001'
    Start-Process 'http://localhost:25001'
    return
}
$serverProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + (Join-Path $appRoot 'server.mjs') + '"') -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $appRoot 'server.log') -RedirectStandardError (Join-Path $appRoot 'server-error.log') -PassThru
$serverProcess.Id | Set-Content -LiteralPath (Join-Path $appRoot 'server.pid')
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 200
    if ($serverProcess.HasExited) { throw ('Der Server konnte nicht starten. ' + (Get-Content -LiteralPath (Join-Path $appRoot 'server-error.log') -Raw)) }
    try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:25001/health' -TimeoutSec 1 } catch { continue }
    if ($health.app -eq 'Martin-Drexler-Portfolio') {
        Write-Host 'Das CV-Portfolio läuft: http://localhost:25001'
        Start-Process 'http://localhost:25001'
        return
    }
}
throw 'Der Serverstart konnte nicht bestätigt werden. Bitte server-error.log prüfen.'
