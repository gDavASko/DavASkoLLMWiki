# Transcript Extraction Guide for YouTube

To analyze video materials, the AI agent must first extract the full text transcript (subtitles). Below are two main methods for downloading transcripts on Windows/macOS/Linux.

---

## Method 1. Node.js script with `youtube-transcript` (Recommended)

This method is the most reliable and fastest as it queries YouTube transcript endpoints directly.

### Step 1. Write the Node.js script
Create a script named `get_yt_transcript.js` in the conv scratch directory (`C:\Users\DavASko\.gemini\antigravity-ide\brain\<conv-id>\scratch/`):

```javascript
const { YoutubeTranscript } = require('youtube-transcript');
const fs = require('fs');

async function run() {
  const videoId = 'VIDEO_ID'; // E.g., for https://www.youtube.com/watch?v=2ZHHzfMSeWc ID is 2ZHHzfMSeWc
  try {
    console.log(`Fetching transcript for ${videoId}...`);
    // Fetch subtitles. Optional: Lang configuration (e.g. { lang: 'en' })
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    const formatted = transcript.map(t => {
      const startSec = Math.floor(t.offset / 1000);
      const minutes = Math.floor(startSec / 60);
      const seconds = Math.floor(startSec % 60).toString().padStart(2, '0');
      
      const text = t.text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#10;/g, ' ');

      return `[${minutes}:${seconds}] ${text}`;
    }).join('\n');
    
    fs.writeFileSync('transcript.txt', formatted, 'utf8');
    console.log('Transcript saved to transcript.txt. Lines:', transcript.length);
  } catch (error) {
    console.error('Error fetching transcript:', error);
  }
}

run();
```

### Step 2. Install dependencies and run
Install the library and run the script inside your scratch folder:
```bash
npm install youtube-transcript
node get_yt_transcript.js
```

---

## Method 2. Using `yt-dlp` CLI

If the Node.js library fails (e.g., due to rate-limiting or package issues), you can use the `yt-dlp` utility.

### Step 1. Get `yt-dlp` executable (if missing)
If `yt-dlp` is not installed on the system, download it to the workspace or scratch folder:
- Windows: `Invoke-WebRequest -Uri https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -OutFile C:\Users\DavASko\.gemini\antigravity-ide\brain\<conv-id>\scratch\yt-dlp.exe`

### Step 2. Run the subtitle extraction command
Run this command to download automatic subtitles in VTT/SRT format without fetching the actual video file:
```bash
yt-dlp.exe --write-auto-subs --skip-download --sub-lang en,ru -o "transcript" "VIDEO_URL"
```

This will save `transcript.en.vtt` or `transcript.ru.vtt`.

### Step 3. Clean VTT file from tags and timestamps
Write a simple Node.js or Python helper to strip out VTT header data, timing ranges, and duplicated lines.
Example script in Node.js to clean VTT subtitles:
```javascript
const fs = require('fs');
const content = fs.readFileSync('transcript.en.vtt', 'utf8');
const clean = content
  .replace(/WEBVTT[\s\S]*?\n\n/, '') // remove VTT header
  .replace(/\d\d:\d\d:\d\d\.\d\d\d --> \d\d:\d\d:\d\d\.\d\d\d.*\n/g, '') // remove timestamps
  .replace(/<[^>]*>/g, '') // remove HTML tags
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0)
  .join('\n');
fs.writeFileSync('clean_transcript.txt', clean, 'utf8');
```
