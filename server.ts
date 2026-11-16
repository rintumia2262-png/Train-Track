import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import { createServer as createViteServer } from 'vite';
import {
  ChatMessage,
  INITIAL_CHAT_MESSAGES,
  LiveTrainState,
  TRAINS,
} from './src/data/railwayNetwork';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

// In-memory live train state + optional JSON persistence
const DATA_DIR = path.resolve(__dirname, '.data');
const STATE_FILE = path.join(DATA_DIR, 'bd_train_state.json');

const trainStates = new Map<string, LiveTrainState>();
const chatStore = new Map<string, ChatMessage[]>();
const sseClients = new Set<express.Response>();

function initializeDefaultState(): void {
  const now = Date.now();
  for (const train of TRAINS) {
    trainStates.set(train.id, {
      id: train.id,
      progress01: train.initialProgress01,
      speedKmh: train.initialSpeedKmh,
      delayMinutes: train.initialDelayMin,
      lastUpdatedAt: now - train.initialLastPingSecAgo * 1000,
      activeReporters: 3 + (train.number.charCodeAt(0) % 7),
      lastReporterLabelBn: 'অন-বোর্ড যাত্রী GPS',
      lastReporterLabelEn: 'On-board Passenger GPS',
    });
    chatStore.set(
      train.id,
      INITIAL_CHAT_MESSAGES.filter((m) => m.trainId === train.id)
    );
  }

  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as {
        chats?: Record<string, ChatMessage[]>;
      };
      if (raw.chats) {
        for (const [tid, msgs] of Object.entries(raw.chats)) {
          if (Array.isArray(msgs) && msgs.length > 0) {
            chatStore.set(tid, msgs.slice(-60));
          }
        }
      }
    }
  } catch {
    // Ignore read error
  }
}

function persistChatState(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const chats: Record<string, ChatMessage[]> = {};
    for (const [k, v] of chatStore.entries()) {
      chats[k] = v.slice(-60);
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify({ chats }, null, 2));
  } catch {
    // Ignore ephemeral filesystem errors
  }
}

function broadcastEvent(event: string, payload: unknown): void {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

initializeDefaultState();

// Gentle live train movement simulation along each corridor
setInterval(() => {
  const now = Date.now();
  for (const train of TRAINS) {
    const state = trainStates.get(train.id);
    if (!state) continue;

    const totalKm = train.stops[train.stops.length - 1]?.kmFromStart || 300;
    const kmPerSec = Math.max(8, state.speedKmh) / 3600;
    let nextProgress = state.progress01 + kmPerSec / totalKm;
    if (nextProgress >= 0.98) {
      nextProgress = 0.05;
    }

    // Subtle realistic speed fluctuation
    const jitter = Math.sin(now * 0.0005 + train.number.length) * 1.4;
    state.progress01 = nextProgress;
    state.speedKmh = Math.max(12, Math.min(92, Math.round(train.initialSpeedKmh + jitter)));
  }

  broadcastEvent('trains', Array.from(trainStates.values()));
}, 2000);

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'bd-train-track', trains: trainStates.size });
  });

  app.get('/api/trains', (_req, res) => {
    res.json({ trains: Array.from(trainStates.values()) });
  });

  // Same-origin cached map tile proxy (prevents browser CORS / network block AJAXError)
  const tileCache = new Map<string, { contentType: string; data: Buffer }>();
  const fallbackTileCache: Record<'satellite' | 'osm', Buffer | null> = {
    satellite: null,
    osm: null,
  };

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  const pngChunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    let crc = 0xffffffff;
    for (const byte of typeBuf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  const getFallbackTilePng = (mode: 'satellite' | 'osm'): Buffer => {
    const existing = fallbackTileCache[mode];
    if (existing) return existing;

    const size = 256;
    const raw = Buffer.alloc(size * (1 + size * 4));
    for (let y = 0; y < size; y++) {
      const rowOffset = y * (1 + size * 4);
      raw[rowOffset] = 0; // filter None
      for (let x = 0; x < size; x++) {
        const px = rowOffset + 1 + x * 4;
        if (mode === 'satellite') {
          const patch = (((x >> 4) * 31 + (y >> 4) * 17) & 7) * 3;
          raw[px] = 28 + patch;
          raw[px + 1] = 48 + patch;
          raw[px + 2] = 34 + Math.floor(patch / 2);
          raw[px + 3] = 255;
        } else {
          const isGrid = x % 64 === 0 || y % 64 === 0;
          raw[px] = isGrid ? 210 : 238;
          raw[px + 1] = isGrid ? 216 : 242;
          raw[px + 2] = isGrid ? 212 : 238;
          raw[px + 3] = 255;
        }
      }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    const idat = zlib.deflateSync(raw);
    const png = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', idat),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
    fallbackTileCache[mode] = png;
    return png;
  };

  const serveTile = async (
    mode: 'satellite' | 'osm',
    upstreamUrl: string,
    cacheKey: string,
    res: express.Response
  ) => {
    const cached = tileCache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached.data);
      return;
    }

    try {
      const upstream = await fetch(upstreamUrl, {
        headers: { 'User-Agent': 'BDTrainTrack/1.0 (+https://bdtraintrack.app)' },
        signal: AbortSignal.timeout(5000),
      });
      if (upstream.ok) {
        const contentType = upstream.headers.get('content-type') || 'image/png';
        const data = Buffer.from(await upstream.arrayBuffer());
        if (data.length > 0) {
          if (tileCache.size >= 500) {
            const oldestKey = tileCache.keys().next().value;
            if (oldestKey) tileCache.delete(oldestKey);
          }
          tileCache.set(cacheKey, { contentType, data });
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.send(data);
          return;
        }
      }
    } catch {
      // Upstream unreachable — fall through to procedural fallback tile
    }

    const fallback = getFallbackTilePng(mode);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(fallback);
  };

  app.get('/api/tiles/satellite/:z/:y/:x', async (req, res) => {
    const z = Number(req.params.z);
    const y = Number(req.params.y);
    const x = Number(req.params.x);
    if (!Number.isInteger(z) || !Number.isInteger(y) || !Number.isInteger(x) || z < 0 || z > 20) {
      res.status(400).end();
      return;
    }
    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    await serveTile('satellite', url, `sat:${z}/${y}/${x}`, res);
  });

  app.get('/api/tiles/osm/:z/:x/:y', async (req, res) => {
    const z = Number(req.params.z);
    const x = Number(req.params.x);
    const y = Number(req.params.y);
    if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 20) {
      res.status(400).end();
      return;
    }
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    await serveTile('osm', url, `osm:${z}/${x}/${y}`, res);
  });

  app.get('/api/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`event: trains\ndata: ${JSON.stringify(Array.from(trainStates.values()))}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Crowdsourced "I'm Inside Train" live GPS / station ping
  app.post('/api/trains/:id/ping', (req, res) => {
    const { id } = req.params;
    const state = trainStates.get(id);
    if (!state) {
      res.status(404).json({ error: 'Train not found' });
      return;
    }

    const { progress01, speedKmh, delayMinutes, reporterLabelBn, reporterLabelEn } = req.body as {
      progress01?: number;
      speedKmh?: number;
      delayMinutes?: number;
      reporterLabelBn?: string;
      reporterLabelEn?: string;
    };

    if (typeof progress01 === 'number' && !Number.isNaN(progress01)) {
      state.progress01 = Math.max(0.01, Math.min(0.99, progress01));
    }
    if (typeof speedKmh === 'number' && !Number.isNaN(speedKmh)) {
      state.speedKmh = Math.max(0, Math.min(120, Math.round(speedKmh)));
    }
    if (typeof delayMinutes === 'number' && !Number.isNaN(delayMinutes)) {
      state.delayMinutes = Math.max(0, Math.min(360, Math.round(delayMinutes)));
    }

    state.lastUpdatedAt = Date.now();
    state.activeReporters = Math.min(99, state.activeReporters + 1);
    if (reporterLabelBn) state.lastReporterLabelBn = String(reporterLabelBn).slice(0, 60);
    if (reporterLabelEn) state.lastReporterLabelEn = String(reporterLabelEn).slice(0, 60);

    broadcastEvent('trains', Array.from(trainStates.values()));
    res.json({ train: state });
  });

  // Train Passenger Community Chat
  app.get('/api/trains/:id/chat', (req, res) => {
    const { id } = req.params;
    res.json({ messages: chatStore.get(id) ?? [] });
  });

  app.post('/api/trains/:id/chat', (req, res) => {
    const { id } = req.params;
    if (!trainStates.has(id)) {
      res.status(404).json({ error: 'Train not found' });
      return;
    }

    const { author, coach, text } = req.body as {
      author?: string;
      coach?: string;
      text?: string;
    };

    const cleanText = String(text ?? '').trim().slice(0, 280);
    if (!cleanText) {
      res.status(400).json({ error: 'Message text is required' });
      return;
    }

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      trainId: id,
      author: String(author || 'যাত্রী').trim().slice(0, 32),
      coach: coach ? String(coach).trim().slice(0, 16) : undefined,
      text: cleanText,
      createdAt: Date.now(),
    };

    const existing = chatStore.get(id) ?? [];
    existing.push(message);
    chatStore.set(id, existing.slice(-60));
    persistChatState();

    broadcastEvent('chat', message);
    res.status(201).json({ message });
  });

  // Vite dev middleware or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BD Train Track server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
