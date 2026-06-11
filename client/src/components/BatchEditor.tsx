import { useState, useEffect, useRef } from 'react';
import { X, Layers, Plus, Trash2, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/app';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const PRESET_CATEGORIES = ['户外', '室内', '海滩', '森林', '城市', '山脉', '夜景', '雪景', '日落', '办公室', '人物', '汽车', '建筑', '动物', '食物', '植物', '旅行', '艺术'];

export default function BatchEditor({ open, onClose, onDone }: Props) {
  const selectedSet = useAppStore(s => s.selectedIds);
  const images = useAppStore(s => s.images);
  const clearSelection = useAppStore(s => s.clearSelection);
  const fetchImages = useAppStore(s => s.fetchImages);
  const fetchStats = useAppStore(s => s.fetchStats);
  const selectedIds = Array.from(selectedSet);

  const [mode, setMode] = useState<'category' | 'tag' | 'desc'>('category');
  const [categories, setCategories] = useState<string[]>([]);
  const [userTags, setUserTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [description, setDescription] = useState('');
  const [replaceMode, setReplaceMode] = useState<'merge' | 'replace'>('merge');
  const [saving, setSaving] = useState(false);
  const initedRef = useRef(false);

  useEffect(() => {
    if (open && selectedIds.length > 0 && !initedRef.current) {
      initedRef.current = true;
      const imgs = images.filter(i => selectedSet.has(i.id));
      const existingCats = new Set<string>();
      const existingTags = new Set<string>();
      imgs.forEach(i => {
        i.categories.forEach(c => existingCats.add(c));
        i.userTags.forEach(t => existingTags.add(t));
      });
      if (replaceMode === 'merge') {
        setCategories(Array.from(existingCats));
        setUserTags(Array.from(existingTags));
      }
    }
    if (!open) initedRef.current = false;
  }, [open]); // eslint-disable-line

  if (!open) return null;

  const toggleCategory = (c: string) => {
    setCategories(categories.includes(c) ? categories.filter(x => x !== c) : [...categories, c]);
  };
  const addTag = () => {
    const t = newTag.trim();
    if (t && !userTags.includes(t)) {
      setUserTags([...userTags, t]);
      setNewTag('');
    }
  };
  const removeTag = (t: string) => setUserTags(userTags.filter(x => x !== t));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      if (mode === 'category') updates.categories = categories;
      if (mode === 'tag') updates.userTags = userTags;
      if (mode === 'desc' && description.trim()) updates.description = description.trim();
      if (Object.keys(updates).length === 0) return;

      await api.batchUpdate(selectedIds, updates);
      await fetchImages();
      await fetchStats();
      clearSelection();
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-semibold text-white">批量编辑</h2>
            <p className="text-sm text-zinc-400 mt-0.5">已选择 {selectedIds.length} 张图片</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex gap-2">
            {(['category', 'tag', 'desc'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  mode === m ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                )}
              >
                {m === 'category' ? '📂 分类' : m === 'tag' ? '🏷️ 标签' : '📝 描述'}
              </button>
            ))}
            {mode !== 'desc' && (
              <div className="ml-auto flex items-center gap-2 text-xs bg-zinc-800 p-1 rounded-lg">
                <button
                  onClick={() => setReplaceMode('merge')}
                  className={cn('px-3 py-1.5 rounded transition-all', replaceMode === 'merge' ? 'bg-zinc-700 text-white' : 'text-zinc-400')}
                >
                  合并
                </button>
                <button
                  onClick={() => { setReplaceMode('replace'); if (mode === 'category') setCategories([]); if (mode === 'tag') setUserTags([]); }}
                  className={cn('px-3 py-1.5 rounded transition-all', replaceMode === 'replace' ? 'bg-zinc-700 text-white' : 'text-zinc-400')}
                >
                  替换
                </button>
              </div>
            )}
          </div>

          {mode === 'category' && (
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-2 block flex items-center gap-2">
                <Layers size={14} /> 为选中的图片设置分类
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleCategory(c)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm border transition-all',
                      categories.includes(c)
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'tag' && (
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-2 block">自定义标签</label>
              <div className="flex gap-2 mb-3">
                <input
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag()}
                  placeholder="输入标签后回车..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={addTag} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm flex items-center gap-1">
                  <Plus size={14} /> 添加
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {userTags.length === 0 ? (
                  <span className="text-sm text-zinc-500 py-1">暂无标签</span>
                ) : (
                  userTags.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-purple-600/20 border border-purple-500/40 text-purple-200 rounded-full text-sm">
                      {t}
                      <button onClick={() => removeTag(t)} className="w-4 h-4 rounded hover:bg-purple-500/40 flex items-center justify-center">
                        <Trash2 size={10} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {mode === 'desc' && (
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-2 block">统一描述 (可选)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="输入统一的描述内容，会应用到所有选中的图片..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        <div className="p-5 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-900/50">
          <button onClick={onClose} className="px-5 py-2 text-zinc-300 hover:bg-zinc-800 rounded-lg text-sm">取消</button>
          <button
            onClick={handleSave}
            disabled={saving || selectedIds.length === 0}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? '保存中...' : `应用到 ${selectedIds.length} 张`}
          </button>
        </div>
      </div>
    </div>
  );
}
