const sharp = require('sharp');

const sat22Path = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\icon-purple-sat22-bri095.png';

async function run() {
  try {
    const { data } = await sharp(sat22Path).raw().toBuffer({ resolveWithObject: true });
    let minR = 255, maxR = 0;
    let minG = 255, maxG = 0;
    let minB = 255, maxB = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (g < minG) minG = g;
      if (g > maxG) maxG = g;
      if (b < minB) minB = b;
      if (b > maxB) maxB = b;
    }
    
    console.log(`icon-purple-sat22-bri095.png channel bounds:`);
    console.log(`  Red:   min=${minR}, max=${maxR}`);
    console.log(`  Green: min=${minG}, max=${maxG}`);
    console.log(`  Blue:  min=${minB}, max=${maxB}`);
  } catch (e) {
    console.error(e);
  }
}

run();
