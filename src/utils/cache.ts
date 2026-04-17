import type { StreamInfo } from './ytdlp';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  set(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Math.floor(Date.now() / 1000) >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

// Stream URL cache — TTL is 5.5 hours (urls expire at 6hrs, give 30min buffer)
export const streamCache = new TTLCache<StreamInfo>();
const STREAM_TTL = 5.5 * 60 * 60;

export function getCachedStream(videoId: string): StreamInfo | undefined {
  return streamCache.get(videoId);
}

export function setCachedStream(videoId: string, info: StreamInfo): void {
  streamCache.set(videoId, info, STREAM_TTL);
}

// Metadata cache — titles/thumbnails don't expire
export const infoCache = new TTLCache<{ title: string; duration: number; thumbnail: string; uploader: string }>();
const INFO_TTL = 24 * 60 * 60;

export function getCachedInfo(videoId: string) {
  return infoCache.get(videoId);
}

export function setCachedInfo(videoId: string, info: { title: string; duration: number; thumbnail: string; uploader: string }) {
  infoCache.set(videoId, info, INFO_TTL);
}
