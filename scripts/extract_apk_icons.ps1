Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('C:\Users\ADMIN\OneDrive\Desktop\Pranix-Release\EdProSys\apk\edprosys-v4-release.apk')
$targetDir = 'C:\Users\ADMIN\School-OS\scripts\apk_tmp'
if (Test-Path $targetDir) { Remove-Item -Path $targetDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$count = 0
foreach ($entry in $zip.Entries) {
    if ($entry.FullName -like "*.png") {
        # Extract to targetDir using entry name
        $name = $entry.Name
        if ($entry.FullName -match "res/([^/]+)/") {
            $name = $Matches[1] + "_" + $entry.Name
        }
        $destPath = Join-Path $targetDir $name
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destPath, $true)
        $count++
    }
}
$zip.Dispose()
Write-Output "Extracted $count PNG files to $targetDir"
