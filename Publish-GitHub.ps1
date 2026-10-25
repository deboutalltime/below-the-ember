param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?/?$')]
    [string]$RepositoryUrl
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$gitCommand = Get-Command git -ErrorAction SilentlyContinue
if ($gitCommand) { $projectGit = $gitCommand.Source }
else { $projectGit = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe' }
if (-not (Test-Path -LiteralPath $projectGit)) { throw 'Install Git for Windows before publishing.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.git'))) { throw 'This folder needs its prepared Git repository. Use the project folder, not an extracted media-only folder.' }
$changes = & $projectGit -C $projectRoot status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the local repository.' }
if ($changes) { throw 'Review and commit local changes before publishing.' }
$remoteNames = & $projectGit -C $projectRoot remote
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect repository remotes.' }
$existingOrigin = if ($remoteNames -contains 'origin') { & $projectGit -C $projectRoot remote get-url origin } else { $null }
if ($existingOrigin -and $existingOrigin.TrimEnd('/') -ne $RepositoryUrl.TrimEnd('/')) { throw 'Origin already points elsewhere. It has not been changed.' }
if (-not $existingOrigin) {
    & $projectGit -C $projectRoot remote add origin $RepositoryUrl
    if ($LASTEXITCODE -ne 0) { throw 'Could not add the repository URL.' }
}
& $projectGit -C $projectRoot push --set-upstream origin main
if ($LASTEXITCODE -ne 0) { throw 'Push did not finish. Check GitHub sign-in and access to the empty repository. No force push was attempted.' }
Write-Host "Published main to $RepositoryUrl"
