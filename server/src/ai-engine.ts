import sharp from 'sharp';
import { ImageTag } from './types.js';

const OBJECT_TAGS = [
  { name: '人物', keywords: ['人', '脸', '物'] },
  { name: '汽车', keywords: ['车', '轿', 'suv'] },
  { name: '建筑', keywords: ['楼', '房', '塔', '城'] },
  { name: '动物', keywords: ['猫', '狗', '鸟', '兽', '马'] },
  { name: '食物', keywords: ['菜', '饭', '面', '果', '肉'] },
  { name: '植物', keywords: ['树', '花', '草', '叶'] },
  { name: '电子产品', keywords: ['手机', '电脑', '屏', '键盘'] },
  { name: '家具', keywords: ['桌', '椅', '床', '柜'] },
  { name: '服装', keywords: ['衣', '裙', '裤', '鞋', '帽'] },
  { name: '工具', keywords: ['刀', '剪', '锤', '笔'] },
  { name: '运动器材', keywords: ['球', '拍', '杆'] },
  { name: '艺术品', keywords: ['画', '雕', '塑'] },
];

const SCENE_TAGS = [
  { name: '户外', keywords: ['天', '山', '海', '路', '公园', '街道'] },
  { name: '室内', keywords: ['房间', '客厅', '卧室', '厨房'] },
  { name: '海滩', keywords: ['沙滩', '海', '浪'] },
  { name: '森林', keywords: ['树', '森', '林', '木'] },
  { name: '城市', keywords: ['楼', '街', '市', '城'] },
  { name: '山脉', keywords: ['山', '峰', '岭'] },
  { name: '夜景', keywords: ['灯', '夜', '星', '月'] },
  { name: '雪景', keywords: ['雪', '冰', '霜'] },
  { name: '日落', keywords: ['日落', '夕阳', '黄昏'] },
  { name: '办公室', keywords: ['办公', '会议', '工作'] },
];

const COLOR_TAGS = ['红色', '蓝色', '绿色', '黄色', '黑色', '白色', '灰色', '橙色', '紫色', '粉色', '棕色', '多彩'];
const STYLE_TAGS = ['写实', '艺术', '复古', '现代', '简约', '华丽', '卡通', '摄影', '插画', '抽象'];

interface DominantColor {
  r: number;
  g: number;
  b: number;
  percentage: number;
  colorName: string;
}

interface RegionStats {
  brightness: number;
  saturation: number;
  r: number;
  g: number;
  b: number;
  colorName: string;
}

interface ImageFeatures {
  brightness: number;
  saturation: number;
  dominantColor: { r: number; g: number; b: number };
  dominantColors: DominantColor[];
  colorfulness: number;
  aspectRatio: number;
  isDark: boolean;
  isBright: boolean;
  isGrayscale: boolean;
  edgeDensity: number;
  regions: RegionStats[][];
  brightnessHistogram: number[];
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;

  if (diff !== 0) {
    switch (max) {
      case r: h = ((g - b) / diff) % 6; break;
      case g: h = (b - r) / diff + 2; break;
      case b: h = (r - g) / diff + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

function hsvDistance(h1: number, s1: number, v1: number, h2: number, s2: number, v2: number): number {
  const dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2)) / 180;
  const ds = Math.abs(s1 - s2);
  const dv = Math.abs(v1 - v2) / 255;
  return dh * 0.5 + ds * 0.3 + dv * 0.2;
}

function rgbToColorName(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  if (max < 40) return '黑色';
  if (min > 220) return '白色';

  const saturation = max === 0 ? 0 : diff / max;
  const value = max / 255;
  if (saturation < 0.12) {
    if (max < 85) return '黑色';
    if (max > 205) return '白色';
    return '灰色';
  }

  const { h } = rgbToHsv(r, g, b);

  const isBluishRed = b > g * 1.015 && saturation < 0.48;

  if (h >= 340 || h < 15) {
    if (isBluishRed) return '紫色';
    return '红色';
  }
  if (h >= 15 && h < 40) return '橙色';
  if (h >= 40 && h < 70) return '黄色';
  if (h >= 70 && h < 160) return '绿色';
  if (h >= 160 && h < 195) return '青色';
  if (h >= 195 && h < 250) return '蓝色';

  if (h >= 250 && h < 320) return '紫色';
  if (h >= 320 && h < 340) {
    if (saturation < 0.4 || value < 0.78) return '紫色';
    return '粉色';
  }
  if (h >= 340 && h < 345) {
    if (isBluishRed) return '紫色';
    return '粉色';
  }

  const rRatio = r / (r + g + b + 1);
  const gRatio = g / (r + g + b + 1);
  if (rRatio > 0.4 && gRatio > 0.28) return '棕色';
  return '棕色';
}

function quantizeColor(r: number, g: number, b: number): string {
  const step = 32;
  const qr = Math.min(Math.floor(r / step) * step, 224);
  const qg = Math.min(Math.floor(g / step) * step, 224);
  const qb = Math.min(Math.floor(b / step) * step, 224);
  return `${qr},${qg},${qb}`;
}

function computeRegionStats(
  pixels: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  startX: number,
  startY: number,
  w: number,
  h: number
): RegionStats {
  let rSum = 0, gSum = 0, bSum = 0;
  let satSum = 0;
  let count = 0;

  for (let y = startY; y < startY + h && y < imgH; y++) {
    for (let x = startX; x < startX + w && x < imgW; x++) {
      const idx = (y * imgW + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      rSum += r; gSum += g; bSum += b;
      const { s } = rgbToHsv(r, g, b);
      satSum += s;
      count++;
    }
  }

  const rMean = rSum / Math.max(count, 1);
  const gMean = gSum / Math.max(count, 1);
  const bMean = bSum / Math.max(count, 1);
  const brightness = (rMean + gMean + bMean) / 3;
  const saturation = satSum / Math.max(count, 1);

  return {
    brightness,
    saturation,
    r: rMean,
    g: gMean,
    b: bMean,
    colorName: rgbToColorName(rMean, gMean, bMean),
  };
}

function computeEdgeDensity(
  pixels: Uint8ClampedArray,
  imgW: number,
  imgH: number
): number {
  let edgeCount = 0;
  let totalCount = 0;
  const threshold = 35;

  for (let y = 1; y < imgH - 1; y++) {
    for (let x = 1; x < imgW - 1; x++) {
      const idx = (y * imgW + x) * 4;
      const gray = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];

      const leftIdx = (y * imgW + x - 1) * 4;
      const grayLeft = 0.299 * pixels[leftIdx] + 0.587 * pixels[leftIdx + 1] + 0.114 * pixels[leftIdx + 2];

      const topIdx = ((y - 1) * imgW + x) * 4;
      const grayTop = 0.299 * pixels[topIdx] + 0.587 * pixels[topIdx + 1] + 0.114 * pixels[topIdx + 2];

      const diff = Math.abs(gray - grayLeft) + Math.abs(gray - grayTop);
      if (diff > threshold) edgeCount++;
      totalCount++;
    }
  }

  return edgeCount / Math.max(totalCount, 1);
}

export class AIEngine {
  async recognize(fileBuffer: Uint8Array, filename: string): Promise<{
    tags: ImageTag[];
    description: string;
    categories: string[];
  }> {
    const tags: ImageTag[] = [];
    const features = await this.extractFeatures(fileBuffer);

    const colorTags = this.deriveColorTags(features);
    for (const c of colorTags) {
      tags.push({ name: c.name, confidence: c.confidence, category: 'color' });
    }

    const sceneTags = this.deriveSceneTags(features);
    for (const s of sceneTags) {
      tags.push({ name: s.name, confidence: s.confidence, category: 'scene' });
    }

    const objectTags = this.deriveObjectTags(features, filename);
    for (const o of objectTags) {
      tags.push({ name: o.name, confidence: o.confidence, category: 'object' });
    }

    const styleTags = this.deriveStyleTags(features);
    for (const s of styleTags) {
      tags.push({ name: s.name, confidence: s.confidence, category: 'style' });
    }

    tags.sort((a, b) => b.confidence - a.confidence);

    const topTags = tags.slice(0, 3).map(t => t.name).join('、');
    const topScene = tags.find(t => t.category === 'scene')?.name ?? '场景';
    const topObject = tags.find(t => t.category === 'object')?.name ?? '主体';
    const topStyle = tags.find(t => t.category === 'style')?.name ?? '独特';

    const descriptions = [
      `这是一张包含${topTags}的${topScene}照片`,
      `画面以${topTags}为主，呈现${topStyle}的视觉风格`,
      `展现了${topScene}中的${topTags}元素`,
      `构图中${topTags}的${topObject}十分突出`,
    ];
    const description = descriptions[Math.floor(Math.random() * descriptions.length)];

    const categories = [
      ...sceneTags.map(s => s.name),
      ...objectTags.slice(0, 1).map(o => o.name),
    ];

    return { tags, description, categories };
  }

