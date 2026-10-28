$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'start.cjs')
exit $LASTEXITCODE
