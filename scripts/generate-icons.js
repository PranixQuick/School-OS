const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\master-1024.png';
const androidRes = 'C:\\Users\\ADMIN\\School-OS\\android\\app\\src\\main\\res';

const densities = {
  mdpi: { size: 48, foreground: 108 },
  hdpi: { size: 72, foreground: 162 },
  xhdpi: { size: 96, foreground: 216 },
  xxhdpi: { size: 144, foreground: 324 },
  xxxhdpi: { size: 192, foreground: 432 }
};

async function generateRoundMask(size) {
  const svg = `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="black"/></svg>`;
  return Buffer.from(svg);
}

async function run() {
  console.log(`Starting asset generation from ${src}...`);

  // 1. Play Store 512
  const playStorePath = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\play-store-512.png';
  await sharp(src)
    .resize(512, 512)
    .toFile(playStorePath);
  console.log(`[OK] Generated play-store-512.png: ${fs.statSync(playStorePath).size} bytes`);

  // 2. Web brand/icon-full-1024.png
  const webFullIconPath = 'C:\\Users\\ADMIN\\School-OS\\public\\brand\\icon-full-1024.png';
  await sharp(src)
    .resize(512, 512)
    .toFile(webFullIconPath);
  console.log(`[OK] Generated public/brand/icon-full-1024.png: ${fs.statSync(webFullIconPath).size} bytes`);

  // 3. Web brand/icon.png
  // 400x313 with contain (adds white background to fill the frame)
  const webIconPath = 'C:\\Users\\ADMIN\\School-OS\\public\\brand\\icon.png';
  await sharp(src)
    .resize({
      width: 400,
      height: 313,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toFile(webIconPath);
  console.log(`[OK] Generated public/brand/icon.png: ${fs.statSync(webIconPath).size} bytes`);

  // 4. Android launcher icons
  for (const [name, config] of Object.entries(densities)) {
    const dir = path.join(androidRes, `mipmap-${name}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // A. ic_launcher.png (legacy square launcher)
    const legacyPath = path.join(dir, 'ic_launcher.png');
    await sharp(src)
      .resize(config.size, config.size)
      .toFile(legacyPath);
    console.log(`[OK] Generated legacy launcher for ${name} (${config.size}x${config.size})`);

    // B. ic_launcher_round.png (legacy round launcher)
    const roundPath = path.join(dir, 'ic_launcher_round.png');
    const maskBuffer = await generateRoundMask(config.size);
    await sharp(src)
      .resize(config.size, config.size)
      .composite([{
        input: maskBuffer,
        blend: 'dest-in'
      }])
      .toFile(roundPath);
    console.log(`[OK] Generated round launcher for ${name} (${config.size}x${config.size})`);

    // C. ic_launcher_foreground.png (adaptive foreground)
    // Scale logo to ~61% of total foreground canvas width/height
    const forePath = path.join(dir, 'ic_launcher_foreground.png');
    const innerSize = Math.floor(config.foreground * 0.61);
    
    // Create inner scaled logo and apply round mask to make off-white corners transparent
    const foreMask = await generateRoundMask(innerSize);
    const innerLogoBuffer = await sharp(src)
      .resize(innerSize, innerSize)
      .composite([{
        input: foreMask,
        blend: 'dest-in'
      }])
      .toBuffer();

    // Composite centered on transparent background
    await sharp({
      create: {
        width: config.foreground,
        height: config.foreground,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{
      input: innerLogoBuffer,
      top: Math.floor((config.foreground - innerSize) / 2),
      left: Math.floor((config.foreground - innerSize) / 2)
    }])
    .png()
    .toFile(forePath);
    console.log(`[OK] Generated adaptive foreground for ${name} (${config.foreground}x${config.foreground})`);
  }

  console.log("Asset generation completed successfully.");
}

run().catch(err => {
  console.error("Error generating assets:", err);
  process.exit(1);
});
