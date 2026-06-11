import { create } from 'zustand';
import { ImageRecord, SearchResultItem, Stats } from '../types';
import { api } from '../lib/api';

interface AppState {
  images: ImageRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  sortMode: string;
  searchResults: SearchResultItem[];
  selectedIds: Set<string>;
  stats: Stats | null;
  lastSearchQuery: string;

  fetchImages: (reset?: boolean) => Promise<void>;
  fetchStats: () => Promise<void>;
  setSortMode: (mode: string) => void;
  setSearchResults: (r: SearchResultItem[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  addImages: (imgs: ImageRecord[]) => void;
  updateImage: (img: ImageRecord) => void;
  removeImage: (id: string) => void;
  setLastSearchQuery: (q: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  images: [],
  total: 0,
  page: 1,
  pageSize: 30,
  totalPages: 0,
  hasMore: true,
  loading: false,
  loadingMore: false,
  sortMode: 'newest',
  searchResults: [],
  selectedIds: new Set(),
  stats: null,
  lastSearchQuery: '',

  fetchImages: async (reset = true) => {
    const { page: currentPage, pageSize, sortMode } = get();
    const nextPage = reset ? 1 : currentPage + 1;

    if (reset) {
      set({ loading: true });
    } else {
      set({ loadingMore: true });
    }

    try {
      const res = await api.listImages(nextPage, pageSize, sortMode);
      const newImages = reset ? res.items : [...get().images, ...res.items];
      set({
        images: newImages,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
        totalPages: res.totalPages,
        hasMore: res.page < res.totalPages,
        loading: false,
        loadingMore: false,
      });
    } catch (e) {
      set({ loading: false, loadingMore: false });
    }
  },

  fetchStats: async () => {
    try {
      const s = await api.stats();
      set({ stats: s });
    } catch {}
  },

  setSortMode: (mode) => {
    set({ sortMode: mode });
  },

  setSearchResults: (r) => set({ searchResults: r }),
  setLastSearchQuery: (q) => set({ lastSearchQuery: q }),

  toggleSelect: (id) => {
    const set2 = new Set(get().selectedIds);
    if (set2.has(id)) set2.delete(id);
    else set2.add(id);
    set({ selectedIds: set2 });
  },

  selectAll: (ids) => {
    if (ids.length === get().selectedIds.size && ids.every(id => get().selectedIds.has(id))) {
      set({ selectedIds: new Set() });
    } else {
      set({ selectedIds: new Set(ids) });
    }
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  addImages: (imgs) => {
    set({ images: [...imgs, ...get().images], total: get().total + imgs.length });
  },

  updateImage: (img) => {
    set({
      images: get().images.map(i => (i.id === img.id ? img : i)),
      searchResults: get().searchResults.map(r =>
        r.image.id === img.id ? { ...r, image: img } : r
      ),
    });
  },

  removeImage: (id) => {
    set({
      images: get().images.filter(i => i.id !== id),
      searchResults: get().searchResults.filter(r => r.image.id !== id),
      total: Math.max(0, get().total - 1),
    });
    const s = get().selectedIds;
    s.delete(id);
    set({ selectedIds: new Set(s) });
  },
}));
