# setup.ps1 — crée uniquement les dossiers du projet

$ErrorActionPreference = 'Stop'

$dirs = @(
  'src',
  'src\assets',
  'src\router',
  'src\pages',
  'src\components',
  'src\composables',
  'src\store',
  'src\utils',
  'src\types'
)

foreach ($d in $dirs) {
  New-Item -ItemType Directory -Path $d -Force | Out-Null
  Write-Host "Created $d"
}

# Optionnel : déposer des .gitkeep pour pouvoir commit des dossiers vides
$createGitkeep = $true
if ($createGitkeep) {
  foreach ($d in $dirs) {
    $keep = Join-Path $d '.gitkeep'
    if (-not (Test-Path $keep)) {
      New-Item -ItemType File -Path $keep -Force | Out-Null
      Write-Host "Added $keep"
    }
  }
}

Write-Host 'Done.' -ForegroundColor Green
