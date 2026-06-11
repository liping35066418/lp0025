import fs from 'node:fs';
import path from 'node:path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const CACHE_DIR = path.resolve(process.cwd(), 'cache');
const THUMBNAIL_DIR = path.resolve(UPLOAD_DIR, 'thumbnails');
const DATA_DIR = path.resolve(process.cwd(), 'data');

export const PATHS = {
  UPLOAD_DIR,
  CACHE_DIR,
  THUMBNAIL_DIR,
  DATA_DIR,
  IMAGES_JSON: path.join(DATA_DIR, 'images.json'),
  CACHE_JSON: path.join(DATA_DIR, 'cache.json'),
};

export function ensureDirs() {
  const dirs = [UPLOAD_DIR, CACHE_DIR, THUMBNAIL_DIR, DATA_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function readJSONFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function writeJSONFile<T>(filePath: string, data: T) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
