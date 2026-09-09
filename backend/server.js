import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import ytSearch from 'yt-search';

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Cache stream URLs to avoid re-extracting for recent tracks
const streamCache = new Map();

async function getAudioStreamUrl(videoId) {
  const cached = streamCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const commands = [
    `python -m yt_dlp --js-runtimes node -g -f "ba[ext=m4a]/ba[ext=webm]/ba" "${url}"`,
    `python3 -m yt_dlp --js-runtimes node -g -f "ba[ext=m4a]/ba[ext=webm]/ba" "${url}"`,
    `yt-dlp --js-runtimes node -g -f "ba[ext=m4a]/ba[ext=webm]/ba" "${url}"`
  ];

  let lastError;
  for (const cmd of commands) {
    try {
      const { stdout } = await execAsync(cmd, { timeout: 15000 });
      const streamUrl = stdout.trim().split('\n')[0];
      if (streamUrl && streamUrl.startsWith('http')) {
        streamCache.set(videoId, {
          url: streamUrl,
          expiresAt: Date.now() + 2 * 60 * 60 * 1000
        });
        return streamUrl;
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Failed to extract audio stream: ${lastError?.message || 'Unknown error'}`);
}

// Search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const results = await ytSearch(q);
    
    const videos = results.videos.map(video => ({
      id: video.videoId,
      title: video.title,
      author: video.author.name,
      thumbnail: video.thumbnail,
      duration: video.duration.timestamp,
      views: video.views,
      url: video.url
    }));

    res.json({ videos });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search videos' });
  }
});

// Audio stream endpoint
app.get('/api/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const streamUrl = await getAudioStreamUrl(videoId);
    res.redirect(302, streamUrl);
  } catch (error) {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream audio' });
    }
  }
});

// Download endpoint for offline audio playback
app.get('/api/download/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const streamUrl = await getAudioStreamUrl(videoId);
    res.redirect(302, streamUrl);
  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download audio file' });
    }
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
