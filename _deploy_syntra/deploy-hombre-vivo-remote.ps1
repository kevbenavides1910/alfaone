# Sube _deploy/server-api al servidor y ejecuta deploy-hombre-vivo.sh
param(
    [string]$Server = "10.1.1.229",
    [string]$User = "soporte-ti",
    [string]$Key = "$env:USERPROFILE\.ssh\id_ed25519_syntra",
    [string]$Root = "/home/soporte-ti/presupuestos-alfa"
)

$ErrorActionPreference = "Stop"
$LocalDeploy = Join-Path $PSScriptRoot "."
$RemoteDeploy = "$Root/_syntra_deploy"

Write-Host "==> Limpiando host key antigua (si aplica)..."
ssh-keygen -R $Server 2>$null

Write-Host "==> Subiendo archivos a ${User}@${Server}:$RemoteDeploy"
ssh -i $Key -o StrictHostKeyChecking=accept-new "${User}@${Server}" "mkdir -p $RemoteDeploy"
scp -i $Key -r "$LocalDeploy\*" "${User}@${Server}:$RemoteDeploy/"

Write-Host "==> Ejecutando deploy en servidor..."
ssh -i $Key "${User}@${Server}" "chmod +x $RemoteDeploy/deploy-hombre-vivo.sh && bash $RemoteDeploy/deploy-hombre-vivo.sh $Root"

Write-Host "==> Despliegue hombre vivo finalizado."