  private async extractFeatures(buffer: Uint8Array): Promise<ImageFeatures> {
    const ANALYSIS_SIZE = 100;
    const REGION_GRID = 3;

    const resized = await sharp(Buffer.from(buffer))
      .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8ClampedArray(resized.data);
    const imgW = resized.info.width;
    const imgH = resized.info.height;

    const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number }>();
    let rSum = 0, gSum = 0, bSum = 0;
    let satSum = 0;
    let rSqSum = 0, gSqSum = 0, bSqSum = 0;
    const brightnessHistogram = new Array(10).fill(0);

    const pixelCount = imgW * imgH;
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      rSum += r; gSum += g; bSum += b;
      rSqSum += r * r; gSqSum += g * g; bSqSum += b * b;

      const { s } = rgbToHsv(r, g, b);
      satSum += s;

      const brightness = (r + g + b) / 3;
      const histIdx = Math.min(Math.floor(brightness / 25.6), 9);
      brightnessHistogram[histIdx]++;

      const key = quantizeColor(r, g, b);
      const existing = colorBuckets.get(key);
      if (existing) {
        existing.r += r;
        existing.g += g;
        existing.b += b;
        existing.count++;
      } else {
        colorBuckets.set(key, { r, g, b, count: 1 });
      }
    }

    const rMean = rSum / pixelCount;
    const gMean = gSum / pixelCount;
    const bMean = bSum / pixelCount;

    const rVar = rSqSum / pixelCount - rMean * rMean;
    const gVar = gSqSum / pixelCount - gMean * gMean;
    const bVar = bSqSum / pixelCount - bMean * bMean;
    const rStd = Math.sqrt(Math.max(rVar, 0));
    const gStd = Math.sqrt(Math.max(gVar, 0));
    const bStd = Math.sqrt(Math.max(bVar, 0));

    const brightness = (rMean + gMean + bMean) / 3;
    const saturation = satSum / pixelCount;
    const colorfulness = (rStd + gStd + bStd) / 3;

    const avgStd = (rStd + gStd + bStd) / 3;
    const isGrayscale =
      (avgStd < 15 && Math.abs(rMean - gMean) < 18 && Math.abs(gMean - bMean) < 18 && Math.abs(rMean - bMean) < 18);

