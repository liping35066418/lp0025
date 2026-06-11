import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import { PATHS } from './config.js';
import { ImageStore, SimpleCache } from './store.js';

export function startCleanupTasks(imageStore: ImageStore, cache: SimpleCache) {
  cron.schedule('0 2 * * *', () => {
    console.log('[Cron] Running nightly cleanup at', new Date().toISOString());
    cleanupExpiredCache(cache);
    cleanupOrphanFiles(imageStore);
  });

  cron.schedule('*/15 * * * *', () => {
    cleanupExpiredCache(cache);
  });

  console.log('[Cron] Scheduled cleanup tasks started');
}

export function cleanupExpiredCache(cache: SimpleCache) {
  try {
    const removed = cache.cleanup();
    if (removed > 0) {
      console.log(`[Cleanup] Removed ${removed} expired cache entries`);
    }
    const cacheFiles = fs.readdirSync(PATHS.CACHE_DIR);
    const now = Date.now();
    let removedFiles = 0;
    for (const f of cacheFiles) {
      const filePath = path.join(PATHS.CACHE_DIR, f);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > 24 * 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
        removedFiles++;
      }
    }
    if (removedFiles > 0) {
      console.log(`[Cleanup] Removed ${removedFiles} expired cache files`);
    }
  } catch (e) {
    console.error('[Cleanup] Cache cleanup error:', e);
  }
}

export function cleanupOrphanFiles(imageStore: ImageStore) {
  try {
    const allImages = imageStore.getAll();
    const validPaths = new Set<string>();
    for (const img of allImages) {
      validPaths.add(path.resolve(img.path));
      validPaths.add(path.resolve(img.thumbnailPath));
    }

    let removed = 0;

    for (const f of fs.readdirSync(PATHS.UPLOAD_DIR)) {
      if (f === 'thumbnails') continue;
      const fullPath = path.join(PATHS.UPLOAD_DIR, f);
      if (!validPaths.has(fullPath) && fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
        removed++;
      }
    }

    for (const f of fs.readdirSync(PATHS.THUMBNAIL_DIR)) {
      const fullPath = path.join(PATHS.THUMBNAIL_DIR, f);
      if (!validPaths.has(fullPath)) {
        fs.unlinkSync(fullPath);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Cleanup] Removed ${removed} orphan image files`);
    }
  } catch (e) {
    console.error('[Cleanup] Orphan files cleanup error:', e);
  }
}
