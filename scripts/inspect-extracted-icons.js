const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\ADMIN\\School-OS\\scripts\\apk_tmp';

async function getPixelColor(imgPath, x, y) {
  try {
    const { data, info } = await sharp(imgPath)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const channels = info.channels;
    const index = (y * info.width + x) * channels;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = channels > 3 ? data[index + 3] : 255;
    return { r, g, b, a };
  } catch (e) {
    return null;
  }
}

async function run() {
  const files = fs.readdirSync(targetDir);
  console.log(`Scanning ${files.length} files in extracted apk directory...`);

  for (const file of files) {
    const filePath = path.join(targetDir, file);
    try {
      const meta = await sharp(filePath).metadata();
      const w = meta.width;
      const h = meta.height;

      // Filter to launcher icon sizes: 48, 72, 96, 144, 192, 512
      if ([48, 72, 96, 144, 192, 512].includes(w) && w === h) {
        const center = await getPixelColor(filePath, Math.floor(w / 2), Math.floor(h / 2));
        const corner = await getPixelColor(filePath, 2, 2);
        console.log(`Icon candidate: ${file} (${w}x${h}) -> Center:`, center, `Corner:`, corner);
      }
    } catch (e) {
      // Not a valid image or failed to read
    }
  }
}

run();
