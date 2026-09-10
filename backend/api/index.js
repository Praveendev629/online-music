import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { Readable } from 'stream';
import serverless from 'serverless-http';
import ytdl from '@distube/ytdl-core';
import ytSearch from 'yt-search';

// Load .env manually so cookie setup works regardless of shell quoting or
// where Node's --env-file support differs. Existing env vars win (e.g. Vercel).
function loadEnvFile(file = '.env') {
  if (!existsSync(file)) return;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('"') && line.endsWith('"')) line = line.slice(1, -1);
    if (line.startsWith("'") && line.endsWith("'")) line = line.slice(1, -1);
    if (line.startsWith('export ')) line = line.slice(7).trim();

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    const rawValue = line.slice(eq + 1).trim();
    if (!key) continue;

    let value = rawValue;
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Cache format URLs to avoid re-extracting for recent tracks. Persisted to
// disk so repeat downloads/streams are instant even after a server restart.
const streamCache = new Map();
const CACHE_FILE = new URL('./stream-cache.json', import.meta.url);

function loadCache() {
  try {
    if (!existsSync(CACHE_FILE)) return;
    const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    for (const [videoId, entry] of Object.entries(raw)) {
      if (entry.expiresAt > Date.now()) {
        streamCache.set(videoId, entry);
      }
    }
  } catch {
    // ignore corrupt/missing cache
  }
}

function persistCache() {
  try {
    const now = Date.now();
    const entries = {};
    for (const [videoId, entry] of streamCache) {
      if (entry.expiresAt > now) entries[videoId] = entry;
    }
    writeFileSync(CACHE_FILE, JSON.stringify(entries));
  } catch {
    // never crash because cache writes fail (e.g. read-only serverless fs)
  }
}

loadCache();

const YOUTUBE_COOKIE = (process.env.YOUTUBE_COOKIE || '').replace(/^["']|["']$/g, '').trim();

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const YTDLP_COMMANDS = [
  { cmd: 'python', args: ['-m', 'yt_dlp', '--js-runtimes', 'node', '-g', '-f', 'ba[ext=m4a]/ba[ext=webm]/ba'] },
  { cmd: 'python3', args: ['-m', 'yt_dlp', '--js-runtimes', 'node', '-g', '-f', 'ba[ext=m4a]/ba[ext=webm]/ba'] },
  { cmd: 'yt-dlp', args: ['--js-runtimes', 'node', '-g', '-f', 'ba[ext=m4a]/ba[ext=webm]/ba'] }
];

function runCommand(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { timeout: timeoutMs, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.trim() || `exit code ${code}`));
      }
    });
  });
}

async function fetchVideoInfo(videoUrl) {
  const headers = { 'user-agent': process.env.YOUTUBE_USER_AGENT || DEFAULT_UA };
  if (YOUTUBE_COOKIE) {
    headers.cookie = YOUTUBE_COOKIE;
  }
  return ytdl.getInfo(videoUrl, { requestOptions: { headers } });
}

// Extract via yt-dlp CLI. Only available on machines where it is installed
// (local dev). Not available on Vercel, where extraction falls back to the
// pure-Node implementation below.
async function sourceFromYtDlp(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  let lastError;

  for (const { cmd, args } of YTDLP_COMMANDS) {
    const commandArgs = [...args, url];
    if (YOUTUBE_COOKIE) {
      commandArgs.push('--add-header', `Cookie:${YOUTUBE_COOKIE}`);
    }
    try {
      const stdout = await runCommand(cmd, commandArgs, 30000);
      const streamUrl = stdout.trim().split('\n')[0];
      if (streamUrl && streamUrl.startsWith('http')) {
        return { url: streamUrl, mimeType: 'audio/mpeg' };
      }
    } catch (err) {
      lastError = err;
    }
  }

  const msg = (lastError && lastError.message) ? lastError.message : 'Unknown error';
  throw new Error(`yt-dlp extraction failed: ${msg}`);
}

async function sourceFromYtdlCore(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const info = await fetchVideoInfo(url);

  const audioOnly = info.formats.filter(f => f.hasAudio);
  // m4a (extension mp4) is not throttled by YouTube like opus/webm usually is
  const m4a = audioOnly.find(f => f.container === 'mp4');
  const format = m4a || audioOnly[0];

  if (!format || !format.url) {
    throw new Error('YouTube returned no playable audio formats (bot protection / po_token).');
  }

  return { url: format.url, mimeType: format.mimeType || 'audio/mpeg' };
}

