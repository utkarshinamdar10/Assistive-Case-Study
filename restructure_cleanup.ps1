# MYOHAP Workspace Cleanup Script
# This script removes the redundant files and folders that have been moved to their new, structured locations.

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "         MYOHAP RESTRUCTURE CLEANUP       " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Define directories to clean up
$oldFolders = @(
    "scripts/emg_reader",
    "scripts/emg_reader_esp32",
    "scripts/sketch_jun4a",
    "scripts/ecg_light_on_1",
    "assistive_side_projects"
)

# Confirm before deletion
$confirm = Read-Host "Are you sure you want to delete the old redundant folders? (y/n)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "[INFO] Cleanup canceled. No directories were deleted." -ForegroundColor Yellow
    Exit
}

# Perform cleanup
foreach ($folder in $oldFolders) {
    if (Test-Path $folder) {
        Write-Host "Removing: $folder..." -ForegroundColor Green
        Remove-Item -Path $folder -Recurse -Force
    } else {
        Write-Host "Not found (already cleaned): $folder" -ForegroundColor DarkGray
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Cleanup complete! Your repository is now fully structured." -ForegroundColor Cyan
Write-Host "Feel free to delete this script (restructure_cleanup.ps1) when done." -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan
