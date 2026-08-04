const sharp = require('sharp');

const file = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\icon-purple-sat22-bri095.png';

async function run() {
  try {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const channels = info.channels;
    
    console.log(`Image dimensions: ${w}x${h}, channels: ${channels}`);
    
    // Sample a 5x5 grid across the image
    for (let row = 0; row < 5; row++) {
      const y = Math.floor((h - 1) * (row / 4));
      let line = '';
      for (let col = 0; col < 5; col++) {
        const x = Math.floor((w - 1) * (col / 4));
        const index = (y * w + x) * channels;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = channels > 3 ? data[index + 3] : 255;
        line += `(${x},${y}):[${r},${g},${b},${a}] `;
      }
      console.log(line);
    }
  } catch (e) {
    console.error(e);
  }
}

run();
