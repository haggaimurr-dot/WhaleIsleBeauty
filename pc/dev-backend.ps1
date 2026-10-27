$ErrorActionPreference = 'Stop'
# 本地联调专用；数据不落盘，通知只写日志，不发给微信用户。
$env:STORE = 'memory'
$env:PAY_MODE = 'fake'
$env:SUBSCRIBE_MSG = 'log'
$env:PORT = '8080'
Push-Location (Join-Path $PSScriptRoot '../server')
try { go run .; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
finally { Pop-Location }
