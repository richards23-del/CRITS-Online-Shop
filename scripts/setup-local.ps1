param(
  [switch]$StartDatabase
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repositoryRoot
$localEnvPath = Join-Path $repositoryRoot ".env.local"
$standaloneCompose = Get-Command docker-compose -ErrorAction SilentlyContinue
$docker = Get-Command docker -ErrorAction SilentlyContinue

function Invoke-CritsCompose {
  param([Parameter(Mandatory)][string[]]$ComposeArguments)

  if ($standaloneCompose) {
    & $standaloneCompose.Source @ComposeArguments
  } else {
    & $docker.Source compose @ComposeArguments
  }
  $script:composeExitCode = $LASTEXITCODE
}

if (Test-Path -LiteralPath $localEnvPath) {
  throw ".env.local already exists. It was left untouched; remove or back it up yourself before creating a new local environment."
}

function New-CritsSecret {
  $bytes = [byte[]]::new(48)
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

$adminPassword = New-CritsSecret
$appPassword = New-CritsSecret
$mediaKey = New-CritsSecret
$templatePath = Join-Path $repositoryRoot ".env.example"
$contents = [System.IO.File]::ReadAllText($templatePath)
$contents = [regex]::Replace($contents, "(?m)^POSTGRES_ADMIN_PASSWORD=.*$", "POSTGRES_ADMIN_PASSWORD=$adminPassword")
$contents = [regex]::Replace($contents, "(?m)^CRITS_DB_APP_PASSWORD=.*$", "CRITS_DB_APP_PASSWORD=$appPassword")
$contents = [regex]::Replace($contents, "(?m)^DATABASE_URL=.*$", "DATABASE_URL=postgresql://crits_app:$appPassword@127.0.0.1:5433/crits_db")
$contents = [regex]::Replace($contents, "(?m)^MEDIA_UPLOAD_SIGNING_KEY=.*$", "MEDIA_UPLOAD_SIGNING_KEY=$mediaKey")
[System.IO.File]::WriteAllText($localEnvPath, $contents, [System.Text.UTF8Encoding]::new($false))

if (-not $StartDatabase) {
  Write-Output "Created .env.local with random credentials. It is ignored by Git."
  Write-Output "Start PostgreSQL with: docker-compose --env-file .env.local up -d db (or docker compose if using the Docker CLI plugin)."
  return
}

if (-not $standaloneCompose -and -not $docker) {
  throw "Docker Compose is unavailable. .env.local was kept; install/start Docker Desktop, then run this script again."
}

Invoke-CritsCompose -ComposeArguments @("--env-file", ".env.local", "up", "-d", "db")
if ($script:composeExitCode -ne 0) {
  throw "PostgreSQL did not start. .env.local was kept; check that port 5433 is free and Docker Desktop is running."
}

$databaseId = Invoke-CritsCompose -ComposeArguments @("--env-file", ".env.local", "ps", "-q", "db")
if ($script:composeExitCode -ne 0 -or -not $databaseId) {
  throw "Could not locate the CRITS database container. .env.local was kept."
}
$databaseHealth = "starting"
for ($attempt = 0; $attempt -lt 30 -and $databaseHealth -ne "healthy"; $attempt++) {
  $databaseHealth = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' $databaseId
  if ($LASTEXITCODE -ne 0) { break }
  if ($databaseHealth -ne "healthy") { Start-Sleep -Seconds 1 }
}
if ($databaseHealth -ne "healthy") {
  throw "The CRITS database did not become healthy. .env.local was kept; inspect it with docker-compose --env-file .env.local logs db."
}

corepack pnpm --filter @workspace/db run push
if ($LASTEXITCODE -ne 0) {
  throw "Database schema setup failed. PostgreSQL is running and .env.local was kept; see the command output above."
}

Write-Output "PostgreSQL is running and the CRITS schema is ready."
Write-Output "Start the app with corepack pnpm run dev:api and corepack pnpm run dev:shop."
