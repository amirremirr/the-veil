# AUTORUN: runs the tasks in docs/RUNPLAN.md one at a time, each in a fresh Claude Code session
# with its own spending cap. Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File scripts\autorun.ps1
# Start later in the list (for example after a stop):
#   powershell -ExecutionPolicy Bypass -File scripts\autorun.ps1 -StartAt T3
param(
  [string]$StartAt = "T0",
  [double]$TotalCap = 92,
  [string]$Model = "opus"
)

$ErrorActionPreference = "Continue"

# Task list and per-task budget in US dollars (soft caps; the total is checked after each task).
$tasks = @(
  @{ id = "T0"; budget = 1.5 },
  @{ id = "T1"; budget = 6 },
  @{ id = "T2"; budget = 14 },
  @{ id = "T3"; budget = 10 },
  @{ id = "T4"; budget = 12 },
  @{ id = "T5"; budget = 12 },
  @{ id = "T6"; budget = 16 },
  @{ id = "T7"; budget = 8 },
  @{ id = "T8"; budget = 7 },
  @{ id = "T9"; budget = 3 }
)

# Keep the computer awake while this script runs (released when the window closes).
Add-Type -Namespace Win32 -Name Power -MemberDefinition @"
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern uint SetThreadExecutionState(uint esFlags);
"@
[void][Win32.Power]::SetThreadExecutionState([uint32]"0x80000001")  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED

if (-not $env:ANTHROPIC_API_KEY) {
  Write-Host "ANTHROPIC_API_KEY is not set in this window. Set it first:  `$env:ANTHROPIC_API_KEY = 'sk-ant-...'" -ForegroundColor Red
  exit 1
}
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Host "The claude command was not found. Install Claude Code first." -ForegroundColor Red
  exit 1
}

if ((git status --porcelain) -ne $null) {
  Write-Host "This folder has uncommitted changes. Commit or move them, or use a fresh clone, then run again." -ForegroundColor Red
  exit 1
}
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "autorun") {
  Write-Host "Switching to the autorun branch."
  git fetch origin
  git checkout autorun
  if ($LASTEXITCODE -ne 0) { Write-Host "Could not switch to autorun." -ForegroundColor Red; exit 1 }
}

New-Item -ItemType Directory -Force -Path "autorun-logs" | Out-Null
$spent = 0.0
$started = $false

foreach ($t in $tasks) {
  if ($t.id -eq $StartAt) { $started = $true }
  if (-not $started) { continue }

  if ((Test-Path "docs/PROGRESS.md") -and (Select-String -Path "docs/PROGRESS.md" -Pattern "ALL DONE" -Quiet)) {
    Write-Host "PROGRESS.md says ALL DONE. Stopping."
    break
  }
  if ($spent + $t.budget -gt $TotalCap) {
    Write-Host ("Stopping before {0}: spent about {1:N2} USD, cap {2}." -f $t.id, $spent, $TotalCap) -ForegroundColor Yellow
    break
  }

  $stamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
  $log = "autorun-logs/$($t.id)_$stamp.json"
  Write-Host ("[{0}] Starting {1} (budget {2} USD, spent so far {3:N2})" -f (Get-Date -Format "HH:mm"), $t.id, $t.budget, $spent)

  $prompt = "You are running unattended; nobody will answer questions. Read docs/RUNPLAN.md fully and follow Section A exactly. Then do task $($t.id) only, as written in Section C, finish with Section A.5, and stop."

  claude -p $prompt `
    --model $Model `
    --permission-mode dontAsk `
    --max-budget-usd $t.budget `
    --output-format json > $log 2> "autorun-logs/$($t.id)_$stamp.err.txt"
  $exitCode = $LASTEXITCODE

  $cost = 0.0
  try {
    $json = Get-Content $log -Raw | ConvertFrom-Json
    if ($json.total_cost_usd) { $cost = [double]$json.total_cost_usd }
  } catch { }
  if ($cost -eq 0.0) { $cost = $t.budget }   # unknown cost: assume the whole budget was used
  $spent += $cost
  Write-Host ("[{0}] Finished {1}: about {2:N2} USD (total {3:N2})" -f (Get-Date -Format "HH:mm"), $t.id, $cost, $spent)

  git pull --ff-only origin autorun 2>$null | Out-Null
  $row = Select-String -Path "docs/PROGRESS.md" -Pattern "^\| $($t.id) " -ErrorAction SilentlyContinue | Select-Object -First 1
  $statusOk = $row -and ($row.Line -match "DONE|SKIPPED|PARTIAL")
  $local = (git rev-parse HEAD).Trim()
  $remote = (git rev-parse origin/autorun 2>$null)
  if ($exitCode -ne 0 -or -not $statusOk -or ($remote -and $local -ne $remote.Trim()) -or ((git status --porcelain) -ne $null)) {
    Write-Host ("{0} did not finish cleanly (exit {1}, status row: {2}). Stopping so the state is preserved. See autorun-logs." -f $t.id, $exitCode, $row.Line) -ForegroundColor Red
    exit 1
  }

  if ($t.id -eq "T0") {
    if (-not ((Test-Path "docs/PROGRESS.md") -and (Select-String -Path "docs/PROGRESS.md" -Pattern "SMOKE OK" -Quiet))) {
      git pull --ff-only origin autorun 2>$null
    }
    if (-not ((Test-Path "docs/PROGRESS.md") -and (Select-String -Path "docs/PROGRESS.md" -Pattern "SMOKE OK" -Quiet))) {
      Write-Host "The smoke test did not pass. Look at autorun-logs for T0 and stop here." -ForegroundColor Red
      exit 1
    }
  }
}

[void][Win32.Power]::SetThreadExecutionState([uint32]"0x80000000")
Write-Host ("Done. Estimated spend {0:N2} USD. Check the real figure in the Claude Console." -f $spent)
