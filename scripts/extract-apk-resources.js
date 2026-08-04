const fs = require('fs');
const path = require('path');
const jszip = require('jszip');
const sharp = require('sharp');

const apkPath = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\apk\\edprosys-v4-release.apk';
const extractDir = path.join(__dirname, 'apk_extracted_icons');

async function run() {
  try {
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });
    
    console.log(`Loading APK: ${apkPath}`);
    const data = fs.readFileSync(apkPath);
    const zip = await jszip.loadAsync(data);
    
    console.log('Scanning ZIP entries...');
    const pngEntries = [];
    zip.forEach((relativePath, file) => {
      if (relativePath.endsWith('.png')) {
        pngEntries.push(file);
      }
    });
    
    console.log(`Found ${pngEntries.length} PNG files. Extracting and analyzing launcher candidates...`);
    
    for (const entry of pngEntries) {
      const buffer = await entry.async('nodebuffer');
      
      // Let's use sharp to inspect the size
      try {
        const img = sharp(buffer);
        const metadata = await img.metadata();
        
        // We are interested in mipmap icons. Typically sizes:
        // xxxhdpi: ic_launcher is 192x192, ic_launcher_round is 192x192, ic_launcher_foreground is 432x432
        const isCandidateSize = (metadata.width === 192 && metadata.height === 192) || 
                               (metadata.width === 432 && metadata.height === 432);
                               
        if (isCandidateSize || entry.name.includes('launcher') || entry.name.includes('icon')) {
          const destFile = path.join(extractDir, entry.name.replace(/\//g, '_'));
          fs.writeFileSync(destFile, buffer);
          
          const rawBuffer = await img.raw().toBuffer();
          const w = metadata.width;
          const h = metadata.height;
          const channels = metadata.channels;
          
          const centerIdx = (Math.floor(h / 2) * w + Math.floor(w / 2)) * channels;
          const cornerIdx = (1 * w + 1) * channels;
          
          const center = {
            r: rawBuffer[centerIdx],
            g: rawBuffer[centerIdx + 1],
            b: rawBuffer[centerIdx + 2],
            a: channels > 3 ? rawBuffer[centerIdx + 3] : 255
          };
          const corner = {
            r: rawBuffer[cornerIdx],
            g: rawBuffer[cornerIdx + 1],
            b: rawBuffer[cornerIdx + 2],
            a: channels > 3 ? rawBuffer[cornerIdx + 3] : 255
          };
          
          console.log(`Candidate: ${entry.name} (${w}x${h}) -> Center: R=${center.r},G=${center.g},B=${center.b},A=${center.a} | Corner: R=${corner.r},G=${corner.g},B=${corner.b},A=${corner.a}`);
        }
      } catch (err) {
        // Not a valid PNG or sharp failed
      }
    }
    
    console.log(`Done. Saved candidates to ${extractDir}`);
  } catch (e) {
    console.error(e);
  }
}

run();
