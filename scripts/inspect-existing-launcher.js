const sharp = require('sharp');

async function checkTransparency() {
  try {
    const file = 'C:\\Users\\ADMIN\\School-OS\\android\\app\\src\\main\\res\\mipmap-xxxhdpi\\ic_launcher_foreground.png';
    const image = sharp(file);
    const { hasAlpha } = await image.metadata();
    console.log(`hasAlpha: ${hasAlpha}`);
    
    // Get stats of the image
    const stats = await image.stats();
    console.log('Stats:', stats);
  } catch (e) {
    console.error(e);
  }
}

checkTransparency();
