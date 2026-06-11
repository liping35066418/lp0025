import { ImageRecord, PagedImages, RecognizeResult, SearchResultItem, Stats } from '../types';

const BASE = '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ ok: boolean; timestamp: number }>('/api/health'),
  stats: () => request<Stats>('/api/stats'),

  recognize: (files: File[], croppedMap: Record<string, { x: number; y: number; width: number; height: number }> = {}) => {
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));
    if (Object.keys(croppedMap).length > 0) {
      fd.append('cropped', JSON.stringify(croppedMap));
    }
    return fetch(BASE + '/api/recognize', { method: 'POST', body: fd }).then(r => {
      if (!r.ok) throw new Error('识别请求失败');
      return r.json();
    }) as Promise<{ success: boolean; results: RecognizeResult[]; total: number }>;
  },

  listImages: (page = 1, pageSize = 30, sort = 'newest') =>
    request<PagedImages>(`/api/images?page=${page}&pageSize=${pageSize}&sort=${sort}`),

  getImage: (id: string) => request<ImageRecord>(`/api/images/${id}`),

  updateImage: (id: string, body: Partial<ImageRecord> & {
    adjustTags?: { add?: string[]; remove?: string[] };
  }) =>
    request<{ success: boolean; data: ImageRecord }>(`/api/images/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  batchUpdate: (ids: string[], updates: Partial<ImageRecord>) =>
    request<{ success: boolean; updated: number }>('/api/images/batch-update', {
      method: 'POST',
      body: JSON.stringify({ ids, updates }),
    }),

  deleteImage: (id: string) =>
    request<{ success: boolean }>(`/api/images/${id}`, { method: 'DELETE' }),

  search: (params: { q?: string; tags?: string[]; categories?: string[]; type?: string; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.tags?.length) sp.set('tags', params.tags.join(','));
    if (params.categories?.length) sp.set('categories', params.categories.join(','));
    if (params.type) sp.set('type', params.type);
    if (params.limit) sp.set('limit', String(params.limit));
    return request<{ results: SearchResultItem[]; total: number }>(`/api/search?${sp.toString()}`);
  },

  similar: (id: string, limit = 20) =>
    request<{ results: SearchResultItem[]; total: number; queryImage: ImageRecord }>(
      `/api/search/similar/${id}?limit=${limit}`
    ),

  tags: () => request<Array<{ name: string; count: number; category: ImageRecord['tags'][0]['category'] }>>('/api/tags'),
  categories: () => request<Array<{ name: string; count: number }>>('/api/categories'),
};

export function getImageUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const idx = path.indexOf('/uploads');
  return idx >= 0 ? path.slice(idx) : path;
}
