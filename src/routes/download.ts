import { Router } from 'express';
import { downloadLimiter } from '../middleware/rateLimiter';
import { pipeAudioDownload, pipeVideoDownload } from '../utils/ytdlp';

const router = Router();

router.get('/audio/:videoId', downloadLimiter, (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: 'invalid_video_id' });
    return;
  }

  res.setHeader('Content-Disposition', `attachment; filename="${videoId}.mp3"`);
  pipeAudioDownload(videoId, res);
});

router.get('/video/:videoId', downloadLimiter, (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: 'invalid_video_id' });
    return;
  }

  res.setHeader('Content-Disposition', `attachment; filename="${videoId}.mp4"`);
  pipeVideoDownload(videoId, res);
});

export default router;