async function getAudioSource(videoId) {
  const cached = streamCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.source;
  }

  let source;
  let ytDlpError;

  // yt-dlp first: it works on this machine and is faster than the pure-Node
  // path, which may silently fail and waste time before falling back.
  try {
    source = await sourceFromYtDlp(videoId);
  } catch (err) {
    ytDlpError = err.message;
  }

  if (!source) {
    try {
      source = await sourceFromYtdlCore(videoId);
    } catch (err) {
      throw new Error(ytDlpError ? `${ytDlpError} (also tried ytdl-core: ${err.message})` : err.message);
    }
  }

  streamCache.set(videoId, {
    source,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000
  });
  persistCache();
  return source;
}

const PASS_THROUGH_HEADERS = ['content-type', 'content-range', 'accept-ranges', 'content-length', 'etag'];

async function fetchStream(source, rangeHeader) {
  const headers = {
    'user-agent': process.env.YOUTUBE_USER_AGENT || DEFAULT_UA,
    'accept': '*/*'
  };
  if (YOUTUBE_COOKIE) {
    headers.cookie = YOUTUBE_COOKIE;
  }
  if (rangeHeader) {
    headers.range = rangeHeader;
  }
  return fetch(source.url, { headers });
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
    const source = await getAudioSource(videoId);
    const upstream = await fetchStream(source, req.headers.range);

    if (!upstream.ok) {
      console.error('Upstream stream error:', upstream.status, upstream.statusText);
      res.status(502).json({ error: `Upstream returned ${upstream.status}` });
      return;
    }

    res.status(upstream.status);
    for (const header of PASS_THROUGH_HEADERS) {
      const value = upstream.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to stream audio' });
    }
  }
});

// Download endpoint for offline audio playback
app.get('/api/download/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const title = (req.query.title || 'track').toString();
    const source = await getAudioSource(videoId);

    // On Vercel we cannot relay the whole file through a serverless function
    // (response size/time limits). Redirect straight to the CDN instead.
    if (process.env.VERCEL) {
      res.redirect(302, source.url);
      return;
    }

    const safeTitle = (title.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'track');
    res.setHeader('Content-Type', source.mimeType || 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(`${safeTitle}.mp3`)}"`);

    const audioRes = await fetchStream(source);
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch audio stream: ${audioRes.statusText}`);
    }

    for (const header of PASS_THROUGH_HEADERS) {
      const value = audioRes.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    }

    Readable.fromWeb(audioRes.body).pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to download audio file' });
    }
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Diagnostics - helps verify the cookie is loaded and what YouTube returns
app.get('/api/debug/info/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await fetchVideoInfo(url);
    const formats = info.formats;
    res.json({
      ok: true,
      cookieSet: Boolean(YOUTUBE_COOKIE),
      cookieLength: YOUTUBE_COOKIE.length,
      totalFormats: formats.length,
      audioFormats: formats.filter(f => f.hasAudio).length,
      audioWithUrl: formats.filter(f => f.hasAudio && f.url).length
    });
  } catch (error) {
    res.json({
      ok: false,
      cookieSet: Boolean(YOUTUBE_COOKIE),
      cookieLength: YOUTUBE_COOKIE.length,
      error: error.message
    });
  }
});

// Runs the FULL extraction pipeline (ytdl-core first, then yt-dlp fallback)
// to test whether streaming will actually work.
app.get('/api/debug/extract/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const source = await getAudioSource(videoId);
    res.json({
      ok: true,
      cookieSet: Boolean(YOUTUBE_COOKIE),
      hasUrl: Boolean(source.url),
      mimeType: source.mimeType,
      host: new URL(source.url).host
    });
  } catch (error) {
    res.json({
      ok: false,
      cookieSet: Boolean(YOUTUBE_COOKIE),
      error: error.message
    });
  }
});

if (!process.env.VERCEL) {
  console.log(`YOUTUBE_COOKIE set: ${Boolean(YOUTUBE_COOKIE)} (${YOUTUBE_COOKIE.length} chars)`);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default serverless(app);