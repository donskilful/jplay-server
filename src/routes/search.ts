import { Router } from 'express';
import { streamLimiter } from '../middleware/rateLimiter';

const BASE = 'https://www.googleapis.com/youtube/v3';

const router = Router();

router.get('/', streamLimiter, async (req, res, next) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Number(req.query.limit) || 10, 25);

  if (!q) {
    res.status(400).json({ error: 'missing_query' });
    return;
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'youtube_api_not_configured' });
    return;
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q,
      type: 'video',
      videoCategoryId: '10',
      maxResults: String(limit),
      key,
    });

    const response = await fetch(`${BASE}/search?${params}`);
    if (!response.ok) {
      res.status(response.status).json({ error: 'youtube_api_error' });
      return;
    }

    const data = await response.json() as { items?: Array<{ id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } } } }> };
    const items = (data.items ?? []).filter(item => Boolean(item.id?.videoId));

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

export default router;
