import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { PATHS } from './config.js';

export interface ProcessResult {
  compressedPath: string;
  thumbnailPath: string;
  width: number;
  height: number;
  compressedSize: number;
}

export async function processImage(
  inputPath: string,
  id: string,
  ext: string
): Promise<ProcessResult> {
  const compressedName = `${id}${ext}`;
  const thumbnailName = `${id}_thumb${ext}`;
  const compressedPath = path.join(PATHS.UPLOAD_DIR, compressedName);
  const thumbnailPath = path.join(PATHS.THUMBNAIL_DIR, thumbnailName);

  const metadata = await sharp(inputPath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const targetWidth = Math.min(width, 1920);
  const targetHeight = Math.min(height, 1080);

  await sharp(inputPath)
    .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true })
    .toFile(compressedPath);

  await sharp(inputPath)
    .resize(300, 300, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toFile(thumbnailPath);

  const stat = fs.statSync(compressedPath);

  return {
    compressedPath,
    thumbnailPath,
    width,
    height,
    compressedSize: stat.size,
  };
}

export async function cropImage(
  inputPath: string,
  outputPath: string,
  options: { x: number; y: number; width: number; height: number }
): Promise<string> {
  await sharp(inputPath)
    .extract({ left: options.x, top: options.y, width: options.width, height: options.height })
    .jpeg({ quality: 90 })
    .toFile(outputPath);
  return outputPath;
}
