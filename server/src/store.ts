import { ImageRecord, CacheEntry } from './types.js';
import { PATHS, readJSONFile, writeJSONFile } from './config.js';

export class ImageStore {
  private images: Map<string, ImageRecord> = new Map();

  constructor() {
    this.load();
  }

  private load() {
    const arr = readJSONFile<ImageRecord[]>(PATHS.IMAGES_JSON, []);
    this.images = new Map(arr.map(img => [img.id, img]));
  }

  private persist() {
    writeJSONFile(PATHS.IMAGES_JSON, Array.from(this.images.values()));
  }

  add(record: ImageRecord) {
    this.images.set(record.id, record);
    this.persist();
  }

  get(id: string): ImageRecord | undefined {
    return this.images.get(id);
  }

  getAll(): ImageRecord[] {
    return Array.from(this.images.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  update(id: string, updates: Partial<ImageRecord>) {
    const img = this.images.get(id);
    if (img) {
      const updated: ImageRecord = { ...img, ...updates, updatedAt: Date.now() };
      this.images.set(id, updated);
      this.persist();
      return updated;
    }
    return undefined;
  }

  delete(id: string): boolean {
    const deleted = this.images.delete(id);
    if (deleted) this.persist();
    return deleted;
  }

  findByHash(hash: string): ImageRecord | undefined {
    for (const img of this.images.values()) {
      if (img.hash === hash) return img;
    }
    return undefined;
  }

  batchUpdate(ids: string[], updates: Partial<ImageRecord>) {
    for (const id of ids) {
      const img = this.images.get(id);
      if (img) {
        this.images.set(id, { ...img, ...updates, updatedAt: Date.now() });
      }
    }
    this.persist();
  }
}

export class SimpleCache {
  private store: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTtl = 5 * 60 * 1000;
  private dirty = false;
  private persistInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly PERSIST_INTERVAL_MS = 30_000;

  constructor() {
    this.load();
    this.startAutoPersist();
  }

  private load() {
    const obj = readJSONFile<Record<string, CacheEntry<unknown>>>(PATHS.CACHE_JSON, {});
    this.store = new Map(Object.entries(obj));
    this.cleanup();
    this.dirty = false;
  }

  private startAutoPersist() {
    this.persistInterval = setInterval(() => {
      if (this.dirty) {
        this.persist();
      }
    }, SimpleCache.PERSIST_INTERVAL_MS);
    this.persistInterval.unref?.();
  }

  private persist() {
    const obj: Record<string, CacheEntry<unknown>> = {};
    for (const [k, v] of this.store.entries()) obj[k] = v;
    writeJSONFile(PATHS.CACHE_JSON, obj);
    this.dirty = false;
  }

  set<T>(key: string, data: T, ttl?: number) {
    const t = ttl ?? this.defaultTtl;
    this.store.set(key, {
      data,
      expiresAt: Date.now() + t,
      createdAt: Date.now(),
    });
    this.dirty = true;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.dirty = true;
      return null;
    }
    return entry.data as T;
  }

  invalidate(pattern: string) {
    let changed = false;
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
        changed = true;
      }
    }
    if (changed) this.dirty = true;
  }

  cleanup() {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        count++;
      }
    }
    if (count > 0) this.dirty = true;
    return count;
  }

  flush() {
    if (this.dirty) {
      this.persist();
    }
  }

  shutdown() {
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
      this.persistInterval = null;
    }
    this.flush();
  }
}

export class RateLimiter {
  private windows: Map<string, { count: number; resetAt: number }> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 100, windowMs = 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number; limit: number } {
    const now = Date.now();
    let entry = this.windows.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
    }

    entry.count++;
    this.windows.set(key, entry);

    const allowed = entry.count <= this.maxRequests;
    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetAt: entry.resetAt,
      limit: this.maxRequests,
    };
  }
}
