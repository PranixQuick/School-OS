const fs = require('fs');

const file = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\test-reports\\08-aaria-mic-logcat.txt';

function search() {
  const buf = fs.readFileSync(file);
  let str = buf.toString('utf8');
  if (str.includes('\u0000')) {
    str = buf.toString('utf16le');
  }

  const lines = str.split(/\r?\n/);
  console.log(`Searching logs for "RecognitionService"...`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('recognitionservice') || line.toLowerCase().includes('speech') || line.toLowerCase().includes('audiorecord')) {
      console.log(`Line ${i+1}: ${line.trim()}`);
    }
  }
}

search();
