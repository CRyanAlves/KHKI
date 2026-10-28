$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$configuration = @{}
foreach ($line in [IO.File]::ReadAllLines((Join-Path $projectRoot '.env'))) {
    if ($line -match '^([A-Z_][A-Z0-9_]*)=(.*)$') { $configuration[$matches[1]] = $matches[2] }
}
if ($configuration['DATABASE_URL'] -notmatch '^jdbc:postgresql://(?:localhost|127\.0\.0\.1):[0-9]+/khki$') { throw 'Configure DATABASE_URL para o PostgreSQL local do projeto antes de executar.' }
$testDatabase = 'khki_test_' + [Guid]::NewGuid().ToString('N')
& docker compose exec -T database createdb -U khki $testDatabase
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o banco isolado de testes.' }
$result = 1
try {
    $env:TEST_DATABASE_URL = $configuration['DATABASE_URL'] -replace '/khki$', ('/' + $testDatabase)
    $env:TEST_DATABASE_USER = $configuration['DATABASE_USER']
    $env:TEST_DATABASE_PASSWORD = $configuration['DATABASE_PASSWORD']
    & mvn.cmd test -q -f backend/pom.xml
    $result = $LASTEXITCODE
} finally {
    if ($testDatabase -match '^khki_test_[a-f0-9]{32}$') { & docker compose exec -T database dropdb -U khki $testDatabase }
    Remove-Item Env:TEST_DATABASE_URL, Env:TEST_DATABASE_USER, Env:TEST_DATABASE_PASSWORD -ErrorAction SilentlyContinue
}
exit $result
