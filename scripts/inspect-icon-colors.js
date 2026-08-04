const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const masterFinalPath = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\master-final-1024.png';
const sat22Path = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\icon-purple-sat22-bri095.png';
const androidSrcPath = 'C:\\Users\\ADMIN\\School-OS\\android\\app\\src\\main\\res\\mipmap-xxxhdpi\\ic_launcher.png';
const apkPath = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\apk\\edprosys-v4-release.apk';

async function getPixelColor(imgPath, x, y) {
  try {
    const { data, info } = await sharp(imgPath)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Calculate 1D index
    const channels = info.channels;
    const index = (y * info.width + x) * channels;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = channels > 3 ? data[index + 3] : 255;
    return { r, g, b, a, width: info.width, height: info.height };
  } catch (e) {
    return { error: e.message };
  }
}

async function run() {
  console.log('--- Image Color Inspector ---');

  // 1. Inspect master-final-1024.png
  let res = await getPixelColor(masterFinalPath, 512, 512);
  console.log(`master-final-1024.png center (512,512):`, res);
  // corner pixel to check background
  let cornerRes = await getPixelColor(masterFinalPath, 10, 10);
  console.log(`master-final-1024.png corner (10,10):`, cornerRes);

  // 2. Inspect icon-purple-sat22-bri095.png
  res = await getPixelColor(sat22Path, 512, 512);
  console.log(`icon-purple-sat22-bri095.png center (512,512):`, res);
  cornerRes = await getPixelColor(sat22Path, 10, 10);
  console.log(`icon-purple-sat22-bri095.png corner (10,10):`, cornerRes);

  // 3. Inspect Android project resource
  res = await getPixelColor(androidSrcPath, 96, 96);
  console.log(`androidSrcPath center (96,96):`, res);
  cornerRes = await getPixelColor(androidSrcPath, 5, 5);
  console.log(`androidSrcPath corner (5,5):`, cornerRes);

  // 4. Extract and inspect from APK
  const tmpDir = path.join(__dirname, 'apk_extract_tmp');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    console.log('Extracting res/mipmap-xxxhdpi-v4/ic_launcher.png from APK...');
    // Use tar to extract only that specific file (tar works with zip format on Windows)
    execSync(`tar -xf "${apkPath}" -C "${tmpDir}" res/mipmap-xxxhdpi-v4/ic_launcher.png`, { stdio: 'ignore' });
    const extractedIcon = path.join(tmpDir, 'res', 'mipmap-xxxhdpi-v4', 'ic_launcher.png');
    if (fs.existsSync(extractedIcon)) {
      const extRes = await getPixelColor(extractedIcon, 96, 96);
      console.log(`APK ic_launcher.png center (96,96):`, extRes);
      const extCorner = await getPixelColor(extractedIcon, 5, 5);
      console.log(`APK ic_launcher.png corner (5,5):`, extCorner);
    } else {
      console.log('Could not find extracted ic_launcher.png in expected directory.');
    }
  } catch (e) {
    console.log('Error extracting from APK:', e.message);
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

run();
