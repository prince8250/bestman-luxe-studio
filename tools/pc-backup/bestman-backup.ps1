<#
.SYNOPSIS
  Bestman POS backup for the studio PC (spec 21, backup-and-recovery.md Layer 1).

.DESCRIPTION
  Runs at log-on and every 2 hours while the PC is on (install-task.ps1).
  Each run:
    1. downloads the full backup (all records) and saves it as
       <folder>\YYYY\MM\bestman-backup-YYYY-MM-DD.json, replacing today's file
       from an earlier run;
    2. saves today's day report as day-report-YYYY-MM-DD.csv and .html;
    3. looks back over the last days (7 by default) and re-saves a day report
       that changed since it was saved, so sales entered late in the evening
       reach the PC the next morning;
    4. deletes full backups older than the retention period (day reports are
       kept);
    5. writes backup-log.txt in the backup folder and reports the result to
       the POS (the owner sees it on the Backups page).
  A download is tried 3 times, a few minutes apart. Files are written under a
  temporary name and checked before they replace anything, so a half-written
  file never looks like a good backup.

  Written for Windows PowerShell 5.1 (built into Windows 10 and 11). Settings
  are in config.json next to this script (see README.md). The token in it is
  never written to the log.

.PARAMETER ConfigPath
  The settings file. Default: config.json next to this script.
#>
[CmdletBinding()]
param(
  # Default: config.json next to this script.
  [string]$ConfigPath = ''
)

$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 leaves $PSScriptRoot empty in parameter defaults.
$Here = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $ConfigPath) { $ConfigPath = Join-Path $Here 'config.json' }
$ProgressPreference = 'SilentlyContinue'   # the progress bar makes downloads in 5.1 very slow
Set-StrictMode -Version 2
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Invariant = [Globalization.CultureInfo]::InvariantCulture
$Utf8 = New-Object Text.UTF8Encoding($false)

# --- Settings ----------------------------------------------------------------

function Read-Config([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "The settings file is missing: $path. Copy config.example.json to config.json and fill it in."
  }
  $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
  $get = {
    param($name, $default)
    $property = $raw.PSObject.Properties[$name]
    if ($property -and $null -ne $property.Value -and "$($property.Value)" -ne '') { return $property.Value }
    return $default
  }
  foreach ($name in 'siteUrl', 'token', 'backupFolder') {
    if (-not (& $get $name $null)) { throw "config.json: '$name' is missing." }
  }
  return [pscustomobject]@{
    SiteUrl           = ([string](& $get 'siteUrl' '')).TrimEnd('/')
    Token             = [string](& $get 'token' '')
    Folder            = [string](& $get 'backupFolder' '')
    RetentionDays     = [int](& $get 'retentionDays' 180)
    RetryDelaySeconds = [int](& $get 'retryDelaySeconds' 120)
    CatchUpDays       = [int](& $get 'catchUpDays' 7)
  }
}

# --- Log ---------------------------------------------------------------------

$script:LogFile = $null

function Write-Log([string]$message) {
  $line = '{0}  {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss', $Invariant), $message
  Write-Host $line   # not Write-Output: that would mix log lines into functions' return values
  if ($script:LogFile) { [IO.File]::AppendAllText($script:LogFile, $line + "`r`n", $Utf8) }
}

# Keeps the log to its last 5000 lines once it passes 1 MB.
function Limit-Log {
  if ($script:LogFile -and (Test-Path -LiteralPath $script:LogFile) -and (Get-Item -LiteralPath $script:LogFile).Length -gt 1MB) {
    $lines = [IO.File]::ReadAllLines($script:LogFile, $Utf8)
    [IO.File]::WriteAllLines($script:LogFile, [string[]]($lines | Select-Object -Last 5000), $Utf8)
  }
}

# --- Downloads ---------------------------------------------------------------

function Get-StatusCode($errorRecord) {
  $response = $errorRecord.Exception.PSObject.Properties['Response']
  if ($response -and $response.Value -and $response.Value.PSObject.Properties['StatusCode']) {
    return [int]$response.Value.StatusCode
  }
  return 0
}

function Get-ErrorText($errorRecord) {
  $status = Get-StatusCode $errorRecord
  if ($status -gt 0) { return "HTTP $status" }
  return $errorRecord.Exception.Message
}

