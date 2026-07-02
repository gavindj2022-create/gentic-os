# Creates a "GenTIC OS" shortcut on the Desktop pointing at launch-app.bat,
# using the gold-robot icon. Run once:  powershell -ExecutionPolicy Bypass -File create-shortcut.ps1
# After it appears, open it once and right-click the taskbar entry -> Pin to taskbar.

$root = $PSScriptRoot
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = $ws.CreateShortcut((Join-Path $desktop 'GenTIC OS.lnk'))
$lnk.TargetPath = (Join-Path $root 'launch-app.bat')
$lnk.WorkingDirectory = $root
$lnk.IconLocation = (Join-Path $root 'assets\gentic.ico')
$lnk.Description = 'GenTIC OS - local AI operating system'
$lnk.WindowStyle = 7   # launch the .bat minimized so the console doesn't flash
$lnk.Save()
Write-Host "Created 'GenTIC OS' shortcut on your Desktop."
