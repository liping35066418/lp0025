import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

import { ensureDirs, PATHS } from './config.js';
import { ImageStore, SimpleCache, RateLimiter } from './store.js';
import { AIEngine } from './ai-engine.js';
import { processImage, cropImage } from './image-processor.js';
import { SearchEngine } from './search-engine.js';
import { startCleanupTasks } from './cron-tasks.js';
import { ImageRecord, ImageTag, SearchResult } from './types.js';

ensureDirs();

const PORT = 8645;
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(PATHS.UPLOAD_DIR));

const imageStore = new ImageStore();
const cache = new SimpleCache();
const aiEngine = new AIEngine();
const globalLimiter = new RateLimiter(200, 60_000);
const uploadLimiter = new RateLimiter(30, 60_000);
const searchLimiter = new RateLimiter(100, 60_000);

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown';
}

function rateLimitMiddleware(limiter: RateLimiter, scope: string) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    const key = `${scope}:${getClientIp(req)}`;
    const result = limiter.check(key);
    res.setHeader('X-RateLimit-Limit', result.resetAt);
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    if (!result.allowed) {
      return res.status(429).json({ error: '请求过于频繁，请稍后再试', retryAfter: result.resetAt });
    }
    next();
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PATHS.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `tmp_${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只允许上传图片文件'));
  },
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.get('/api/stats', (req, res) => {
  const cacheKey = 'stats:main';
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const images = imageStore.getAll();
  const stats = {
    totalImages: images.length,
    totalSize: images.reduce((s, i) => s + i.size, 0),
    avgTags: images.length ? Math.round(images.reduce((s, i) => s + i.tags.length, 0) / images.length) : 0,
    userTagCount: images.reduce((s, i) => s + i.userTags.length, 0),
  };

  cache.set(cacheKey, stats, 60_000);
  res.json(stats);
});

app.post('/api/recognize',
  rateLimitMiddleware(uploadLimiter, 'upload'),
  upload.array('images', 50),
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: '没有上传文件' });
      }

      const cropped = req.body?.cropped ? (typeof req.body.cropped === 'string' ? JSON.parse(req.body.cropped) : req.body.cropped) : {};
      const results: Array<{ id: string; status: string; error?: string; record?: ImageRecord }> = [];

      for (const file of files) {
        try {
          const fileId = path.basename(file.originalname);
          const cropInfo = cropped[file.originalname];
          let processPath = file.path;
          let tmpCropped: string | null = null;

          if (cropInfo && cropInfo.x !== undefined) {
            tmpCropped = path.join(PATHS.UPLOAD_DIR, `crop_${uuidv4()}.jpg`);
            await cropImage(file.path, tmpCropped, {
              x: Math.round(cropInfo.x),
              y: Math.round(cropInfo.y),
              width: Math.round(cropInfo.width),
              height: Math.round(cropInfo.height),
            });
            processPath = tmpCropped;
          }

          const buffer = fs.readFileSync(processPath);
          const hash = aiEngine.computeHash(buffer);
          const existing = imageStore.findByHash(hash);
          if (existing) {
            results.push({ id: existing.id, status: 'duplicate', record: existing });
            if (tmpCropped) fs.unlinkSync(tmpCropped);
            fs.unlinkSync(file.path);
            continue;
          }

          const id = uuidv4();
          const ext = '.jpg';
          const processed = await processImage(processPath, id, ext);

          const recognition = aiEngine.recognize(buffer, file.originalname);

          const record: ImageRecord = {
            id,
            filename: path.basename(processed.compressedPath),
            originalName: file.originalname,
            path: processed.compressedPath,
            thumbnailPath: processed.thumbnailPath,
            mimeType: 'image/jpeg',
            size: processed.compressedSize,
            width: processed.width,
            height: processed.height,
            tags: recognition.tags,
            description: recognition.description,
            categories: recognition.categories,
            userTags: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            hash,
          };

          imageStore.add(record);
          cache.invalidate('stats');
          cache.invalidate('images');

          results.push({ id, status: 'ok', record });

          if (tmpCropped && fs.existsSync(tmpCropped)) fs.unlinkSync(tmpCropped);
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (err) {
          const message = err instanceof Error ? err.message : '处理失败';
          results.push({ id: file.originalname, status: 'error', error: message });
          if (fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch {}
          }
        }
      }

      res.json({ success: true, results, total: results.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '服务器错误' });
    }
  }
);

app.get('/api/images',
  rateLimitMiddleware(globalLimiter, 'global'),
  (req, res) => {
    const { page = '1', pageSize = '30' } = req.query;
    const cacheKey = `images:list:${page}:${pageSize}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const all = imageStore.getAll();
    const p = parseInt(page as string);
    const ps = parseInt(pageSize as string);
    const start = (p - 1) * ps;
    const items = all.slice(start, start + ps);
    const out = {
      items,
      total: all.length,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(all.length / ps),
    };
    cache.set(cacheKey, out, 30_000);
    res.json(out);
  }
);

app.get('/api/images/:id',
  rateLimitMiddleware(globalLimiter, 'global'),
  (req, res) => {
    const img = imageStore.get(req.params.id);
    if (!img) return res.status(404).json({ error: '图片不存在' });
    res.json(img);
  }
);

