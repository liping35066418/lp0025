import { useState, useEffect } from 'react';
import { Search, Filter, X, Image as ImageIcon } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { ImageRecord } from '../types';

interface Props {
  value: string;
  onChange: (v: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  selectedCategories: string[];
  onCategoriesChange: (cats: string[]) => void;
  onSearch: () => void;
  onImageSearch: () => void;
  onReset: () => void;
  activeType: 'keyword' | 'tags' | 'combined' | 'image';
  onTypeChange: (t: 'keyword' | 'tags' | 'combined' | 'image') => void;
  targetImage?: ImageRecord | null;
}

export default function SearchBar({
  value, onChange, selectedTags, onTagsChange,
  selectedCategories, onCategoriesChange,
  onSearch, onImageSearch, onReset,
  activeType, onTypeChange, targetImage,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [allTags, setAllTags] = useState<Array<{ name: string; count: number; category: ImageRecord['tags'][0]['category'] }>>([]);
  const [allCategories, setAllCategories] = useState<Array<{ name: string; count: number }>>([]);

  useEffect(() => {
    api.tags().then(setAllTags).catch(() => {});
    api.categories().then(setAllCategories).catch(() => {});
  }, []);

  const toggleTag = (t: string) => {
    onTagsChange(selectedTags.includes(t) ? selectedTags.filter(x => x !== t) : [...selectedTags, t]);
  };
  const toggleCategory = (c: string) => {
    onCategoriesChange(selectedCategories.includes(c) ? selectedCategories.filter(x => x !== c) : [...selectedCategories, c]);
  };

  const typeBtn = (label: string, type: typeof activeType, icon?: string) => (
    <button
      onClick={() => onTypeChange(type)}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
        activeType === type ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      )}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="mb-8 bg-zinc-900/50 backdrop-blur rounded-2xl border border-zinc-800 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {typeBtn('关键词', 'keyword', '🔤')}
          {typeBtn('标签', 'tags', '🏷️')}
          {typeBtn('综合', 'combined', '🎯')}
          {typeBtn('以图搜图', 'image', '🖼️')}
        </div>

        {activeType !== 'image' ? (
          <div className="flex-1 flex items-center gap-2 min-w-[300px]">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onSearch()}
                placeholder={
                  activeType === 'keyword' ? '输入关键词搜索... 例如：海滩、夜景、红色...' :
                  activeType === 'tags' ? '输入标签关键词快速筛选...' :
                  '输入关键词，结合下方筛选条件综合检索...'
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-10 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {value && (
                <button
                  onClick={() => onChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={onSearch}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20"
            >
              搜索
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-3 min-w-[300px]">
            {targetImage ? (
              <div className="flex-1 flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-xl p-2 pr-4">
                <img
                  src={targetImage.path.startsWith('http') ? targetImage.path : (targetImage.thumbnailPath.startsWith('http') ? targetImage.thumbnailPath : targetImage.thumbnailPath.includes('/uploads') ? targetImage.thumbnailPath : `/uploads/thumbnails/${targetImage.id}_thumb.jpg`)}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{targetImage.originalName}</div>
                  <div className="text-xs text-zinc-400">{targetImage.tags.slice(0, 3).map(t => t.name).join(' · ')}</div>
                </div>
                <button onClick={onImageSearch} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-medium text-sm">
                  开始搜索相似图
                </button>
              </div>
            ) : (
              <div className="flex-1 text-sm text-zinc-400 bg-zinc-800/50 border border-dashed border-zinc-700 rounded-xl p-4 text-center">
                💡 请先在下方图片列表中点击任意图卡右上角的「🔍 查找相似图」按钮
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'p-3 rounded-xl border transition-all',
            expanded ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
          )}
        >
          <Filter size={18} />
        </button>
        <button
          onClick={onReset}
          className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
          title="重置条件"
        >
          <X size={18} />
        </button>
      </div>

      {(selectedTags.length > 0 || selectedCategories.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">已选:</span>
          {selectedTags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 rounded-full text-xs">
              🏷️ {t}
              <button onClick={() => toggleTag(t)} className="hover:text-white"><X size={10} /></button>
            </span>
          ))}
          {selectedCategories.map(c => (
            <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 rounded-full text-xs">
              📂 {c}
              <button onClick={() => toggleCategory(c)} className="hover:text-white"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-5">
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-1.5">
              <ImageIcon size={14} /> 分类筛选 ({allCategories.reduce((s, c) => s + c.count, 0)})
            </h4>
            <div className="flex flex-wrap gap-2">
              {allCategories.map(c => (
                <button
                  key={c.name}
                  onClick={() => toggleCategory(c.name)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm border transition-all',
                    selectedCategories.includes(c.name)
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  {c.name} <span className="text-xs opacity-70">({c.count})</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-2">🏷️ 标签检索</h4>
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-auto p-1">
              {allTags.slice(0, 80).map(t => (
                <button
                  key={t.name}
                  onClick={() => toggleTag(t.name)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs border transition-all',
                    selectedTags.includes(t.name)
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-indigo-500/50'
                  )}
                >
                  {t.name} <span className="opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
