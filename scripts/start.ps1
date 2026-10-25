param(
 [ValidateSet('development','test','staging','production')][string]$Environment='development',
 [switch]$All,
 [switch]$OpenBrowser
)
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
$pgbin='C:\Program Files\PostgreSQL\18\bin'
if(-not(Test-Path -LiteralPath "$project\.local\postgres\PG_VERSION")){throw 'Falta el cluster PostgreSQL. Consulta README.md para configurar otra instalación.'}
& "$pgbin\pg_ctl.exe" -D "$project\.local\postgres" status 2>$null | Out-Null
if($LASTEXITCODE -ne 0){& "$pgbin\pg_ctl.exe" -D "$project\.local\postgres" -l "$project\logs\postgres.log" -w start;if($LASTEXITCODE -ne 0){throw 'No se pudo iniciar PostgreSQL'}}
if(-not(Test-Path -LiteralPath "$project\node_modules")){npm.cmd ci;if($LASTEXITCODE -ne 0){throw 'Falló npm ci'}}
if(-not(Test-Path -LiteralPath "$project\dist\index.html")){npm.cmd run build;if($LASTEXITCODE -ne 0){throw 'Falló la compilación'}}
$environments=if($All){@('development','test','staging','production')}else{@($Environment)}
$ports=@{development=4100;test=4101;staging=4102;production=4103}
foreach($ambiente in $environments){
 $port=$ports[$ambiente];$running=$false
 try{$health=Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec 2;$running=$health.environment -eq $ambiente}catch{}
 if(-not $running){
  $node=(Get-Command node.exe).Source
  $process=Start-Process -FilePath $node -ArgumentList @("`"$project\server\index.js`"",$ambiente) -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput "$project\logs\$ambiente.log" -RedirectStandardError "$project\logs\$ambiente-error.log" -PassThru
  Set-Content -LiteralPath "$project\.local\$ambiente.pid" -Value $process.Id
  $ready=$false
  for($attempt=0;$attempt -lt 20;$attempt++){Start-Sleep -Milliseconds 300;try{$health=Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec 1;if($health.environment -eq $ambiente){$ready=$true;break}}catch{}}
  if(-not $ready){throw "No inició $ambiente. Revisa logs\$ambiente-error.log"}
 }
 Write-Host "$ambiente : http://127.0.0.1:$port"
}
if($OpenBrowser){Start-Process "http://127.0.0.1:$($ports[$Environment])"}
