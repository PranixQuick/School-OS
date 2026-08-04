const sharp = require('sharp');

async function inspectStats() {
  try {
    const file = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\icon-purple-sat22-bri095.png';
    const image = sharp(file);
    const stats = await image.stats();
    console.log('Stats:', stats);
  } catch (e) {
    console.error(e);
  }
}

inspectStats();
