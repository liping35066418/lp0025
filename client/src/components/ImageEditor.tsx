import { useState, useEffect } from 'react';
import { X, Plus, Tag, Layers, Type, Sparkles, Trash2 } from 'lucide-react';
import { ImageRecord, ImageTag } from '../types';
import { api, getImageUrl } from '../lib/api';
import { useAppStore } from '../store/app';
import { cn } from '../lib/utils';

interface Props {
  open: boolean;
  image: ImageRecord | null;
  onClose: () => void;
  onSaved?: () => void;
  onSimilar?: (id: string) => void;
}

const CATEGORIES = ['户外', '室内', '海滩', '森林', '城市', '山脉', '夜景', '雪景', '日落', '办公室', '人物', '汽车', '建筑', '动物', '食物', '植物'];
const PRESET_TAGS = ['高清', '特写', '远景', '自然', '人文', '旅行', '艺术', '设计', '复古', '现代', '生活', '美食'];

export default function ImageEditor({ open, image, onClose, onSaved, onSimilar }: Props) {
  const updateImage = useAppStore(s => s.updateImage);
  const [tags, setTags] = useState<ImageTag[]>([]);
  const [userTags, setUserTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [newUserTag, setNewUserTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeCat, setActiveCat] = useState<'object' | 'scene' | 'color' | 'style' | 'all'>('all');

  useEffect(() => {
    if (image) {
      setTags([...image.tags]);
      setUserTags([...image.userTags]);
      setCategories([...image.categories]);
      setDescription(image.description);
      setNewUserTag('');
    }
  }, [image]);

  if (!open || !image) return null;

  const filteredTags = activeCat === 'all' ? tags : tags.filter(t => t.category === activeCat);

  const addUserTag = () => {
    const t = newUserTag.trim();
    if (t && !userTags.includes(t) && !tags.find(tt => tt.name === t)) {
      setUserTags([...userTags, t]);
      setNewUserTag('');
    }
  };

  const removeTag = (name: string) => {
    setTags(tags.filter(t => t.name !== name));
  };

  const removeUserTag = (t: string) => setUserTags(userTags.filter(x => x !== t));
  const toggleCategory = (c: string) => {
    setCategories(categories.includes(c) ? categories.filter(x => x !== c) : [...categories, c]);
  };

  const addPresetTag = (t: string) => {
    if (!userTags.includes(t) && !tags.find(tt => tt.name === t)) {
      setUserTags([...userTags, t]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.updateImage(image.id, {
        tags,
        userTags,
        categories,
        description,
      });
      updateImage(res.data);
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const confidenceColor = (c: number) =>
    c >= 0.85 ? 'bg-emerald-500' : c >= 0.7 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-6xl max-h-[92vh] bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Sparkles size={20} className="text-amber-400" />
              识别结果管理
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              {image.originalName} · {image.width}×{image.height} · {(image.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onSimilar && (
              <button
                onClick={() => { onClose(); onSimilar(image.id); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
              >
                🔍 查找相似图
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/2 p-6 bg-zinc-950 flex items-center justify-center overflow-auto">
            <img
              src={getImageUrl(image.path)}
              alt=""
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            />
          </div>

          <div className="w-1/2 p-6 overflow-auto space-y-6">
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                <Type size={14} /> 描述
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="添加图像描述..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                <Layers size={14} /> 分类
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleCategory(c)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm transition-all border',
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Tag size={14} /> AI识别标签 ({tags.length})
                </label>
                <div className="flex gap-1 text-xs">
                  {(['all', 'object', 'scene', 'color', 'style'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setActiveCat(c)}
                      className={cn(
                        'px-2 py-0.5 rounded',
                        activeCat === c ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                      )}
                    >
                      {c === 'all' ? '全部' : c === 'object' ? '物体' : c === 'scene' ? '场景' : c === 'color' ? '色彩' : '风格'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-auto p-1">
                {filteredTags.map(t => (
                  <div
                    key={t.name}
                    className="group flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-sm"
                  >
                    <div className={cn('w-1.5 h-1.5 rounded-full', confidenceColor(t.confidence))} />
                    <span className="text-zinc-200">{t.name}</span>
                    <span className="text-xs text-zinc-500">{Math.round(t.confidence * 100)}%</span>
                    <button
                      onClick={() => removeTag(t.name)}
                      className="w-4 h-4 rounded hover:bg-red-500/30 text-zinc-500 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {filteredTags.length === 0 && (
                  <span className="text-sm text-zinc-500 py-2">暂无此类标签</span>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                <Plus size={14} /> 人工补充标签
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  value={newUserTag}
                  onChange={e => setNewUserTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addUserTag()}
                  placeholder="输入新标签后回车..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={addUserTag}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm"
                >
                  添加
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {PRESET_TAGS.filter(t => !userTags.includes(t)).map(t => (
                  <button
                    key={t}
                    onClick={() => addPresetTag(t)}
                    className="text-xs px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-white hover:border-zinc-600"
                  >
                    + {t}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {userTags.map(t => (
                  <div
                    key={t}
                    className="flex items-center gap-1 px-2.5 py-1 bg-purple-600/20 border border-purple-500/40 text-purple-200 rounded-full text-sm"
                  >
                    <span>{t}</span>
                    <button
                      onClick={() => removeUserTag(t)}
                      className="w-4 h-4 rounded hover:bg-purple-500/40 flex items-center justify-center"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {userTags.length === 0 && <span className="text-sm text-zinc-500 py-1">未添加人工标签</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-900">
          <button
            onClick={onClose}
            className="px-5 py-2 text-zinc-300 hover:bg-zinc-800 rounded-lg text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}
