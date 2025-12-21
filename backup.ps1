# LetSpeak Backup Script

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupName = "letspeak_backup_$timestamp"
$backupPath = "C:\Users\MSI\Desktop\letspeak_backups\$backupName"

Write-Host "Creating backup..." -ForegroundColor Cyan

# Create backup folder
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

# Copy frontend (excluding node_modules)
Write-Host "Copying Frontend..." -ForegroundColor Yellow
robocopy "C:\Users\MSI\Desktop\letspeak\frontend" "$backupPath\frontend" /E /XD node_modules .vite /XF *.log /NFL /NDL /NJH /NJS /NC /NS

# Copy backend (excluding vendor)
Write-Host "Copying Backend..." -ForegroundColor Yellow
robocopy "C:\Users\MSI\Desktop\letspeak\backend" "$backupPath\backend" /E /XD vendor storage\logs /XF *.log /NFL /NDL /NJH /NJS /NC /NS

# Create zip file
Write-Host "Compressing files..." -ForegroundColor Yellow
Compress-Archive -Path $backupPath -DestinationPath "$backupPath.zip" -Force

# Remove uncompressed folder
Remove-Item -Recurse -Force $backupPath

Write-Host ""
Write-Host "Backup created successfully!" -ForegroundColor Green
Write-Host "Location: $backupPath.zip" -ForegroundColor Cyan
Write-Host ""
