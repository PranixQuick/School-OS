const sharp = require('sharp');

const sat22Path = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\icon-purple-sat22-bri095.png';

async function run() {
  try {
    const { data, info } = await sharp(sat22Path).raw().toBuffer({ resolveWithObject: true });
    
    // Find unique non-grayscale colors
    const saturated = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max - min;
      
      if (sat > 30) {
        saturated.push({ r, g, b, sat });
      }
    }
    
    console.log(`Found ${saturated.length} saturated pixels.`);
    // Sort by saturation descending and print top 10 unique colors
    const unique = [];
    const seen = new Set();
    for (const p of saturated.sort((a,b) => b.sat - a.sat)) {
      const key = `${p.r},${p.g},${p.b}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
        if (unique.length >= 15) break;
      }
    }
    
    console.log('Top unique saturated colors in icon-purple-sat22-bri095.png:');
    unique.forEach(p => {
      console.log(`  RGB: (${p.r}, ${p.g}, ${p.b}) -> Saturation: ${p.sat}`);
    });
  } catch (e) {
    console.error(e);
  }
}

run();
