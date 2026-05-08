import { spawn } from 'child_process';

import { existsSync } from 'fs';
import { resolve } from 'path';

// On macOS with pip install, yt-dlp lands here; in Docker it's on PATH
const YTDLP_BIN = process.env.YTDLP_BIN ?? 'yt-dlp';

// Optional cookies file — set YTDLP_COOKIES to an absolute path or a path
// relative to the project root. Drop a Netscape-format cookies.txt exported
// from your browser to bypass YouTube's IP-based rate limiting.
const COOKIES_PATH = (() => {
  const raw = process.env.YTDLP_COOKIES;
  if (!raw) return null;
  const p = resolve(raw);
  return existsSync(p) ? p : null;
})();

if (COOKIES_PATH) {
  console.log(`[ytdlp] using cookies: ${COOKIES_PATH}`);
} else if (process.env.YTDLP_COOKIES) {
  console.warn(`[ytdlp] YTDLP_COOKIES set but file not found: ${process.env.YTDLP_COOKIES}`);
}

export interface StreamInfo {
  url: string;
  expiresAt: number;
  duration: number;
  title: string;
  thumbnail: string;
}

export interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
}

function runYtdlp(args: string[], timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_BIN, args);
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('yt-dlp timed out'));
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 300)}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

const YTDLP_BASE_ARGS = [
  '--no-playlist',
  '--extractor-args', 'youtube:player_client=tv_embedded,web',
  ...(COOKIES_PATH ? ['--cookies', COOKIES_PATH] : []),
];

export async function getAudioStreamUrl(videoId: string): Promise<StreamInfo> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const [streamUrl, rawJson] = await Promise.all([
    runYtdlp([
      ...YTDLP_BASE_ARGS,
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',
      '--get-url',
      url,
    ]),
    runYtdlp([
      ...YTDLP_BASE_ARGS,
      '--dump-json',
      '--skip-download',
      url,
    ]),
  ]);

  const info = JSON.parse(rawJson) as {
    title: string;
    duration: number;
    thumbnail: string;
  };

  // yt-dlp signed URLs typically expire in ~6 hours
  const expiresAt = Math.floor(Date.now() / 1000) + 6 * 60 * 60;

  return {
    url: streamUrl.split('\n')[0],
    expiresAt,
    duration: info.duration ?? 0,
    title: info.title ?? '',
    thumbnail: info.thumbnail ?? '',
  };
}

export async function getVideoInfo(videoId: string): Promise<VideoInfo> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const rawJson = await runYtdlp([
    ...YTDLP_BASE_ARGS,
    '--dump-json',
    '--skip-download',
    url,
  ]);

  const info = JSON.parse(rawJson) as {
    title: string;
    duration: number;
    thumbnail: string;
    uploader: string;
  };

  return {
    title: info.title ?? '',
    duration: info.duration ?? 0,
    thumbnail: info.thumbnail ?? '',
    uploader: info.uploader ?? '',
  };
}

export function pipeAudioDownload(videoId: string, res: import('express').Response): void {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const proc = spawn('yt-dlp', [
    '--no-playlist',
    '--format', 'bestaudio[ext=m4a]/bestaudio',
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '192K',
    '--output', '-',
    url,
  ]);

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Transfer-Encoding', 'chunked');
  proc.stdout.pipe(res);

  proc.stderr.on('data', (chunk: Buffer) => {
    console.error('[yt-dlp audio]', chunk.toString().slice(0, 200));
  });

  proc.on('error', () => res.destroy());
  res.on('close', () => proc.kill());
}

export function pipeVideoDownload(videoId: string, res: import('express').Response): void {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const proc = spawn('yt-dlp', [
    '--no-playlist',
    '--format', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
    '--merge-output-format', 'mp4',
    '--output', '-',
    url,
  ]);

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Transfer-Encoding', 'chunked');
  proc.stdout.pipe(res);

  proc.stderr.on('data', (chunk: Buffer) => {
    console.error('[yt-dlp video]', chunk.toString().slice(0, 200));
  });

  proc.on('error', () => res.destroy());
  res.on('close', () => proc.kill());
}

export async function getYtdlpVersion(): Promise<string> {
  try {
    return await runYtdlp(['--version'], 5000);
  } catch {
    return 'unavailable';
  }
}
