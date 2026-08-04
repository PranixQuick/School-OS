const fs = require('fs');

const file = 'C:\\Users\\ADMIN\\OneDrive\\Desktop\\Pranix-Release\\EdProSys\\test-reports\\08-aaria-mic-logcat.txt';

function getUniqueTags() {
  const buf = fs.readFileSync(file);
  let str = buf.toString('utf8');
  if (str.includes('\u0000')) {
    str = buf.toString('utf16le');
  }

  const lines = str.split(/\r?\n/);
  const tags = new Set();
  
  for (const line of lines) {
    // Typical log line format:
    // 08-03 11:32:30.370  1962  2450 D TagName  : Message
    // Let's match: D TagName  :
    const match = line.match(/[VDIWEF]\s+([A-Za-z0-9_\-\.]+)\s*:/);
    if (match) {
      tags.add(match[1]);
    }
  }
  
  console.log('Unique tags found in logcat:', Array.from(tags).sort().slice(0, 100));
  console.log('Total unique tags:', tags.size);
  
  // Search for any tags containing Console, Web, Cap, Chrome, Browser
  const matchingTags = Array.from(tags).filter(t => 
    /console|web|cap|chrome|browser|audio|media|mic|permission/i.test(t)
  );
  console.log('Matching tags of interest:', matchingTags);
}

getUniqueTags();
