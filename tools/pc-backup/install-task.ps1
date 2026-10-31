<#
.SYNOPSIS
  Installs (or removes) the Windows Scheduled Task that runs the Bestman POS
  backup on the studio PC (spec 21).

.DESCRIPTION
  The studio PC is switched off at night, so the backup follows the working
  day instead of a night schedule:
    - at log-on, after a short delay so the network is up;
    - then every 2 hours for the rest of the day while the PC is on.
  No night trigger and no shutdown trigger (Windows does not give a task
  enough time at shutdown). The task runs as the signed-in Windows user, only
  while that user is signed in, so no password is stored. If a run is missed
  it starts as soon as possible; a second copy never runs at the same time.
  "Run only if a network connection is available" is off: the backup script
  retries and logs a failure itself, so a missed backup is visible.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install-task.ps1
  powershell -ExecutionPolicy Bypass -File install-task.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File install-task.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  # Default: bestman-backup.ps1 next to this script.
  [string]$ScriptPath = '',
  [string]$TaskName = 'Bestman POS backup',
  [int]$DelayMinutes = 3,
  [int]$EveryHours = 2,
  # Shows what would be installed, without changing anything.
  [switch]$DryRun,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 leaves $PSScriptRoot empty in parameter defaults.
$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $ScriptPath) { $ScriptPath = Join-Path $here 'bestman-backup.ps1' }

if ($Uninstall) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed the task '$TaskName'. The backup files are not touched."
  } else {
    Write-Host "There is no task called '$TaskName'."
  }
  return
}

$ScriptPath = (Resolve-Path -LiteralPath $ScriptPath).Path
if (-not (Test-Path -LiteralPath (Join-Path (Split-Path $ScriptPath) 'config.json'))) {
  Write-Warning 'config.json is not next to the script yet. Copy config.example.json to config.json and fill it in before the first run.'
}
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`"" `
  -WorkingDirectory (Split-Path $ScriptPath)

# At log-on, a few minutes later, then every 2 hours for the rest of the day
# (16 hours covers any working day; the PC is off at night anyway).
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$trigger.Delay = 'PT{0}M' -f $DelayMinutes
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours $EveryHours) -RepetitionDuration (New-TimeSpan -Hours 16)
$trigger.Repetition = $repeat.Repetition

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$settings.RunOnlyIfNetworkAvailable = $false

$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

$summary = @(
  "Task:      $TaskName",
  "Runs:      $ScriptPath",
  "As:        $user (only while signed in; no password stored)",
  "When:      at log-on + $DelayMinutes minutes, then every $EveryHours hours for 16 hours",
  'Also:      starts late if a run was missed; never two at once; network check off; 30-minute limit'
)

$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description 'Saves the Bestman POS backup and day reports to this PC (tools/pc-backup).'

if ($DryRun) {
  Write-Host 'Dry run: the task was built and checked; nothing is installed.'
  $summary | ForEach-Object { Write-Host $_ }
  return
}

Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
Write-Host 'Installed:'
$summary | ForEach-Object { Write-Host $_ }
Write-Host "Run it now once to check: Start-ScheduledTask -TaskName '$TaskName' (then read backup-log.txt in the backup folder)."
