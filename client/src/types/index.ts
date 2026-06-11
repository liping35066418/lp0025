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

export interface SearchResultItem {
  image: ImageRecord;
  score: number;
  matchType: 'tag' | 'description' | 'similar' | 'combined';
}

export interface PagedImages {
  items: ImageRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RecognizeResult {
  id: string;
  status: 'ok' | 'duplicate' | 'error';
  error?: string;
  record?: ImageRecord;
}

export interface PendingImage {
  file: File;
  preview: string;
  crop?: { x: number; y: number; width: number; height: number };
}

export interface Stats {
  totalImages: number;
  totalSize: number;
  avgTags: number;
  userTagCount: number;
}