app.put('/api/images/:id',
  rateLimitMiddleware(globalLimiter, 'global'),
  (req, res) => {
    const { tags, description, categories, userTags, adjustTags } = req.body;
    const img = imageStore.get(req.params.id);
    if (!img) return res.status(404).json({ error: '图片不存在' });

    const updates: Partial<ImageRecord> = {};
    if (description !== undefined) updates.description = description;
    if (Array.isArray(categories)) updates.categories = categories;
    if (Array.isArray(userTags)) updates.userTags = userTags;
    if (Array.isArray(tags)) {
      updates.tags = tags.filter((t: ImageTag) => t.name && typeof t.confidence === 'number');
    }
    if (adjustTags && Array.isArray(adjustTags.add)) {
      const currentTags = updates.tags ?? img.tags;
      const tagNames = new Set(currentTags.map(t => t.name));
      for (const add of adjustTags.add) {
        if (!tagNames.has(add)) {
          currentTags.push({ name: add, confidence: 0.9, category: 'object' });
        }
      }
      if (Array.isArray(adjustTags.remove)) {
        updates.tags = currentTags.filter(t => !(adjustTags.remove as string[]).includes(t.name));
      } else {
        updates.tags = currentTags;
      }
    }

    const updated = imageStore.update(req.params.id, updates);
    cache.invalidate('images');
    cache.invalidate('search');
    res.json({ success: true, data: updated });
  }
);

app.post('/api/images/batch-update',
  rateLimitMiddleware(globalLimiter, 'global'),
  (req, res) => {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '缺少ids' });
    }
    const safeUpdates: Partial<ImageRecord> = {};
    if (Array.isArray(updates?.categories)) safeUpdates.categories = updates.categories;
    if (Array.isArray(updates?.userTags)) safeUpdates.userTags = updates.userTags;
    if (updates?.description) safeUpdates.description = updates.description;

    imageStore.batchUpdate(ids, safeUpdates);
    cache.invalidate('images');
    cache.invalidate('search');
    res.json({ success: true, updated: ids.length });
  }
);

app.delete('/api/images/:id', (req, res) => {
  const img = imageStore.get(req.params.id);
  if (!img) return res.status(404).json({ error: '图片不存在' });
  try {
    if (fs.existsSync(img.path)) fs.unlinkSync(img.path);
    if (fs.existsSync(img.thumbnailPath)) fs.unlinkSync(img.thumbnailPath);
  } catch {}
  imageStore.delete(req.params.id);
  cache.invalidate('images');
  cache.invalidate('stats');
  cache.invalidate('search');
  res.json({ success: true });
});

app.get('/api/search',
  rateLimitMiddleware(searchLimiter, 'search'),
  (req, res) => {
    const { q, tags, categories, type = 'combined', limit = '50' } = req.query;
    const cacheKey = `search:${type}:${q}:${tags}:${categories}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const all = imageStore.getAll();
    const engine = new SearchEngine(all);
    let results: SearchResult[] = [];

    if (type === 'tag' && tags) {
      const tagArr = (tags as string).split(',').filter(Boolean);
      results = engine.searchByTags(tagArr);
    } else if (type === 'keyword' && q) {
      results = engine.searchByDescription(q as string);
    } else if (type === 'combined') {
      results = engine.searchCombined({
        tags: tags ? (tags as string).split(',').filter(Boolean) : undefined,
        keyword: q as string,
        categories: categories ? (categories as string).split(',').filter(Boolean) : undefined,
      });
    }

    const lim = parseInt(limit as string);
    const out = { results: results.slice(0, lim), total: results.length };
    cache.set(cacheKey, out, 45_000);
    res.json(out);
  }
);

app.get('/api/search/similar/:id',
  rateLimitMiddleware(searchLimiter, 'search'),
  (req, res) => {
    const { limit = '20' } = req.query;
    const cacheKey = `similar:${req.params.id}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const img = imageStore.get(req.params.id);
    if (!img) return res.status(404).json({ error: '图片不存在' });

    const engine = new SearchEngine(imageStore.getAll());
    const results = engine.searchBySimilar(img, parseInt(limit as string));
    const out = { results, total: results.length, queryImage: img };
    cache.set(cacheKey, out, 60_000);
    res.json(out);
  }
);

app.get('/api/tags',
  rateLimitMiddleware(globalLimiter, 'global'),
  (req, res) => {
    const cacheKey = 'meta:tags';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);
    const engine = new SearchEngine(imageStore.getAll());
    const tags = engine.getAllTags();
    cache.set(cacheKey, tags, 120_000);
    res.json(tags);
  }
);

app.get('/api/categories',
  rateLimitMiddleware(globalLimiter, 'global'),
  (req, res) => {
    const cacheKey = 'meta:categories';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);
    const engine = new SearchEngine(imageStore.getAll());
    const cats = engine.getAllCategories();
    cache.set(cacheKey, cats, 120_000);
    res.json(cats);
  }
);

app.use((err: Error, req: Request, res: Response, _next: unknown) => {
  console.error('[Error]', err.message);
  if (err.message.includes('too large')) {
    return res.status(413).json({ error: '文件过大（最大20MB）' });
  }
  if (err.message.includes('只允许')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: '服务器内部错误' });
});

startCleanupTasks(imageStore, cache);

app.listen(PORT, () => {
  console.log(`🚀 图像AI识别服务启动: http://localhost:${PORT}`);
  console.log(`📁 上传目录: ${PATHS.UPLOAD_DIR}`);
  console.log(`🗂️  数据目录: ${PATHS.DATA_DIR}`);
});
