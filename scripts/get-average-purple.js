const sharp = require('sharp');

const file = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\icon-purple-sat22-bri095.png';

async function run() {
  try {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      // We want to target the dark purple background of the circle.
      // This color has low green (e.g. g < 40) and moderate red and blue (e.g. 20 < r < 60, 20 < b < 60)
      if (r > 20 && r < 60 && g < 40 && b > 20 && b < 60) {
        sumR += r;
        sumG += g;
        sumB += b;
        count++;
      }
    }
    
    if (count > 0) {
      const avgR = Math.round(sumR / count);
      const avgG = Math.round(sumG / count);
      const avgB = Math.round(sumB / count);
      const hex = '#' + [avgR, avgG, avgB].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
      console.log(`Average purple background: RGB(${avgR}, ${avgG}, ${avgB}) -> Hex: ${hex} (based on ${count} pixels)`);
    } else {
      console.log('No matching purple pixels found.');
    }
  } catch (e) {
    console.error(e);
  }
}

run();
