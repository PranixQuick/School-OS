const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const androidRes = 'C:\\Users\\ADMIN\\School-OS\\android\\app\\src\\main\\res';
const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

async function getPixelColor(imgPath, x, y) {
  try {
    const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    const index = (y * info.width + x) * channels;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = channels > 3 ? data[index + 3] : 255;
    return { r, g, b, a };
  } catch (e) {
    return { error: e.message };
  }
}

async function run() {
  console.log('Checking all densities...');
  for (const density of densities) {
    const dir = path.join(androidRes, `mipmap-${density}`);
    const files = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'];
    
    console.log(`\nDensity: ${density}`);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (!fs.existsSync(filePath)) {
        console.log(`  ${file}: FILE NOT FOUND`);
        continue;
      }
      
      const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
      const w = info.width;
      const h = info.height;
      
      const center = await getPixelColor(filePath, Math.floor(w / 2), Math.floor(h / 2));
      const corner = await getPixelColor(filePath, 1, 1);
      
      console.log(`  ${file} (${w}x${h}) -> Center: R=${center.r},G=${center.g},B=${center.b},A=${center.a} | Corner: R=${corner.r},G=${corner.g},B=${corner.b},A=${corner.a}`);
    }
  }
}

run();
