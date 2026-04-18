import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'devices.json');

interface DeviceRecord {
  deviceId: string;
  platform: string;
  registeredAt: string;
}

function load(): DeviceRecord[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as DeviceRecord[];
  } catch {
    return [];
  }
}

function save(records: DeviceRecord[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
}

router.post('/', (req, res) => {
  const { deviceId, platform } = req.body as { deviceId?: string; platform?: string };

  if (!deviceId || typeof deviceId !== 'string') {
    res.status(400).json({ error: 'missing_device_id' });
    return;
  }

  const records = load();
  const existing = records.find(r => r.deviceId === deviceId);

  if (!existing) {
    records.push({ deviceId, platform: platform ?? 'unknown', registeredAt: new Date().toISOString() });
    save(records);
  }

  res.json({ ok: true, total: records.length, isNew: !existing });
});

router.get('/stats', (req, res) => {
  const records = load();
  const byPlatform = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.platform] = (acc[r.platform] ?? 0) + 1;
    return acc;
  }, {});

  res.json({
    total: records.length,
    byPlatform,
    latest: records.slice(-5).reverse().map(r => ({ platform: r.platform, registeredAt: r.registeredAt })),
  });
});

export default router;
