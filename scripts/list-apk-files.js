const fs = require('fs');
const JSZip = require('jszip');

async function listApk() {
  const apkPath = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\apk\\edprosys-v4-release.apk';
  const data = fs.readFileSync(apkPath);
  const zip = await JSZip.loadAsync(data);
  
  const files = Object.keys(zip.files);
  const resPngs = files.filter(name => name.startsWith('res/') && name.endsWith('.png'));
  console.log('PNG files in APK:', resPngs.slice(0, 50));
  console.log('Total PNG files:', resPngs.length);
}

listApk().catch(console.error);
