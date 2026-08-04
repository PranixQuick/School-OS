const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets';

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
    return { r, g, b, a, w: info.width, h: info.height };
  } catch (e) {
    return null;
  }
}

async function run() {
  const files = fs.readdirSync(targetDir);
  console.log(`Scanning ${files.length} icon asset files...`);

  for (const file of files) {
    if (!file.endsWith('.png')) continue;
    const filePath = path.join(targetDir, file);
    const centerMeta = await sharp(filePath).metadata();
    const w = centerMeta.width;
    const h = centerMeta.height;
    
    const center = await getPixelColor(filePath, Math.floor(w / 2), Math.floor(h / 2));
    const corner = await getPixelColor(filePath, 10, 10);
    console.log(`${file} (${w}x${h}) -> Center:`, center, `Corner:`, corner);
  }
}

run();
