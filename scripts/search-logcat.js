const fs = require('fs');

const file = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\test-reports\\08-aaria-mic-logcat.txt';

function search() {
  const buf = fs.readFileSync(file);
  
  // Try UTF-8
  let str = buf.toString('utf8');
  if (str.includes('\u0000')) {
    // If it contains null bytes, it's likely UTF-16
    console.log('Detected UTF-16 encoding, decoding accordingly...');
    str = buf.toString('utf16le');
  }

  const queries = [
    'in.pranix.edprosys',
    'Permission',
    'getUserMedia',
    'RESOURCE_AUDIO_CAPTURE',
    'onPermissionRequest',
    'Audio',
    'microphone',
    'WebChromeClient'
  ];

  console.log(`Log file character count: ${str.length}`);
  
  for (const q of queries) {
    const regex = new RegExp(q, 'gi');
    const matches = str.match(regex);
    console.log(`Query "${q}": ${matches ? matches.length : 0} matches`);
    
    if (matches) {
      // Find a few matching lines
      const lines = str.split(/\r?\n/);
      let count = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q.toLowerCase())) {
          console.log(`  Line ${i+1}: ${lines[i].trim()}`);
          count++;
          if (count >= 5) break;
        }
      }
    }
  }
}

search();