    const sortedBuckets = Array.from(colorBuckets.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const totalSampled = sortedBuckets.reduce((s, b) => s + b.count, 0);
    const dominantColors: DominantColor[] = sortedBuckets.map(b => {
      const r = Math.round(b.r / b.count);
      const g = Math.round(b.g / b.count);
      const bVal = Math.round(b.b / b.count);
      return {
        r, g, b: bVal,
        percentage: b.count / pixelCount,
        colorName: rgbToColorName(r, g, bVal),
      };
    }).filter(c => c.percentage > 0.015);

    const mergedColors: DominantColor[] = [];
    for (const dc of dominantColors) {
      let merged = false;
      for (const existing of mergedColors) {
        const dist = hsvDistance(
          rgbToHsv(dc.r, dc.g, dc.b).h, dc.r / 255, dc.g / 255,
          rgbToHsv(existing.r, existing.g, existing.b).h, existing.r / 255, existing.g / 255
        );
        if (dist < 0.2 && dc.colorName === existing.colorName) {
          existing.percentage += dc.percentage;
          existing.r = Math.round((existing.r + dc.r) / 2);
          existing.g = Math.round((existing.g + dc.g) / 2);
          existing.b = Math.round((existing.b + dc.b) / 2);
          merged = true;
          break;
        }
      }
      if (!merged) mergedColors.push({ ...dc });
    }
    mergedColors.sort((a, b) => b.percentage - a.percentage);

    const regions: RegionStats[][] = [];
    const regionW = Math.floor(imgW / REGION_GRID);
    const regionH = Math.floor(imgH / REGION_GRID);
    for (let ry = 0; ry < REGION_GRID; ry++) {
      const row: RegionStats[] = [];
      for (let rx = 0; rx < REGION_GRID; rx++) {
        row.push(computeRegionStats(
          pixels, imgW, imgH,
          rx * regionW, ry * regionH,
          regionW + (rx === REGION_GRID - 1 ? imgW % REGION_GRID : 0),
          regionH + (ry === REGION_GRID - 1 ? imgH % REGION_GRID : 0)
        ));
      }
      regions.push(row);
    }

    const edgeDensity = computeEdgeDensity(pixels, imgW, imgH);

    const metadata = await sharp(Buffer.from(buffer)).metadata();
    const aspectRatio = (metadata.width ?? 1) / (metadata.height ?? 1);

    for (let i = 0; i < brightnessHistogram.length; i++) {
      brightnessHistogram[i] /= pixelCount;
    }

    return {
      brightness,
      saturation,
      dominantColor: { r: rMean, g: gMean, b: bMean },
      dominantColors: mergedColors.length > 0 ? mergedColors : [{
        r: Math.round(rMean), g: Math.round(gMean), b: Math.round(bMean),
        percentage: 1.0,
        colorName: rgbToColorName(rMean, gMean, bMean),
      }],
      colorfulness,
      aspectRatio,
      isDark: brightness < 65,
      isBright: brightness > 195,
      isGrayscale,
      edgeDensity,
      regions,
      brightnessHistogram,
    };
  }

  private deriveColorTags(features: ImageFeatures): Array<{ name: string; confidence: number }> {
    const result: Array<{ name: string; confidence: number }> = [];
    const { dominantColors, isGrayscale, isDark, isBright, saturation, colorfulness } = features;

    if (isGrayscale) {
      if (isDark) {
        result.push({ name: '黑色', confidence: 0.92 });
      } else if (isBright) {
        result.push({ name: '白色', confidence: 0.92 });
      } else {
        result.push({ name: '灰色', confidence: 0.88 });
      }
      return result;
    }

    const colorCoverage = new Map<string, number>();
    for (const dc of dominantColors) {
      const existing = colorCoverage.get(dc.colorName) ?? 0;
      colorCoverage.set(dc.colorName, existing + dc.percentage);
    }

    const colorEntries = Array.from(colorCoverage.entries())
      .filter(([name]) => name !== '青色')
      .sort((a, b) => b[1] - a[1]);

    for (const [name, coverage] of colorEntries.slice(0, 3)) {
      if (coverage < 0.04) continue;
      const baseConf = Math.min(0.55 + coverage * 0.9, 0.95);
      const satBoost = saturation * 0.08;
      result.push({ name, confidence: Math.min(baseConf + satBoost, 0.97) });
    }

    const distinctColors = colorEntries.filter(([_, c]) => c > 0.08).length;
    if (distinctColors >= 3 && colorfulness > 30 && saturation > 0.35) {
      result.push({ name: '多彩', confidence: Math.min(0.6 + saturation * 0.3, 0.9) });
    }

    return result;
  }

