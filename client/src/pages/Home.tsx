import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Loader2, ImageIcon, Database, Hash, FileImage, Sparkles, Grid3X3, List, ArrowUpDown, Settings, Clock, CheckSquare, Layers, TrendingUp } from 'lucide-react';
import UploadArea from '../components/UploadArea';
import SearchBar from '../components/SearchBar';
import ImageCard from '../components/ImageCard';
import ImageEditor from '../components/ImageEditor';
import BatchEditor from '../components/BatchEditor';
import { useAppStore } from '../store/app';
import { api, getImageUrl } from '../lib/api';
import { ImageRecord, RecognizeResult } from '../types';
import { cn } from '../lib/utils';

type SortMode = 'newest' | 'oldest' | 'size' | 'tags';

export default function Home() {
  const fetchImages = useAppStore(s => s.fetchImages);
  const fetchStats = useAppStore(s => s.fetchStats);
  const images = useAppStore(s => s.images);
  const total = useAppStore(s => s.total);
  const loading = useAppStore(s => s.loading);
  const loadingMore = useAppStore(s => s.loadingMore);
  const hasMore = useAppStore(s => s.hasMore);
  const sortMode = useAppStore(s => s.sortMode) as SortMode;
  const setSortMode = useAppStore(s => s.setSortMode);
  const stats = useAppStore(s => s.stats);
  const addImages = useAppStore(s => s.addImages);
  const setSearchResults = useAppStore(s => s.setSearchResults);
  const searchResults = useAppStore(s => s.searchResults);
  const lastSearchQuery = useAppStore(s => s.lastSearchQuery);
  const setLastSearchQuery = useAppStore(s => s.setLastSearchQuery);
  const selectedIds = useAppStore(s => s.selectedIds);
  const selectAll = useAppStore(s => s.selectAll);
  const clearSelection = useAppStore(s => s.clearSelection);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [selTags, setSelTags] = useState<string[]>([]);
  const [selCats, setSelCats] = useState<string[]>([]);
  const [activeType, setActiveType] = useState<'keyword' | 'tags' | 'combined' | 'image'>('combined');
  const [similarTarget, setSimilarTarget] = useState<ImageRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingImg, setEditingImg] = useState<ImageRecord | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [recentRecognition, setRecentRecognition] = useState<RecognizeResult[]>([]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    fetchImages(true);
    fetchStats();
  }, []); // eslint-disable-line

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && searchResults.length === 0) {
      fetchImages(false);
    }
  }, [loadingMore, hasMore, searchResults.length, fetchImages]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (searchResults.length > 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [handleLoadMore, searchResults.length]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => setToast({ msg, type });

  const handleSortChange = (mode: SortMode) => {
    if (mode === sortMode) return;
    setSortMode(mode);
    if (searchResults.length === 0) {
      fetchImages(true);
    }
  };

  const handleSubmit = async (files: File[], croppedMap: Record<string, { x: number; y: number; width: number; height: number }>) => {
    setProcessing(true);
    try {
      const res = await api.recognize(files, croppedMap);
      const newImgs: ImageRecord[] = [];
      let success = 0, dups = 0, errs = 0;
      for (const r of res.results) {
        if (r.status === 'ok' && r.record) { newImgs.push(r.record); success++; }
        else if (r.status === 'duplicate') dups++;
        else errs++;
      }
      if (newImgs.length > 0) addImages(newImgs);
      fetchStats();
      setRecentRecognition(res.results);
      setTimeout(() => setRecentRecognition([]), 8000);
      const msg = `识别完成！成功${success}张，重复${dups}张，失败${errs}张`;
      showToast(msg, errs > 0 ? 'err' : 'ok');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '识别失败', 'err');
      throw e;
    } finally {
      setProcessing(false);
    }
  };

  const doSearch = async () => {
    if (activeType === 'image') return;
    try {
      const res = await api.search({
        q: searchKeyword.trim(),
        tags: selTags,
        categories: selCats,
        type: activeType === 'combined' ? 'combined' : activeType === 'keyword' ? 'keyword' : 'tag',
        limit: 200,
      });
      setSearchResults(res.results);
      setLastSearchQuery(`${searchKeyword} ${selTags.join(',')} ${selCats.join(',')}`.trim());
      showToast(`找到 ${res.total} 条匹配结果`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '搜索失败', 'err');
    }
  };

  const doSimilarSearch = async (id: string) => {
    const img = images.find(i => i.id === id) || searchResults.find(r => r.image.id === id)?.image;
    if (img) setSimilarTarget(img);
    try {
      const res = await api.similar(id, 30);
      setSearchResults(res.results);
      setLastSearchQuery(`以图搜图: ${img?.originalName || id}`);
      setSimilarTarget(res.queryImage);
      showToast(`找到 ${res.total} 张相似图`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '相似图搜索失败', 'err');
    }
  };

  const handleReset = () => {
    setSearchKeyword('');
    setSelTags([]);
    setSelCats([]);
    setSearchResults([]);
    setLastSearchQuery('');
    setSimilarTarget(null);
  };

  const handleOpenSimilar = (id: string) => {
    doSimilarSearch(id);
  };

  const handleImageSearchClick = () => {
    if (similarTarget) doSimilarSearch(similarTarget.id);
  };

  const displayItems = useMemo(() => {
    const list = searchResults.length > 0 ? searchResults.map(r => ({ img: r.image, score: r.score, match: r.matchType })) :
      images.map(img => ({ img, score: undefined as number | undefined, match: undefined as string | undefined }));
    if (searchResults.length > 0) {
      const arr = [...list];
      switch (sortMode) {
        case 'oldest': arr.sort((a, b) => a.img.createdAt - b.img.createdAt); break;
        case 'size': arr.sort((a, b) => b.img.size - a.img.size); break;
        case 'tags': arr.sort((a, b) => (b.img.tags.length + b.img.userTags.length) - (a.img.tags.length + a.img.userTags.length)); break;
        default: arr.sort((a, b) => b.img.createdAt - a.img.createdAt);
      }
      return arr;
    }
    return list;
  }, [images, searchResults, sortMode]);

  const currentTotal = searchResults.length > 0 ? searchResults.length : total;

  const handleImageSaved = () => {
    fetchStats();
  };

  const handleImageDeleted = () => {
    fetchStats();
  };

  const handleBatchDone = () => {
    fetchStats();
    showToast('批量编辑已完成');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                智能图像识别检索系统
              </h1>
              <p className="text-xs text-zinc-500">AI Image Recognition & Retrieval Engine</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {stats && (
              <>
                <StatCard icon={<ImageIcon size={16} />} label="图片总数" value={stats.totalImages.toLocaleString()} accent="indigo" />
                <StatCard icon={<Database size={16} />} label="存储占用" value={`${(stats.totalSize / 1024 / 1024).toFixed(1)} MB`} accent="emerald" />
                <StatCard icon={<Hash size={16} />} label="平均标签" value={String(stats.avgTags)} accent="amber" />
                <StatCard icon={<FileImage size={16} />} label="人工标签" value={String(stats.userTagCount)} accent="pink" />
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <UploadArea onSubmit={handleSubmit} processing={processing} />

        {recentRecognition.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-indigo-300">
              <Clock size={14} /> 最近识别结果
            </div>
            <div className="flex flex-wrap gap-2">
              {recentRecognition.slice(0, 12).map((r, i) => (
                <span key={i} className={cn(
                  'text-xs px-2.5 py-1 rounded-full',
                  r.status === 'ok' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                  r.status === 'duplicate' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                  'bg-red-500/15 text-red-300 border border-red-500/30'
                )}>
                  {r.status === 'ok' ? '✓' : r.status === 'duplicate' ? '⟲' : '✗'} {r.record?.originalName || r.id || r.error}
                </span>
              ))}
            </div>
          </div>
        )}

        <SearchBar
          value={searchKeyword}
          onChange={setSearchKeyword}
          selectedTags={selTags}
          onTagsChange={setSelTags}
          selectedCategories={selCats}
          onCategoriesChange={setSelCats}
          onSearch={doSearch}
          onImageSearch={handleImageSearchClick}
          onReset={handleReset}
          activeType={activeType}
          onTypeChange={setActiveType}
          targetImage={similarTarget}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {searchResults.length > 0 ? (
                <><TrendingUp size={18} className="text-indigo-400" /> 搜索结果</>
              ) : (
                <><Grid3X3 size={18} className="text-zinc-400" /> 全部图库</>
              )}
            </h2>
            <span className="text-sm text-zinc-400">
              共 <span className="text-white font-medium">{currentTotal}</span> 张
            </span>
            {lastSearchQuery && (
              <span className="text-xs text-zinc-500 bg-zinc-800/60 px-3 py-1 rounded-full truncate max-w-md">
                查询: {lastSearchQuery}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setBatchOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20"
              >
                <CheckSquare size={14} /> 批量编辑 {selectedIds.size} 张
              </button>
            )}

            <button
              onClick={() => {
                const ids = displayItems.map(d => d.img.id);
                selectAll(ids);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm border border-zinc-700"
            >
              <Layers size={14} /> 全选本页
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={clearSelection}
                className="text-sm px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
              >
                取消选择
              </button>
            )}

            <div className="w-px h-6 bg-zinc-800 mx-1" />

            <div className="flex items-center gap-1 text-xs bg-zinc-800 p-1 rounded-lg border border-zinc-700">
              {([
                { v: 'newest', l: '最新', icon: '↓' },
                { v: 'oldest', l: '最早', icon: '↑' },
                { v: 'size', l: '大小', icon: '⬛' },
                { v: 'tags', l: '标签数', icon: '#' },
              ] as Array<{ v: SortMode; l: string; icon: string }>).map(o => (
                <button
                  key={o.v}
                  onClick={() => handleSortChange(o.v)}
                  className={cn(
                    'px-3 py-1.5 rounded-md transition-all flex items-center gap-1',
                    sortMode === o.v ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  <ArrowUpDown size={11} /> {o.l}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded-lg border border-zinc-700">
              <button
                onClick={() => setViewMode('grid')}
                className={cn('p-1.5 rounded-md transition-all', viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-400')}
              >
                <Grid3X3 size={15} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn('p-1.5 rounded-md transition-all', viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-400')}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {loading && displayItems.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-zinc-500">
            <Loader2 size={40} className="animate-spin text-indigo-400 mb-4" />
            <p>加载图片库...</p>
          </div>
        ) : displayItems.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-3xl bg-zinc-900 border-2 border-dashed border-zinc-700 flex items-center justify-center mb-6">
              <Settings size={40} className="text-zinc-600" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-300 mb-2">
              {lastSearchQuery ? '没有找到匹配的图片' : '图库还是空的'}
            </h3>
            <p className="text-zinc-500 max-w-md">
              {lastSearchQuery ? '尝试调整关键词、筛选标签，或清理搜索条件重新检索' : '在上方上传区域拖拽或点击上传图片，AI 将自动识别物体、场景和内容特征'}
            </p>
            {lastSearchQuery && (
              <button
                onClick={handleReset}
                className="mt-6 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm"
              >
                清除筛选条件
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <>
            <div className="grid gap-4 sm:gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {displayItems.map(item => (
                <ImageCard
                  key={item.img.id}
                  record={item.img}
                  score={item.score}
                  matchType={item.match}
                  onEdit={(img) => { setEditingImg(img); setEditorOpen(true); }}
                  onSimilar={handleOpenSimilar}
                />
              ))}
            </div>
            <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Loader2 size={18} className="animate-spin text-indigo-400" />
                  <span className="text-sm">加载更多...</span>
                </div>
              )}
              {!loadingMore && !hasMore && searchResults.length === 0 && displayItems.length > 0 && (
                <div className="text-sm text-zinc-600 flex items-center gap-2">
                  <span className="w-12 h-px bg-zinc-800" />
                  <span>已经到底啦</span>
                  <span className="w-12 h-px bg-zinc-800" />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {displayItems.map(item => (
                <ListRow
                  key={item.img.id}
                  record={item.img}
                  score={item.score}
                  selected={selectedIds.has(item.img.id)}
                  onToggleSelect={() => useAppStore.getState().toggleSelect(item.img.id)}
                  onEdit={() => { setEditingImg(item.img); setEditorOpen(true); }}
                  onSimilar={() => handleOpenSimilar(item.img.id)}
                />
              ))}
            </div>
            <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Loader2 size={18} className="animate-spin text-indigo-400" />
                  <span className="text-sm">加载更多...</span>
                </div>
              )}
              {!loadingMore && !hasMore && searchResults.length === 0 && displayItems.length > 0 && (
                <div className="text-sm text-zinc-600 flex items-center gap-2">
                  <span className="w-12 h-px bg-zinc-800" />
                  <span>已经到底啦</span>
                  <span className="w-12 h-px bg-zinc-800" />
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="max-w-[1600px] mx-auto px-6 py-8 border-t border-zinc-800/60 mt-16">
        <div className="text-center text-sm text-zinc-500 space-y-1">
          <p>🚀 图像AI识别服务: <code className="text-indigo-400">localhost:8645</code> · 前端开发服务: <code className="text-indigo-400">localhost:5173</code></p>
          <p className="text-xs text-zinc-600">包含图片预处理 · AI识别引擎 · 本地检索库 · 批量处理 · 缓存限流 · 定时清理</p>
        </div>
      </footer>

      <ImageEditor
        open={editorOpen}
        image={editingImg}
        onClose={() => setEditorOpen(false)}
        onSaved={handleImageSaved}
        onSimilar={(id) => { setEditorOpen(false); handleOpenSimilar(id); }}
      />

      <BatchEditor
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onDone={handleBatchDone}
      />

      {toast && (
        <div className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl shadow-2xl backdrop-blur-sm border text-sm font-medium',
          toast.type === 'ok'
            ? 'bg-emerald-600/90 border-emerald-500/50 text-white'
            : 'bg-red-600/90 border-red-500/50 text-white'
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string;
  accent: 'indigo' | 'emerald' | 'amber' | 'pink';
}) {
  const colors = {
    indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    pink: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  }[accent];
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2.5 rounded-xl border', colors)}>
      <div className="opacity-90">{icon}</div>
      <div className="leading-tight">
        <div className="text-xs opacity-80">{label}</div>
        <div className="text-sm font-semibold text-white">{value}</div>
      </div>
    </div>
  );
}

function ListRow({ record, score, selected, onToggleSelect, onEdit, onSimilar }: {
  record: ImageRecord; score?: number; selected: boolean;
  onToggleSelect: () => void; onEdit: () => void; onSimilar: () => void;
}) {
  return (
    <div className={cn(
      'flex items-center gap-4 p-3 rounded-xl border transition-all hover:bg-zinc-900/60',
      selected ? 'bg-indigo-500/5 border-indigo-500/40' : 'bg-zinc-900/30 border-zinc-800'
    )}>
      <input type="checkbox" checked={selected} onChange={onToggleSelect} className="w-4 h-4 rounded" />
      <img src={getImageUrl(record.thumbnailPath)} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" onClick={onEdit} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate mb-1">{record.originalName}</div>
        <div className="text-sm text-zinc-400 line-clamp-1 mb-2">{record.description}</div>
        <div className="flex flex-wrap gap-1">
          {record.tags.slice(0, 8).map(t => (
            <span key={t.name} className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">{t.name}</span>
          ))}
          {record.userTags.map(t => (
            <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">{t}</span>
          ))}
        </div>
      </div>
      <div className="text-xs text-zinc-500 shrink-0 text-right leading-relaxed hidden md:block">
        <div>{record.width}×{record.height}</div>
        <div>{(record.size / 1024).toFixed(1)} KB</div>
      </div>
      {score !== undefined && (
        <div className="text-sm font-semibold text-indigo-300 shrink-0 w-16 text-right">{Math.round(score * 100)}%</div>
      )}
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={onEdit} className="text-xs px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-md">编辑</button>
        <button onClick={onSimilar} className="text-xs px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-md">相似</button>
      </div>
    </div>
  );
}
