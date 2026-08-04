const sharp = require('sharp');

const file = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\icon-purple-sat22-bri095.png';

async function run() {
  try {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    
    const colorCounts = {};
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      // Skip white and off-white/light gray
      if (r > 230 && g > 230 && b > 230) continue;
      
      const key = `${r},${g},${b}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
    }
    
    // Sort by count descending
    const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
    
    console.log('Most common colors (excluding white/off-white):');
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      console.log(`  Color: ${sorted[i][0]} -> Count: ${sorted[i][1]}`);
    }
  } catch (e) {
    console.error(e);
  }
}

run();
