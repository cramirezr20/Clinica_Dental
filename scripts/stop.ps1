param([switch]$Database)
$project=Split-Path -Parent $PSScriptRoot
foreach($ambiente in @('development','test','staging','production')){
 $pidFile=Join-Path $project ".local\$ambiente.pid"
 if(Test-Path -LiteralPath $pidFile){
  $processId=[int](Get-Content -LiteralPath $pidFile)
  $process=Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
  if($process -and $process.Name -eq 'node.exe' -and $process.CommandLine -match 'server[/\\]index.js' -and $process.CommandLine -match $ambiente){Stop-Process -Id $processId;Write-Host "Detenido: $ambiente"}
 }
}
if($Database){& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D "$project\.local\postgres" -m fast -w stop}
