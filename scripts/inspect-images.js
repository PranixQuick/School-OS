const sharp = require('sharp');
const path = require('path');

const files = [
  'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\master-final-1024.png',
  'C:\\Users\\ADMIN\\School-OS\\android\\app\\src\\main\\res\\mipmap-xxxhdpi\\ic_launcher.png',
  'C:\\Users\\ADMIN\\School-OS\\android\\app\\src\\main\\res\\mipmap-xxxhdpi\\ic_launcher_round.png',
  'C:\\Users\\ADMIN\\School-OS\\android\\app\\src\\main\\res\\mipmap-xxxhdpi\\ic_launcher_foreground.png',
  'C:\\Users\\ADMIN\\School-OS\\public\\brand\\icon.png',
  'C:\\Users\\ADMIN\\School-OS\\public\\brand\\icon-full-1024.png'
];

async function inspect() {
  for (const file of files) {
    try {
      const meta = await sharp(file).metadata();
      console.log(`${path.basename(file)}: ${meta.width}x${meta.height}, format: ${meta.format}`);
    } catch (e) {
      console.log(`Error reading ${file}: ${e.message}`);
    }
  }
}

inspect();
