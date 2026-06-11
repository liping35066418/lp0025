export interface ImageTag {
  name: string;
  confidence: number;
  category: 'object' | 'scene' | 'color' | 'style';
}

export interface ImageRecord {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  thumbnailPath: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  tags: ImageTag[];
  description: string;
  categories: string[];
  userTags: string[];
  createdAt: number;
  updatedAt: number;
  hash: string;
}

export interface RecognitionResult {
  imageId: string;
  tags: ImageTag[];
  description: string;
  categories: string[];
}

export interface SearchResult {
  image: ImageRecord;
  score: number;
  matchType: 'tag' | 'description' | 'similar' | 'combined';
}

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}
