# Script to add secrets to Azure Key Vault for XBL project
# Prerequisites:
# - Azure CLI installed and authenticated (az login)
# - Appropriate permissions to manage secrets in the Key Vault

param(
    [Parameter(Mandatory=$false)]
    [string]$KeyVaultName = "xbl-keyvault",
    
    [Parameter(Mandatory=$false)]
    [string]$OpenXblApiKey,
    
    [Parameter(Mandatory=$false)]
    [string]$AzureStorageConnectionString,
    
    [Parameter(Mandatory=$false)]
    [switch]$Interactive
)

# Color output functions
function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Warning {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

function Write-ErrorMessage {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

# Check if Azure CLI is installed
function Test-AzureCLI {
    try {
        $azVersion = az version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "? Azure CLI is installed"
            return $true
        }
    }
    catch {
        Write-ErrorMessage "? Azure CLI is not installed"
        Write-Info "Please install Azure CLI from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        return $false
    }
}

# Check if user is logged in to Azure
function Test-AzureLogin {
    try {
        $account = az account show 2>&1
        if ($LASTEXITCODE -eq 0) {
            $accountInfo = $account | ConvertFrom-Json
            Write-Success "? Logged in to Azure as: $($accountInfo.user.name)"
            Write-Info "  Subscription: $($accountInfo.name)"
            return $true
        }
    }
    catch {
        Write-ErrorMessage "? Not logged in to Azure"
        Write-Info "Please run: az login"
        return $false
    }
}

# Check if Key Vault exists
function Test-KeyVault {
    param([string]$VaultName)
    
    try {
        $vault = az keyvault show --name $VaultName 2>&1
        if ($LASTEXITCODE -eq 0) {
            $vaultInfo = $vault | ConvertFrom-Json
            Write-Success "? Key Vault '$VaultName' found"
            Write-Info "  Location: $($vaultInfo.location)"
            Write-Info "  Resource Group: $($vaultInfo.resourceGroup)"
            return $true
        }
    }
    catch {
        Write-ErrorMessage "? Key Vault '$VaultName' not found or access denied"
        Write-Info "Please ensure the Key Vault exists and you have appropriate permissions"
        return $false
    }
}

# Add or update a secret in Key Vault
function Set-KeyVaultSecret {
    param(
        [string]$VaultName,
        [string]$SecretName,
        [string]$SecretValue
    )
    
    if ([string]::IsNullOrWhiteSpace($SecretValue)) {
        Write-Warning "? Skipping '$SecretName' - no value provided"
        return $false
    }
    
    try {
        Write-Info "Adding secret '$SecretName' to Key Vault..."
        $result = az keyvault secret set --vault-name $VaultName --name $SecretName --value $SecretValue 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "? Successfully added secret '$SecretName'"
            return $true
        }
        else {
            Write-ErrorMessage "? Failed to add secret '$SecretName'"
            Write-ErrorMessage $result
            return $false
        }
    }
    catch {
        Write-ErrorMessage "? Error adding secret '$SecretName': $_"
        return $false
    }
}

# Get secret value from user input (hidden)
function Get-SecretFromUser {
    param(
        [string]$SecretName,
        [string]$Description
    )
    
    Write-Host ""
    Write-Info "Enter value for: $SecretName"
    if ($Description) {
        Write-Host "  Description: $Description" -ForegroundColor Gray
    }
    
    $secureString = Read-Host -AsSecureString -Prompt "Value (hidden)"
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureString)
    $plainText = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    
    return $plainText
}

# Main script execution
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Azure Key Vault Secret Management Script" -ForegroundColor Cyan
Write-Host "  XBL Project Configuration" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Validate prerequisites
Write-Info "Validating prerequisites..."
if (-not (Test-AzureCLI)) {
    exit 1
}

if (-not (Test-AzureLogin)) {
    exit 1
}

if (-not (Test-KeyVault -VaultName $KeyVaultName)) {
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Adding Secrets" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Interactive mode - prompt for secrets
if ($Interactive -or ([string]::IsNullOrWhiteSpace($OpenXblApiKey) -and [string]::IsNullOrWhiteSpace($AzureStorageConnectionString))) {
    Write-Host ""
    Write-Info "Running in interactive mode..."
    Write-Info "You will be prompted to enter each secret value"
    
    if ([string]::IsNullOrWhiteSpace($OpenXblApiKey)) {
        $OpenXblApiKey = Get-SecretFromUser -SecretName "OpenXblApiKey" -Description "API key from OpenXBL (https://xbl.io) for Xbox Live profile data"
    }
    
    if ([string]::IsNullOrWhiteSpace($AzureStorageConnectionString)) {
        $AzureStorageConnectionString = Get-SecretFromUser -SecretName "AzureStorageConnectionString" -Description "Connection string for Azure Blob Storage where live.db is stored"
    }
}

Write-Host ""

# Add secrets to Key Vault
$successCount = 0
$failCount = 0

if (Set-KeyVaultSecret -VaultName $KeyVaultName -SecretName "OpenXblApiKey" -SecretValue $OpenXblApiKey) {
    $successCount++
} else {
    $failCount++
}

if (Set-KeyVaultSecret -VaultName $KeyVaultName -SecretName "AzureStorageConnectionString" -SecretValue $AzureStorageConnectionString) {
    $successCount++
} else {
    $failCount++
}

# Summary
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

if ($successCount -gt 0) {
    Write-Success "? Successfully added $successCount secret(s)"
}

if ($failCount -gt 0) {
    Write-ErrorMessage "? Failed to add $failCount secret(s)"
}

Write-Host ""
Write-Info "Key Vault: $KeyVaultName"
Write-Host ""

if ($failCount -eq 0 -and $successCount -gt 0) {
    Write-Success "All secrets have been successfully configured!"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Host "  1. Verify the secrets in Azure Portal or using:" -ForegroundColor Gray
    Write-Host "     az keyvault secret list --vault-name $KeyVaultName" -ForegroundColor Gray
    Write-Host "  2. Ensure your Azure DevOps pipeline has access to the Key Vault" -ForegroundColor Gray
    Write-Host "  3. Run your pipeline to test the configuration" -ForegroundColor Gray
    Write-Host ""
    exit 0
}
else {
    exit 1
}