# Downloads $path from the POS into $outFile, trying 3 times. A refused token
# (401) is not tried again: waiting will not fix it.
function Invoke-Download([string]$path, [string]$outFile) {
  $url = $script:Config.SiteUrl + $path
  for ($attempt = 1; ; $attempt++) {
    try {
      Invoke-WebRequest -Uri $url -Headers @{ Authorization = "Bearer $($script:Config.Token)" } -OutFile $outFile `
        -UseBasicParsing -TimeoutSec 300 | Out-Null
      return
    } catch {
      $reason = Get-ErrorText $_
      if ((Get-StatusCode $_) -eq 401) { throw "The POS refused the token (HTTP 401). Check 'token' in config.json." }
      if ($attempt -ge 3) { throw "Could not download $path after 3 tries ($reason)." }
      Write-Log "  try $attempt for $path failed ($reason); trying again in $($script:Config.RetryDelaySeconds) seconds"
      Start-Sleep -Seconds $script:Config.RetryDelaySeconds
    }
  }
}

function Expand-Gzip([string]$source, [string]$target) {
  $in = [IO.File]::OpenRead($source)
  try {
    $gzip = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionMode]::Decompress)
    $out = [IO.File]::Create($target)
    try { $gzip.CopyTo($out) } finally { $out.Dispose(); $gzip.Dispose() }
  } finally {
    $in.Dispose()
  }
}

# Checks that a file is a complete Bestman backup and returns its row counts.
# PowerShell 5.1's ConvertFrom-Json refuses files over about 2 MB, so the .NET
# reader is used with its limit raised (PowerShell 7 has no limit).
function Get-SnapshotCounts([string]$path) {
  $text = [IO.File]::ReadAllText($path, $Utf8)
  $serializer = $null
  try {
    Add-Type -AssemblyName System.Web.Extensions
    $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $serializer.MaxJsonLength = [int]::MaxValue
  } catch {
    $serializer = $null
  }
  $counts = [ordered]@{}
  try {
    if ($serializer) {
      $data = $serializer.DeserializeObject($text)
      $format = $data['format']
      $rowCounts = $data['row_counts']
      foreach ($key in $rowCounts.Keys) { $counts[$key] = [long]$rowCounts[$key] }
    } else {
      $data = $text | ConvertFrom-Json
      $format = $data.format
      foreach ($property in $data.row_counts.PSObject.Properties) { $counts[$property.Name] = [long]$property.Value }
    }
  } catch {
    throw "The backup file is incomplete or damaged ($($_.Exception.Message))."
  }
  if ($format -ne 'bestman-backup' -or $counts.Count -eq 0) { throw 'The downloaded file is not a complete Bestman backup.' }
  return $counts
}

function Test-DayReport([string]$path) {
  $text = [IO.File]::ReadAllText($path, $Utf8)
  if ($text -notmatch 'End-of-day report') { throw "The day report $([IO.Path]::GetFileName($path)) is not complete." }
}

# The report with its "made at" time taken out, to tell whether a day changed.
function Get-ReportContent([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  $text = [IO.File]::ReadAllText($path, $Utf8)
  return [regex]::Replace($text, '(?m)^Made,[^\r\n]*', '')
}

# Puts a checked temporary file in place, replacing an earlier one.
# [NullString]::Value, not $null: PowerShell would pass $null to .NET as an
# empty path ("no backup copy" has to be a real null).
function Save-File([string]$temp, [string]$final) {
  if (Test-Path -LiteralPath $final) { [IO.File]::Replace($temp, $final, [NullString]::Value) } else { [IO.File]::Move($temp, $final) }
}

function Get-DayFolder([datetime]$day) {
  $folder = Join-Path (Join-Path $script:Config.Folder $day.ToString('yyyy', $Invariant)) $day.ToString('MM', $Invariant)
  if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
  return $folder
}

function Save-DayReport([datetime]$day, [string]$format) {
  $date = $day.ToString('yyyy-MM-dd', $Invariant)
  $final = Join-Path (Get-DayFolder $day) "day-report-$date.$format"
  $temp = "$final.partial"
  Invoke-Download "/api/backup/day-report?date=$date&format=$format" $temp
  Test-DayReport $temp
  Save-File $temp $final
}

# --- Report to the POS -------------------------------------------------------

function Send-Heartbeat([hashtable]$body) {
  $json = $body | ConvertTo-Json -Depth 5 -Compress
  try {
    Invoke-WebRequest -Uri ($script:Config.SiteUrl + '/api/backup/heartbeat') -Method Post `
      -Headers @{ Authorization = "Bearer $($script:Config.Token)" } -ContentType 'application/json' `
      -Body $Utf8.GetBytes($json) -UseBasicParsing -TimeoutSec 60 | Out-Null
    Write-Log 'Reported the result to the POS.'
  } catch {
    Write-Log "Could not report the result to the POS ($(Get-ErrorText $_)); the next run will."
  }
}

# --- The run -----------------------------------------------------------------

try {
  $script:Config = Read-Config $ConfigPath
} catch {
  $fallback = Join-Path $Here 'backup-log.txt'
  [IO.File]::AppendAllText($fallback, ('{0}  FAILED: {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss', $Invariant), $_.Exception.Message) + "`r`n", $Utf8)
  Write-Host "FAILED: $($_.Exception.Message)"
  exit 1
}

New-Item -ItemType Directory -Path $script:Config.Folder -Force | Out-Null
$script:LogFile = Join-Path $script:Config.Folder 'backup-log.txt'
Limit-Log

# Business dates are Accra dates, and Accra is on UTC all year.
$started = [DateTime]::UtcNow
$today = $started.Date
$todayText = $today.ToString('yyyy-MM-dd', $Invariant)
$status = 'failed'
$problems = New-Object Collections.Generic.List[string]
$fileName = "bestman-backup-$todayText.json"
$size = $null
$counts = $null

Write-Log "Backup started for $todayText."
# Leftovers of a run that was cut off (the PC switched off mid-run).
Get-ChildItem -LiteralPath $script:Config.Folder -Recurse -File -Filter '*.partial' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

try {
  # 1. The full backup.
  $final = Join-Path (Get-DayFolder $today) $fileName
  $gz = "$final.gz.partial"
  $json = "$final.partial"
  Invoke-Download '/api/backup/export' $gz
  Expand-Gzip $gz $json
  Remove-Item -LiteralPath $gz -Force
  $counts = Get-SnapshotCounts $json
  $size = (Get-Item -LiteralPath $json).Length
  Save-File $json $final
  $total = 0; foreach ($value in $counts.Values) { $total += $value }
  Write-Log ("Saved {0} ({1:N0} KB, {2:N0} rows)." -f $fileName, ($size / 1KB), $total)

  # 2. Today's day report.
  Save-DayReport $today 'csv'
  Save-DayReport $today 'html'
  Write-Log "Saved today's day report (CSV and HTML)."
  $status = 'success'
} catch {
  $problems.Add($_.Exception.Message)
  Write-Log "FAILED: $($_.Exception.Message)"
}

if ($status -eq 'success') {
  # 3. Earlier days: save a report that is missing or changed (a late sale, a
  #    past sale entered today). Days without sales and without a saved report
  #    are skipped.
  for ($back = 1; $back -le $script:Config.CatchUpDays; $back++) {
    $day = $today.AddDays(-$back)
    $date = $day.ToString('yyyy-MM-dd', $Invariant)
    $final = Join-Path (Get-DayFolder $day) "day-report-$date.csv"
    $temp = "$final.partial"
    try {
      Invoke-Download "/api/backup/day-report?date=$date&format=csv" $temp
      Test-DayReport $temp
      $fresh = Get-ReportContent $temp
      $saved = Get-ReportContent $final
      if ($null -eq $saved -and $fresh -match '(?m)^Sales,0\r?$') {
        Remove-Item -LiteralPath $temp -Force
      } elseif ($fresh -ne $saved) {
        Save-File $temp $final
        Save-DayReport $day 'html'
        if ($null -eq $saved) { Write-Log "Saved the day report for $date." } else { Write-Log "Updated the day report for $date (it changed since it was saved)." }
      } else {
        Remove-Item -LiteralPath $temp -Force
      }
    } catch {
      if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
      $problems.Add("Day report for ${date}: $($_.Exception.Message)")
      Write-Log "Could not check the day report for ${date}: $($_.Exception.Message)"
    }
  }

  # 4. Retention: full backups older than the setting go; day reports stay.
  $cutoff = $today.AddDays(-$script:Config.RetentionDays)
  Get-ChildItem -LiteralPath $script:Config.Folder -Recurse -File -Filter 'bestman-backup-*.json' | ForEach-Object {
    if ($_.Name -match '^bestman-backup-(\d{4}-\d{2}-\d{2})\.json$') {
      $fileDay = [datetime]::ParseExact($Matches[1], 'yyyy-MM-dd', $Invariant)
      if ($fileDay -lt $cutoff) {
        Remove-Item -LiteralPath $_.FullName -Force
        Write-Log "Deleted $($_.Name) (older than $($script:Config.RetentionDays) days)."
      }
    }
  }
}

# 5. Report to the POS.
$body = @{
  kind        = 'daily_pc'
  status      = $status
  started_at  = $started.ToString('yyyy-MM-ddTHH:mm:ssZ', $Invariant)
  finished_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ', $Invariant)
}
if ($status -eq 'success') {
  $body.file_name = $fileName
  $body.size_bytes = [long]$size
  $body.row_counts = $counts
}
if ($problems.Count -gt 0) {
  $message = $problems -join ' | '
  if ($message.Length -gt 1900) { $message = $message.Substring(0, 1900) }
  $body.message = $message
}
Send-Heartbeat $body

if ($status -eq 'success') {
  Write-Log 'Backup finished.'
  exit 0
}
Write-Log 'Backup did not finish; the next run tries again.'
exit 1
