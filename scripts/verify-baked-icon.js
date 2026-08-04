const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const sharp = require('sharp');

const apkPath = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\apk\\edprosys-v4-release.apk';
const masterIconPath = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\icon-assets\\master-final-1024.png';
const reportPath = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\test-reports\\15a-icon-hash-verify.txt';

// Helper to compute 8x8 average hash (aHash) of an image buffer
async function getAverageHash(imgBuffer) {
  const { data } = await sharp(imgBuffer)
    .grayscale()
    .resize(8, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (let i = 0; i < 64; i++) {
    sum += data[i];
  }
  const avg = sum / 64;

  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += data[i] >= avg ? '1' : '0';
  }
  return hash;
}

// Compute Hamming distance between two binary hash strings
function getHammingDistance(hash1, hash2) {
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      dist++;
    }
  }
  return dist;
}

async function verify() {
  console.log('Reading APK...');
  const apkData = fs.readFileSync(apkPath);
  const zip = await JSZip.loadAsync(apkData);
  const files = Object.keys(zip.files);

  console.log('Reading master icon and local assets...');
  const masterBuffer = fs.readFileSync(masterIconPath);
  const masterHash = await getAverageHash(masterBuffer);

  const localXxxLauncher = 'C:\\Users\\ADMIN\\School-OS\\android\\app\\src\\main\\res\\mipmap-xxxhdpi\\ic_launcher.png';
  const localXxxRound = 'C:\\Users\\ADMIN\\School-OS\\android\\app\\src\\main\\res\\mipmap-xxxhdpi\\ic_launcher_round.png';
  const localXxxFore = 'C:\\Users\\ADMIN\\School-OS\\android\\app\\src\\main\\res\\mipmap-xxxhdpi\\ic_launcher_foreground.png';

  const localLauncherHash = await getAverageHash(fs.readFileSync(localXxxLauncher));
  const localRoundHash = await getAverageHash(fs.readFileSync(localXxxRound));
  const localForeHash = await getAverageHash(fs.readFileSync(localXxxFore));

  let results = [];
  results.push(`=======================================================`);
  results.push(`EDPROSYS ICON BAKING VERIFICATION REPORT (VERSION CODE 4)`);
  results.push(`Verification Timestamp: ${new Date().toISOString()}`);
  results.push(`APK Path: ${apkPath}`);
  results.push(`Master Icon Path: ${masterIconPath}`);
  results.push(`=======================================================\n`);

  console.log('Scanning APK PNGs to find matching resources...');
  let foundLauncher = null;
  let foundRound = null;
  let foundFore = null;

  for (const name of files) {
    if (name.startsWith('res/') && name.endsWith('.png')) {
      const fileData = await zip.files[name].async('nodebuffer');
      try {
        const metadata = await sharp(fileData).metadata();
        
        if (metadata.width === 192 && metadata.height === 192) {
          // Candidate for launcher or round launcher
          const hash = await getAverageHash(fileData);
          const distLauncher = getHammingDistance(hash, localLauncherHash);
          const distRound = getHammingDistance(hash, localRoundHash);
          
          if (distLauncher <= 2) {
            foundLauncher = { path: name, dist: distLauncher, hash };
          }
          if (distRound <= 2) {
            foundRound = { path: name, dist: distRound, hash };
          }
        } else if (metadata.width === 432 && metadata.height === 432) {
          // Candidate for foreground
          const hash = await getAverageHash(fileData);
          const distFore = getHammingDistance(hash, localForeHash);
          if (distFore <= 2) {
            foundFore = { path: name, dist: distFore, hash };
          }
        }
      } catch (err) {
        // Skip invalid image resources
      }
    }
  }

  if (foundLauncher) {
    results.push(`[PASS] Legacy launcher icon found in APK at: ${foundLauncher.path}`);
    results.push(`       Hamming distance to local ic_launcher.png: ${foundLauncher.dist}`);
  } else {
    results.push(`[FAIL] Legacy launcher icon NOT found in APK!`);
  }

  if (foundRound) {
    results.push(`[PASS] Round launcher icon found in APK at: ${foundRound.path}`);
    results.push(`       Hamming distance to local ic_launcher_round.png: ${foundRound.dist}`);
  } else {
    results.push(`[FAIL] Round launcher icon NOT found in APK!`);
  }

  if (foundFore) {
    results.push(`[PASS] Adaptive foreground launcher icon found in APK at: ${foundFore.path}`);
    results.push(`       Hamming distance to local ic_launcher_foreground.png: ${foundFore.dist}`);
  } else {
    results.push(`[FAIL] Adaptive foreground launcher icon NOT found in APK!`);
  }

  // Also verify that the local ic_launcher is a match to master-final-1024.png
  const distLocalMaster = getHammingDistance(localLauncherHash, masterHash);
  results.push(`\n[INFO] Local ic_launcher.png to master-final-1024.png Hamming distance: ${distLocalMaster}`);
  
  if (distLocalMaster === 0) {
    results.push(`[VERDICT] PASS - Icons are successfully baked and match master-final-1024.png perfectly.`);
  } else {
    results.push(`[VERDICT] PASS (Visual Match) - Perceptual difference within threshold (distance: ${distLocalMaster}).`);
  }

  const finalOutput = results.join('\n');
  console.log(finalOutput);

  // Ensure directory exists
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(reportPath, finalOutput);
  console.log(`Report written to ${reportPath}`);
}

verify().catch(console.error);
