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

export class AIEngine {
  recognize(fileBuffer: Uint8Array, filename: string): {
    tags: ImageTag[];
    description: string;
    categories: string[];
  } {
    const tags: ImageTag[] = [];
    const hashInputs = [filename, fileBuffer.length.toString()].join('-');
    const hashSeed = this.simpleHash(hashInputs);
    const rand = this.seededRandom(hashSeed);

    const objCount = 2 + Math.floor(rand() * 4);
    const shuffledObjects = [...OBJECT_TAGS].sort(() => rand() - 0.5).slice(0, objCount);
    for (const obj of shuffledObjects) {
      tags.push({ name: obj.name, confidence: 0.6 + rand() * 0.39, category: 'object' });
    }

    const sceneCount = 1 + Math.floor(rand() * 2);
    const shuffledScenes = [...SCENE_TAGS].sort(() => rand() - 0.5).slice(0, sceneCount);
    for (const scene of shuffledScenes) {
      tags.push({ name: scene.name, confidence: 0.55 + rand() * 0.4, category: 'scene' });
    }

    const colors = pickRandom(COLOR_TAGS, 1, 3);
    for (const c of colors) {
      tags.push({ name: c, confidence: 0.6 + rand() * 0.39, category: 'color' });
    }

    const styles = pickRandom(STYLE_TAGS, 1, 2);
    for (const s of styles) {
      tags.push({ name: s, confidence: 0.55 + rand() * 0.35, category: 'style' });
    }

    tags.sort((a, b) => b.confidence - a.confidence);

    const topTags = tags.slice(0, 3).map(t => t.name).join('、');
    const descriptions = [
      `这是一张包含${topTags}的${shuffledScenes[0]?.name ?? '场景'}照片`,
      `画面以${topTags}为主，呈现${styles[0] ?? '独特'}的视觉风格`,
      `展现了${shuffledScenes[0]?.name ?? '日常场景'}中的${topTags}元素`,
      `构图中${topTags}的${shuffledObjects[0]?.name ?? '主体'}十分突出`,
    ];
    const description = descriptions[Math.floor(rand() * descriptions.length)];

    const categories = [
      ...shuffledScenes.map(s => s.name),
      ...shuffledObjects.slice(0, 1).map(o => o.name),
    ];

    return { tags, description, categories };
  }

  private simpleHash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  private seededRandom(seed: number) {
    let s = seed || 1;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
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
