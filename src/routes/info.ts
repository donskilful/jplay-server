import { Router } from 'express';
import { streamLimiter } from '../middleware/rateLimiter';
import { getVideoInfo } from '../utils/ytdlp';
import { getCachedInfo, setCachedInfo } from '../utils/cache';

const router = Router();

router.get('/:videoId', streamLimiter, async (req, res, next) => {
  const { videoId } = req.params;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: 'invalid_video_id' });
    return;
  }

  try {
    const cached = getCachedInfo(videoId);
    if (cached) {
      res.json(cached);
      return;
    }

    const info = await getVideoInfo(videoId);
    setCachedInfo(videoId, info);
    res.json(info);
  } catch (err) {
    next(err);
  }
});

export default router;
