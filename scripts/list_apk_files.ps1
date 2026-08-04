Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('C:\Users\ADMIN\OneDrive\Desktop\Pranix-Release\EdProSys\apk\edprosys-v4-release.apk')
foreach ($entry in $zip.Entries) {
    if ($entry.FullName -like "*.png") {
        Write-Output $entry.FullName
    }
}
$zip.Dispose()