  private deriveSceneTags(features: ImageFeatures): Array<{ name: string; confidence: number }> {
    const result: Array<{ name: string; confidence: number }> = [];
    const { dominantColors, isDark, isBright, isGrayscale, edgeDensity, regions, saturation, brightness } = features;

    const topRow = regions[0];
    const bottomRow = regions[2];
    const midRow = regions[1];
    const topAvgB = topRow.reduce((s, r) => s + r.b, 0) / 3;
    const topAvgG = topRow.reduce((s, r) => s + r.g, 0) / 3;
    const topAvgR = topRow.reduce((s, r) => s + r.r, 0) / 3;
    const topBrightness = topRow.reduce((s, r) => s + r.brightness, 0) / 3;
    const bottomBrightness = bottomRow.reduce((s, r) => s + r.brightness, 0) / 3;
    const midBrightness = midRow.reduce((s, r) => s + r.brightness, 0) / 3;

    const topColors = new Map<string, number>();
    for (const t of topRow) {
      topColors.set(t.colorName, (topColors.get(t.colorName) ?? 0) + 1);
    }
    const topHasBlue = topColors.has('蓝色') || (topAvgB > topAvgR && topAvgB > topAvgG * 1.05 && topBrightness > 110 && !topColors.has('紫色') && !topColors.has('粉色'));
    const topBlueRatio = topAvgB / (topAvgR + topAvgG + topAvgB + 1);

    const allColors = new Map<string, number>();
    for (const row of regions) {
      for (const r of row) {
        allColors.set(r.colorName, (allColors.get(r.colorName) ?? 0) + 1);
      }
    }

    const greenRegionCount = [...allColors.entries()]
      .filter(([n]) => n === '绿色')
      .reduce((s, [_, c]) => s + c, 0);
    const whiteRegionCount = [...allColors.entries()]
      .filter(([n]) => n === '白色')
      .reduce((s, [_, c]) => s + c, 0);
    const yellowRegionCount = [...allColors.entries()]
      .filter(([n]) => n === '黄色')
      .reduce((s, [_, c]) => s + c, 0);
    const brownRegionCount = [...allColors.entries()]
      .filter(([n]) => n === '棕色' || n === '橙色')
      .reduce((s, [_, c]) => s + c, 0);
    const grayRegionCount = [...allColors.entries()]
      .filter(([n]) => n === '灰色' || n === '黑色')
      .reduce((s, [_, c]) => s + c, 0);

    const colorCoverage = new Map<string, number>();
    for (const dc of dominantColors) {
      const existing = colorCoverage.get(dc.colorName) ?? 0;
      colorCoverage.set(dc.colorName, existing + dc.percentage);
    }
    const greenCoverage = colorCoverage.get('绿色') ?? 0;
    const blueCoverage = colorCoverage.get('蓝色') ?? 0;
    const yellowCoverage = colorCoverage.get('黄色') ?? 0;
    const orangeCoverage = colorCoverage.get('橙色') ?? 0;
    const brownCoverage = colorCoverage.get('棕色') ?? 0;
    const whiteCoverage = colorCoverage.get('白色') ?? 0;
    const grayCoverage = colorCoverage.get('灰色') ?? 0;

    if (isDark) {
      const conf = edgeDensity > 0.1 ? 0.82 : 0.72;
      result.push({ name: '夜景', confidence: conf });
    }

    if (isBright && saturation < 0.25 && whiteCoverage > 0.35) {
      result.push({ name: '雪景', confidence: Math.min(0.7 + whiteCoverage * 0.4, 0.92) });
    }

    if (topHasBlue && greenRegionCount >= 3 && edgeDensity > 0.18) {
      const forestConf = Math.min(0.55 + greenCoverage * 0.7 + edgeDensity * 0.6, 0.88);
      result.push({ name: '森林', confidence: forestConf });
    } else if (greenCoverage > 0.25 && edgeDensity > 0.15) {
      result.push({ name: '森林', confidence: Math.min(0.5 + greenCoverage * 0.7, 0.82) });
    }

    if (topHasBlue && (yellowRegionCount >= 2 || (yellowCoverage + whiteCoverage) > 0.25)) {
      const beachConf = Math.min(0.55 + topBlueRatio * 0.5 + yellowCoverage * 0.5, 0.85);
      result.push({ name: '海滩', confidence: beachConf });
    }

    if ((orangeCoverage > 0.25 || brownCoverage > 0.2) && topBrightness > midBrightness && midBrightness > bottomBrightness && !isDark && saturation > 0.3) {
      const sunsetConf = Math.min(0.5 + orangeCoverage * 0.8 + brownCoverage * 0.4, 0.85);
      result.push({ name: '日落', confidence: sunsetConf });
    }

    if (topHasBlue && greenRegionCount >= 1 && !bottomRow.every(r => r.colorName === '蓝色') && edgeDensity > 0.12) {
      const mountainConf = Math.min(
        0.45 + topBlueRatio * 0.4 + greenCoverage * 0.3 + edgeDensity * 0.4,
        0.78
      );
      if (mountainConf > 0.6) {
        result.push({ name: '山脉', confidence: mountainConf });
      }
    }

    if (edgeDensity > 0.22 && (grayRegionCount >= 3 || grayCoverage > 0.15) && brownRegionCount >= 1) {
      const cityConf = Math.min(0.45 + edgeDensity * 0.8 + grayCoverage * 0.5, 0.82);
      result.push({ name: '城市', confidence: cityConf });
    }

    if (grayRegionCount >= 4 && saturation < 0.3 && brightness > 80 && brightness < 180 && edgeDensity < 0.2) {
      const officeConf = Math.min(0.48 + grayCoverage * 0.4 + (1 - saturation) * 0.3, 0.75);
      result.push({ name: '办公室', confidence: officeConf });
    }

    if (!isGrayscale) {
      const warmCoverage = (colorCoverage.get('红色') ?? 0) + (colorCoverage.get('橙色') ?? 0) + (colorCoverage.get('黄色') ?? 0) + (colorCoverage.get('棕色') ?? 0);
      const foodIndoorCoverage = warmCoverage + (colorCoverage.get('紫色') ?? 0) + (colorCoverage.get('粉色') ?? 0);
      if (warmCoverage > 0.4 && !topHasBlue && brightness > 90 && brightness < 180 && saturation < 0.55) {
        const indoorConf = Math.min(0.5 + warmCoverage * 0.4, 0.8);
        result.push({ name: '室内', confidence: indoorConf });
      } else if (foodIndoorCoverage > 0.32 && !topHasBlue && brightness > 80 && brightness < 200 && saturation < 0.6) {
        const indoorConf = Math.min(0.48 + foodIndoorCoverage * 0.35, 0.78);
        result.push({ name: '室内', confidence: indoorConf });
      }
    }

    if (topHasBlue && saturation > 0.2) {
      const outdoorConf = Math.min(0.55 + topBlueRatio * 0.5 + saturation * 0.2, 0.88);
      result.push({ name: '户外', confidence: outdoorConf });
    } else if (greenCoverage > 0.15 && !isDark) {
      result.push({ name: '户外', confidence: Math.min(0.5 + greenCoverage * 0.6, 0.8) });
    } else if (!isDark && !isGrayscale && saturation > 0.35) {
      result.push({ name: '户外', confidence: 0.52 });
    }

    if (result.length === 0) {
      if (isDark) {
        result.push({ name: '夜景', confidence: 0.65 });
      } else if (isGrayscale) {
        result.push({ name: '室内', confidence: 0.58 });
      } else {
        result.push({ name: '户外', confidence: 0.52 });
      }
    }

    const seen = new Set<string>();
    const deduped = result.filter(r => {
      if (seen.has(r.name)) return false;
      seen.add(r.name);
      return true;
    });
    return deduped.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  private deriveObjectTags(features: ImageFeatures, filename: string): Array<{ name: string; confidence: number }> {
    const result: Array<{ name: string; confidence: number }> = [];
    const { dominantColors, isGrayscale, edgeDensity, regions, saturation, brightness, colorfulness } = features;

    const fnameLower = filename.toLowerCase();
    const matchedFromName: string[] = [];
    for (const obj of OBJECT_TAGS) {
      for (const kw of obj.keywords) {
        if (fnameLower.includes(kw.toLowerCase())) {
          matchedFromName.push(obj.name);
          break;
        }
      }
    }
    for (const name of matchedFromName.slice(0, 2)) {
      result.push({ name, confidence: 0.82 });
    }

    const colorCoverage = new Map<string, number>();
    for (const dc of dominantColors) {
      const existing = colorCoverage.get(dc.colorName) ?? 0;
      colorCoverage.set(dc.colorName, existing + dc.percentage);
    }
    const greenCoverage = colorCoverage.get('绿色') ?? 0;
    const purpleCoverage = colorCoverage.get('紫色') ?? 0;
    const yellowCoverage = colorCoverage.get('黄色') ?? 0;
    const orangeCoverage = colorCoverage.get('橙色') ?? 0;
    const brownCoverage = colorCoverage.get('棕色') ?? 0;
    const redCoverage = colorCoverage.get('红色') ?? 0;
    const pinkCoverage = colorCoverage.get('粉色') ?? 0;
    const whiteCoverage = colorCoverage.get('白色') ?? 0;
    const grayCoverage = colorCoverage.get('灰色') ?? 0;
    const blackCoverage = colorCoverage.get('黑色') ?? 0;
    const blueCoverage = colorCoverage.get('蓝色') ?? 0;

    const center = regions[1][1];
    const centerBright = center.brightness;
    const centerSat = center.saturation;
    const avgEdge = edgeDensity;

    const warmCoverage = redCoverage + orangeCoverage + yellowCoverage + brownCoverage;
    const nonWhiteFoodColors = warmCoverage + purpleCoverage + pinkCoverage;
    const foodColors = nonWhiteFoodColors + whiteCoverage * 0.15;

    if (foodColors > 0.3 && !isGrayscale && nonWhiteFoodColors > 0.12 && whiteCoverage < 0.6) {
      const textureOk = avgEdge > 0.08 && avgEdge < 0.35;
      const centerFocus = centerSat > saturation * 0.7;
      let foodConf = 0.4;
      if (warmCoverage > 0.3) foodConf += 0.15;
      if (purpleCoverage > 0.1) foodConf += 0.12;
      if (yellowCoverage > 0.1) foodConf += 0.08;
      if (textureOk) foodConf += 0.1;
      if (centerFocus) foodConf += 0.08;
      if (colorfulness > 18) foodConf += 0.05;
      foodConf = Math.min(foodConf, 0.88);
      if (foodConf > 0.55) {
        result.push({ name: '食物', confidence: foodConf });
      }
    }

    if (greenCoverage > 0.2 && !isGrayscale) {
      let plantConf = 0.4;
      plantConf += greenCoverage * 0.8;
      if (avgEdge > 0.12) plantConf += 0.12;
      if (saturation > 0.3) plantConf += 0.08;
      plantConf = Math.min(plantConf, 0.86);
      if (plantConf > 0.58) {
        result.push({ name: '植物', confidence: plantConf });
      }
    }

    if (!isGrayscale && avgEdge > 0.15 && saturation > 0.2) {
      const brownGrayMix = brownCoverage > 0.1 || grayCoverage > 0.08;
      const variedColors = dominantColors.length >= 3;
      if (brownGrayMix && variedColors && greenCoverage < 0.3 && warmCoverage < 0.35) {
        let animalConf = 0.42;
        animalConf += avgEdge * 0.8;
        animalConf += saturation * 0.15;
        animalConf = Math.min(animalConf, 0.78);
        if (animalConf > 0.58) {
          result.push({ name: '动物', confidence: animalConf });
        }
      }
    }

    if (avgEdge > 0.2 && !isGrayscale && whiteCoverage < 0.55) {
      const structuredColors = grayCoverage > 0.08 || blueCoverage > 0.1 || (blackCoverage > 0.05 && whiteCoverage > 0.05);
      if (structuredColors && greenCoverage < 0.25 && warmCoverage < 0.3) {
        let buildingConf = 0.4;
        buildingConf += avgEdge * 0.8;
        if (grayCoverage > 0.1) buildingConf += 0.1;
        if (blueCoverage > 0.15) buildingConf += 0.08;
        if (brightness > 100) buildingConf += 0.05;
        buildingConf = Math.min(buildingConf, 0.8);
        if (buildingConf > 0.6) {
          result.push({ name: '建筑', confidence: buildingConf });
        }
      }
    }

    if ((blackCoverage > 0.15 || grayCoverage > 0.15) && avgEdge < 0.22 && !isGrayscale) {
      const darkAccent = blackCoverage > 0.1 && (whiteCoverage > 0.05 || blueCoverage > 0.05 || saturation > 0.15);
      if (darkAccent && greenCoverage < 0.2 && warmCoverage < 0.3) {
        let electronicConf = 0.42;
        electronicConf += blackCoverage * 0.6;
        electronicConf += grayCoverage * 0.3;
        if (brightness < 160) electronicConf += 0.06;
        electronicConf = Math.min(electronicConf, 0.78);
        if (electronicConf > 0.58) {
          result.push({ name: '电子产品', confidence: electronicConf });
        }
      }
    }

    if (brownCoverage > 0.2 && saturation < 0.45 && brightness > 80 && brightness < 180) {
      if (greenCoverage < 0.15 && warmCoverage < 0.5) {
        let furnitureConf = 0.42;
        furnitureConf += brownCoverage * 0.7;
        if (avgEdge < 0.22) furnitureConf += 0.06;
        furnitureConf = Math.min(furnitureConf, 0.75);
        if (furnitureConf > 0.6) {
          result.push({ name: '家具', confidence: furnitureConf });
        }
      }
    }

    if (saturation > 0.3 && !isGrayscale && dominantColors.length >= 2 && colorfulness > 25) {
      const hasMultipleHues = dominantColors.filter(dc => dc.colorName !== '黑色' && dc.colorName !== '白色' && dc.colorName !== '灰色').length >= 2;
      if (hasMultipleHues && greenCoverage < 0.25 && foodColors < 0.35) {
        let clothingConf = 0.4;
        clothingConf += saturation * 0.3;
        clothingConf += colorfulness * 0.004;
        clothingConf = Math.min(clothingConf, 0.72);
        if (clothingConf > 0.58) {
          result.push({ name: '服装', confidence: clothingConf });
        }
      }
    }

    if (result.length === 0) {
      if (isGrayscale) {
        if (grayCoverage > 0.3 && brightness > 80 && brightness < 180) {
          result.push({ name: '家具', confidence: 0.55 });
        } else {
          result.push({ name: '电子产品', confidence: 0.52 });
        }
      } else if (brightness < 80) {
        result.push({ name: '电子产品', confidence: 0.5 });
      } else {
        const dominantName = dominantColors[0]?.colorName ?? '';
        if (dominantName === '绿色') {
          result.push({ name: '植物', confidence: 0.58 });
        } else if (dominantName === '棕色' || dominantName === '橙色' || dominantName === '黄色' || dominantName === '紫色' || dominantName === '粉色') {
          result.push({ name: '食物', confidence: 0.55 });
        } else if (dominantName === '蓝色') {
          result.push({ name: '建筑', confidence: 0.52 });
        } else if (dominantName === '白色' || dominantName === '灰色') {
          result.push({ name: '家具', confidence: 0.5 });
        } else {
          result.push({ name: '食物', confidence: 0.48 });
        }
      }
    }

    const seen = new Set<string>();
    const deduped = result.filter(r => {
      if (seen.has(r.name)) return false;
      seen.add(r.name);
      return true;
    });
    return deduped.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  private deriveStyleTags(features: ImageFeatures): Array<{ name: string; confidence: number }> {
    const result: Array<{ name: string; confidence: number }> = [];
    const { saturation, colorfulness, isGrayscale, edgeDensity } = features;

    if (isGrayscale) {
      result.push({ name: '复古', confidence: 0.68 });
      result.push({ name: '摄影', confidence: 0.62 });
    } else if (saturation > 0.55 && colorfulness > 45) {
      result.push({ name: '艺术', confidence: 0.65 });
      result.push({ name: '华丽', confidence: 0.58 });
    } else if (colorfulness < 20) {
      result.push({ name: '简约', confidence: 0.7 });
      result.push({ name: '现代', confidence: 0.58 });
    } else if (edgeDensity > 0.25 && saturation > 0.45) {
      result.push({ name: '卡通', confidence: 0.62 });
      result.push({ name: '插画', confidence: 0.58 });
    } else {
      result.push({ name: '写实', confidence: 0.65 });
      result.push({ name: '摄影', confidence: 0.55 });
    }

    return result.slice(0, 2);
  }

  computeHash(buffer: Uint8Array): string {
    let hash = 0;
    const step = Math.max(1, Math.floor(buffer.length / 1024));
    for (let i = 0; i < buffer.length; i += step) {
      hash = ((hash << 5) - hash) + buffer[i];
      hash |= 0;
    }
    return 'img_' + Math.abs(hash).toString(36) + '_' + buffer.length.toString(36);
  }
}
