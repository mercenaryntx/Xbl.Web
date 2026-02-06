# Script to grant Key Vault permissions to the current user
# This resolves the "Caller is not authorized" error when trying to add secrets

param(
    [Parameter(Mandatory=$false)]
    [string]$KeyVaultName = "xbl-keyvault",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("RBAC", "AccessPolicy")]
    [string]$PermissionModel = "RBAC"
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

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Azure Key Vault Permission Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Get current user information
Write-Info "Getting current user information..."
try {
    $account = az account show | ConvertFrom-Json
    $currentUser = $account.user.name
    Write-Success "? Current user: $currentUser"
}
catch {
    Write-ErrorMessage "? Failed to get current user information"
    Write-ErrorMessage "Please ensure you're logged in: az login"
    exit 1
}

# Get Key Vault information
Write-Info "Getting Key Vault information..."
try {
    $vault = az keyvault show --name $KeyVaultName | ConvertFrom-Json
    Write-Success "? Key Vault found: $KeyVaultName"
    Write-Info "  Resource Group: $($vault.resourceGroup)"
    Write-Info "  Location: $($vault.location)"
    
    $vaultResourceGroup = $vault.resourceGroup
    $vaultId = $vault.id
    $isRbacEnabled = $vault.properties.enableRbacAuthorization
    
    $permissionModel = if ($isRbacEnabled) { 'RBAC' } else { 'Access Policy' }
    Write-Info "  Current Permission Model: $permissionModel"
}
catch {
    Write-ErrorMessage "? Failed to get Key Vault information"
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Granting Permissions" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check which permission model to use
if ($isRbacEnabled) {
    Write-Info "Key Vault is using RBAC (recommended modern approach)"
    Write-Info "Assigning 'Key Vault Secrets Officer' role..."
    
    try {
        # Assign Key Vault Secrets Officer role to current user
        $roleAssignment = az role assignment create `
            --role "Key Vault Secrets Officer" `
            --assignee $currentUser `
            --scope $vaultId `
            2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "? Successfully assigned 'Key Vault Secrets Officer' role"
            Write-Warning "? Role assignments may take 5-10 minutes to propagate"
            Write-Info "  You can manage secrets (create, read, update, delete)"
        }
        else {
            # Check if role already exists
            if ($roleAssignment -like "*already exists*") {
                Write-Success "? Role assignment already exists"
            }
            else {
                Write-ErrorMessage "? Failed to assign role"
                Write-ErrorMessage $roleAssignment
                exit 1
            }
        }
    }
    catch {
        Write-ErrorMessage "? Error assigning role: $_"
        exit 1
    }
}
else {
    Write-Info "Key Vault is using Access Policies (legacy approach)"
    Write-Info "Setting access policy for secrets..."
    
    try {
        # Set access policy for secrets
        $policy = az keyvault set-policy `
            --name $KeyVaultName `
            --upn $currentUser `
            --secret-permissions get list set delete backup restore recover purge `
            2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "? Successfully set access policy"
            Write-Info "  Granted permissions: get, list, set, delete, backup, restore, recover, purge"
        }
        else {
            Write-ErrorMessage "? Failed to set access policy"
            Write-ErrorMessage $policy
            exit 1
        }
    }
    catch {
        Write-ErrorMessage "? Error setting access policy: $_"
        exit 1
    }
}

# Optional: Enable RBAC if using Access Policies (recommended for new vaults)
if (-not $isRbacEnabled) {
    Write-Host ""
    Write-Warning "? Your Key Vault is using Access Policies (legacy model)"
    Write-Info "  Consider migrating to RBAC for better security and management"
    Write-Host ""
    $response = Read-Host "Would you like to migrate to RBAC now? (y/N)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Info "Enabling RBAC authorization..."
        try {
            $update = az keyvault update `
                --name $KeyVaultName `
                --resource-group $vaultResourceGroup `
                --enable-rbac-authorization true `
                2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "? Successfully enabled RBAC"
                Write-Info "Assigning 'Key Vault Secrets Officer' role..."
                
                $roleAssignment = az role assignment create `
                    --role "Key Vault Secrets Officer" `
                    --assignee $currentUser `
                    --scope $vaultId `
                    2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "? Successfully assigned role"
                }
            }
            else {
                Write-ErrorMessage "? Failed to enable RBAC"
                Write-ErrorMessage $update
            }
        }
        catch {
            Write-ErrorMessage "? Error enabling RBAC: $_"
        }
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Success "? Permissions have been configured"
Write-Host ""
Write-Warning "? IMPORTANT: Role assignments may take 5-10 minutes to propagate"
Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. Wait 5-10 minutes for permissions to propagate" -ForegroundColor Gray
Write-Host "  2. Run the Add-KeyVaultSecrets.ps1 script again:" -ForegroundColor Gray
Write-Host "     .\Add-KeyVaultSecrets.ps1 -Interactive" -ForegroundColor Gray
Write-Host ""
Write-Info "To verify your permissions:"
Write-Host "  az keyvault secret list --vault-name $KeyVaultName" -ForegroundColor Gray
Write-Host ""

# Additional info for Azure DevOps
Write-Info "For Azure DevOps Pipeline:"
Write-Host "  Your pipeline service principal will also need permissions" -ForegroundColor Gray
Write-Host "  Use the service connection name in the pipeline" -ForegroundColor Gray
Write-Host ""
Write-Host "  To grant pipeline access (RBAC):" -ForegroundColor Gray
Write-Host "  az role assignment create \" -ForegroundColor Gray
Write-Host "    --role 'Key Vault Secrets User' \" -ForegroundColor Gray
Write-Host "    --assignee <service-principal-id> \" -ForegroundColor Gray
Write-Host "    --scope $vaultId" -ForegroundColor Gray
Write-Host ""
