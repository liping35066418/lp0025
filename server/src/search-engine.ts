import { ImageRecord, SearchResult, ImageTag } from './types.js';

export class SearchEngine {
  private images: ImageRecord[];

  constructor(images: ImageRecord[]) {
    this.images = images;
  }

  searchByTags(tagNames: string[]): SearchResult[] {
    if (!tagNames.length) return [];
    const query = tagNames.map(t => t.toLowerCase());

    const results: SearchResult[] = [];
    for (const img of this.images) {
      const allTags = [
        ...img.tags.map(t => t.name),
        ...img.userTags,
        ...img.categories,
      ].map(t => t.toLowerCase());

      let matches = 0;
      let confidenceSum = 0;
      for (const q of query) {
        for (let i = 0; i < img.tags.length; i++) {
          if (img.tags[i].name.toLowerCase().includes(q) || q.includes(img.tags[i].name.toLowerCase())) {
            matches++;
            confidenceSum += img.tags[i].confidence;
            break;
          }
        }
        for (const ut of img.userTags) {
          if (ut.toLowerCase().includes(q) || q.includes(ut.toLowerCase())) {
            matches++;
            confidenceSum += 0.8;
            break;
          }
        }
      }

      if (matches > 0) {
        const score = (matches / query.length) * 0.5 + (confidenceSum / Math.max(matches, 1)) * 0.5;
        results.push({ image: img, score, matchType: 'tag' });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  searchByDescription(keyword: string): SearchResult[] {
    if (!keyword.trim()) return [];
    const kw = keyword.toLowerCase();

    const results: SearchResult[] = [];
    for (const img of this.images) {
      const haystack = [
        img.description,
        ...img.tags.map(t => t.name),
        ...img.userTags,
        ...img.categories,
      ].join(' ').toLowerCase();

      let score = 0;
      if (img.description.toLowerCase().includes(kw)) score += 0.4;
      const allTags = [...img.tags.map(t => t.name.toLowerCase()), ...img.userTags.map(t => t.toLowerCase())];
      for (const tag of allTags) {
        if (tag.includes(kw) || kw.includes(tag)) {
          score += 0.3;
          break;
        }
      }
      for (const cat of img.categories) {
        if (cat.toLowerCase().includes(kw)) {
          score += 0.2;
          break;
        }
      }

      const words = kw.split(/\s+/);
      for (const word of words) {
        if (word.length > 1 && haystack.includes(word)) {
          score += 0.1 / words.length;
        }
      }

      if (score > 0.05) {
        results.push({ image: img, score: Math.min(score, 1), matchType: 'description' });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  searchBySimilar(queryImage: ImageRecord, limit = 20): SearchResult[] {
    const results: SearchResult[] = [];

    const queryTagMap = new Map<string, number>();
    for (const t of queryImage.tags) queryTagMap.set(t.name.toLowerCase(), t.confidence);
    for (const t of queryImage.userTags) queryTagMap.set(t.toLowerCase(), 0.8);

    for (const img of this.images) {
      if (img.id === queryImage.id) continue;

      const imgTagMap = new Map<string, number>();
      for (const t of img.tags) imgTagMap.set(t.name.toLowerCase(), t.confidence);
      for (const t of img.userTags) imgTagMap.set(t.toLowerCase(), 0.8);

      const allTagNames = new Set([...queryTagMap.keys(), ...imgTagMap.keys()]);
      let intersection = 0;
      let union = 0;
      let weightedMatch = 0;

      for (const name of allTagNames) {
        const qw = queryTagMap.get(name) ?? 0;
        const iw = imgTagMap.get(name) ?? 0;
        union += Math.max(qw, iw);
        if (qw > 0 && iw > 0) {
          intersection += Math.min(qw, iw);
          weightedMatch += qw * iw;
        }
      }

      const jaccard = union > 0 ? intersection / union : 0;
      const categoryOverlap = this.computeOverlap(queryImage.categories, img.categories);
      const sizePenalty = Math.abs(img.width * img.height - queryImage.width * queryImage.height) /
        Math.max(img.width * img.height, queryImage.width * queryImage.height, 1);

      const score = jaccard * 0.5 + weightedMatch * 0.25 + categoryOverlap * 0.2 + (1 - sizePenalty) * 0.05;

      if (score > 0.05) {
        results.push({ image: img, score, matchType: 'similar' });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  searchCombined(query: { tags?: string[]; keyword?: string; categories?: string[] }): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();

    if (query.tags && query.tags.length) {
      for (const r of this.searchByTags(query.tags)) {
        resultMap.set(r.image.id, { ...r, score: r.score * 0.5, matchType: 'combined' });
      }
    }

    if (query.keyword) {
      for (const r of this.searchByDescription(query.keyword)) {
        const existing = resultMap.get(r.image.id);
        if (existing) {
          existing.score += r.score * 0.35;
        } else {
          resultMap.set(r.image.id, { ...r, score: r.score * 0.35, matchType: 'combined' });
        }
      }
    }

    if (query.categories && query.categories.length) {
      for (const img of this.images) {
        let catScore = 0;
        for (const cat of query.categories!) {
          if (img.categories.includes(cat)) catScore += 1 / query.categories!.length;
        }
        if (catScore > 0) {
          const existing = resultMap.get(img.id);
          const finalScore = catScore * 0.3;
          if (existing) {
            existing.score += finalScore;
          } else {
            resultMap.set(img.id, { image: img, score: finalScore, matchType: 'combined' });
          }
        }
      }
    }

    return Array.from(resultMap.values()).sort((a, b) => b.score - a.score);
  }

  private computeOverlap<T>(a: T[], b: T[]): number {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    let match = 0;
    for (const x of setA) if (setB.has(x)) match++;
    return match / Math.min(setA.size, setB.size);
  }

  getAllTags(): { name: string; count: number; category: ImageTag['category'] }[] {
    const tagMap = new Map<string, { count: number; category: ImageTag['category'] }>();

    for (const img of this.images) {
      for (const t of img.tags) {
        const existing = tagMap.get(t.name);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(t.name, { count: 1, category: t.category });
        }
      }
      for (const ut of img.userTags) {
        const existing = tagMap.get(ut);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(ut, { count: 1, category: 'object' });
        }
      }
    }

    return Array.from(tagMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count);
  }

  getAllCategories(): { name: string; count: number }[] {
    const catMap = new Map<string, number>();
    for (const img of this.images) {
      for (const cat of img.categories) {
        catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
      }
    }
    return Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}
