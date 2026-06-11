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

function pickRandom<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function confidence(): number {
  return Math.round((0.55 + Math.random() * 0.44) * 100) / 100;
}

interface ImageFeatures {
  brightness: number;
  saturation: number;
  dominantColor: { r: number; g: number; b: number };
  colorfulness: number;
  aspectRatio: number;
  isDark: boolean;
  isBright: boolean;
  isGrayscale: boolean;
}

function rgbToColorName(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  if (diff < 15) {
    if (max < 50) return '黑色';
    if (max > 220) return '白色';
    return '灰色';
  }

  const h = max === r ? ((g - b) / diff) % 6
    : max === g ? (b - r) / diff + 2
    : (r - g) / diff + 4;
  const hue = h * 60;
  const hueNorm = hue < 0 ? hue + 360 : hue;

  if (hueNorm >= 340 || hueNorm < 15) return '红色';
  if (hueNorm >= 15 && hueNorm < 45) return '橙色';
  if (hueNorm >= 45 && hueNorm < 75) return '黄色';
  if (hueNorm >= 75 && hueNorm < 165) return '绿色';
  if (hueNorm >= 165 && hueNorm < 195) return '蓝色';
  if (hueNorm >= 195 && hueNorm < 270) return '蓝色';
  if (hueNorm >= 270 && hueNorm < 315) return '紫色';
  if (hueNorm >= 315 && hueNorm < 340) return '粉色';

  return '棕色';
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
    const [stats, metadata] = await Promise.all([
      sharp(Buffer.from(buffer)).stats(),
      sharp(Buffer.from(buffer)).metadata(),
    ]);

    const channels = stats.channels;
    const rMean = channels[0]?.mean ?? 128;
    const gMean = channels[1]?.mean ?? 128;
    const bMean = channels[2]?.mean ?? 128;

    const brightness = (rMean + gMean + bMean) / 3;

    const rStd = channels[0]?.stdev ?? 0;
    const gStd = channels[1]?.stdev ?? 0;
    const bStd = channels[2]?.stdev ?? 0;

    const saturation = ((rStd + gStd + bStd) / 3) / 128;
    const colorfulness = (rStd + gStd + bStd) / 3;

    const avgStd = (rStd + gStd + bStd) / 3;
    const isGrayscale = channels.length < 3 ||
      (avgStd < 12 && Math.abs(rMean - gMean) < 12 && Math.abs(gMean - bMean) < 12 && Math.abs(rMean - bMean) < 12);

    const width = metadata.width ?? 1;
    const height = metadata.height ?? 1;
    const aspectRatio = width / height;

    return {
      brightness,
      saturation,
      dominantColor: { r: rMean, g: gMean, b: bMean },
      colorfulness,
      aspectRatio,
      isDark: brightness < 60,
      isBright: brightness > 200,
      isGrayscale,
    };
  }

  private deriveColorTags(features: ImageFeatures): Array<{ name: string; confidence: number }> {
    const result: Array<{ name: string; confidence: number }> = [];
    const { dominantColor, saturation, colorfulness, isDark, isBright, isGrayscale } = features;

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

    const primaryColor = rgbToColorName(dominantColor.r, dominantColor.g, dominantColor.b);
    result.push({ name: primaryColor, confidence: 0.78 + saturation * 0.18 });

    if (colorfulness > 45 && saturation > 0.5) {
      result.push({ name: '多彩', confidence: 0.72 + Math.min(saturation * 0.2, 0.22) });
    }

    if (colorfulness > 25) {
      const secondaryColors = COLOR_TAGS.filter(c => c !== primaryColor && c !== '多彩' && c !== '黑色' && c !== '白色' && c !== '灰色');
      const extra = pickRandom(secondaryColors, 0, 1);
      for (const c of extra) {
        result.push({ name: c, confidence: 0.55 + Math.random() * 0.2 });
      }
    }

    return result;
  }

  private deriveSceneTags(features: ImageFeatures): Array<{ name: string; confidence: number }> {
    const result: Array<{ name: string; confidence: number }> = [];
    const { brightness, saturation, colorfulness, aspectRatio, isDark, isBright, isGrayscale, dominantColor } = features;

    if (isDark) {
      result.push({ name: '夜景', confidence: 0.82 });
    }

    if (isBright && !isGrayscale) {
      const blueRatio = dominantColor.b / (dominantColor.r + dominantColor.g + dominantColor.b + 1);
      if (blueRatio > 0.38) {
        result.push({ name: '户外', confidence: 0.75 });
      }
    }

    if (aspectRatio > 1.5 && brightness > 90 && brightness < 200) {
      result.push({ name: '山脉', confidence: 0.52 });
    }

    if (!isDark && !isGrayscale && saturation > 0.45 && colorfulness > 30) {
      const greenRatio = dominantColor.g / (dominantColor.r + dominantColor.g + dominantColor.b + 1);
      if (greenRatio > 0.38) {
        result.push({ name: '森林', confidence: 0.62 });
      }
      if (greenRatio > 0.3 && brightness > 120) {
        result.push({ name: '户外', confidence: 0.65 });
      }
    }

    if (isGrayscale && brightness > 80 && brightness < 180) {
      result.push({ name: '室内', confidence: 0.55 });
    }

    if (result.length === 0) {
      result.push({ name: isDark ? '夜景' : '户外', confidence: 0.52 });
    }

    return result.slice(0, 2);
  }

  private deriveObjectTags(features: ImageFeatures, filename: string): Array<{ name: string; confidence: number }> {
    const result: Array<{ name: string; confidence: number }> = [];
    const { saturation, colorfulness, isGrayscale, dominantColor, isBright } = features;

    const matchedFromName: string[] = [];
    const fnameLower = filename.toLowerCase();
    for (const obj of OBJECT_TAGS) {
      for (const kw of obj.keywords) {
        if (fnameLower.includes(kw.toLowerCase())) {
          matchedFromName.push(obj.name);
          break;
        }
      }
    }

    for (const name of matchedFromName.slice(0, 2)) {
      result.push({ name, confidence: 0.72 + Math.random() * 0.2 });
    }

    if (!isGrayscale && colorfulness > 20 && saturation > 0.3) {
      const greenRatio = dominantColor.g / (dominantColor.r + dominantColor.g + dominantColor.b + 1);
      if (greenRatio > 0.4) {
        result.push({ name: '植物', confidence: 0.62 });
      }
    }

    if (isBright && colorfulness > 35) {
      const candidates = OBJECT_TAGS.filter(o => !result.find(r => r.name === o.name));
      const extra = pickRandom(candidates, 0, 1);
      for (const o of extra) {
        result.push({ name: o.name, confidence: 0.52 + Math.random() * 0.15 });
      }
    }

    if (result.length === 0) {
      const fallback = pickRandom(OBJECT_TAGS, 1, 2);
      for (const o of fallback) {
        result.push({ name: o.name, confidence: 0.48 + Math.random() * 0.12 });
      }
    }

    return result.slice(0, 3);
  }

  private deriveStyleTags(features: ImageFeatures): Array<{ name: string; confidence: number }> {
    const result: Array<{ name: string; confidence: number }> = [];
    const { saturation, colorfulness, isGrayscale } = features;

    if (isGrayscale) {
      result.push({ name: '复古', confidence: 0.68 });
      result.push({ name: '摄影', confidence: 0.62 });
    } else if (saturation > 0.55 && colorfulness > 45) {
      result.push({ name: '艺术', confidence: 0.65 });
      result.push({ name: '华丽', confidence: 0.58 });
    } else if (colorfulness < 20) {
      result.push({ name: '简约', confidence: 0.7 });
      result.push({ name: '现代', confidence: 0.58 });
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
