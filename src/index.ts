import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import streamRouter from './routes/stream';
import downloadRouter from './routes/download';
import infoRouter from './routes/info';
import { errorHandler } from './middleware/errorHandler';
import { getYtdlpVersion } from './utils/ytdlp';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  const ytdlp = await getYtdlpVersion();
  res.json({ ok: true, ytdlp });
});

app.use('/stream', streamRouter);
app.use('/download', downloadRouter);
app.use('/info', infoRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`jplay-server running on port ${PORT}`);
});
