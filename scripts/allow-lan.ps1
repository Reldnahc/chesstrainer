#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ipaddress]$LocalAddress,
    [ValidateRange(1, 65535)][int]$Port = 8000
)
$ErrorActionPreference = "Stop"
$ruleName = "Fieldwork-LAN-TCP-$Port"
$existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
$parameters = @{
    Enabled = "True"
    Direction = "Inbound"
    Action = "Allow"
    Profile = "Private"
    LocalAddress = $LocalAddress.IPAddressToString
    RemoteAddress = "LocalSubnet"
    Protocol = "TCP"
    LocalPort = $Port
}
if ($existing) {
    $existing | Set-NetFirewallRule @parameters | Out-Null
} else {
    New-NetFirewallRule -Name $ruleName -DisplayName "Fieldwork LAN (TCP $Port)" @parameters | Out-Null
}
Write-Output "Fieldwork firewall access enabled on ${LocalAddress}:$Port (Private profile, LocalSubnet only)."
