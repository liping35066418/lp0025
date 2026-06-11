import { useState } from 'react';
import { ImageRecord, ImageTag } from '../types';
import { getImageUrl } from '../lib/api';
import { Check, Search, Trash2, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/app';
import { api } from '../lib/api';

interface Props {
  record: ImageRecord;
  score?: number;
  matchType?: string;
  onEdit?: (img: ImageRecord) => void;
  onSimilar?: (id: string) => void;
}

const CATEGORY_COLORS: Record<ImageTag['category'], string> = {
  object: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  scene: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  color: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  style: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
};

export default function ImageCard({ record, score, matchType, onEdit, onSimilar }: Props) {
  const [hover, setHover] = useState(false);
  const toggleSelect = useAppStore(s => s.toggleSelect);
  const selected = useAppStore(s => s.selectedIds.has(record.id));
  const removeImage = useAppStore(s => s.removeImage);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      await api.deleteImage(record.id);
      removeImage(record.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={cn(
        'group relative rounded-xl overflow-hidden bg-zinc-800 transition-all',
        'ring-2',
        selected ? 'ring-indigo-500' : 'ring-transparent hover:ring-zinc-600'
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="aspect-square cursor-pointer relative"
        onClick={() => onEdit?.(record)}
      >
        <img
          src={getImageUrl(record.thumbnailPath)}
          alt={record.description}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {(score !== undefined) && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium bg-black/70 backdrop-blur text-white">
            {matchType === 'similar' ? '🔍 ' : ''}
            {Math.round(score * 100)}%
          </div>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); toggleSelect(record.id); }}
          className={cn(
            'absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all',
            selected
              ? 'bg-indigo-500 border-indigo-500 text-white'
              : 'bg-black/40 border-white/50 text-transparent hover:bg-black/60 hover:text-white'
          )}
        >
          <Check size={14} />
        </button>

        <div className={cn(
          'absolute inset-x-0 bottom-0 p-2 transition-all duration-200',
          'bg-gradient-to-t from-black/90 via-black/50 to-transparent'
        )}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-zinc-300 truncate pr-2">{record.originalName}</span>
            <span className="text-[10px] text-zinc-400 shrink-0">{record.width}×{record.height}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {record.tags.slice(0, 4).map(tag => (
              <span
                key={tag.name}
                className={cn('text-[10px] px-1.5 py-0.5 rounded border', CATEGORY_COLORS[tag.category])}
              >
                {tag.name}
              </span>
            ))}
            {record.tags.length > 4 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                +{record.tags.length - 4}
              </span>
            )}
            {record.userTags.slice(0, 2).map(tag => (
              <span key={`u-${tag}`} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/30 border border-purple-400/50 text-purple-200">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className={cn(
          'absolute top-10 right-2 flex flex-col gap-1.5 transition-all duration-200',
          hover ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        )}>
          {onSimilar && (
            <button
              onClick={(e) => { e.stopPropagation(); onSimilar(record.id); }}
              title="以图搜图"
              className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur hover:bg-indigo-600 text-white flex items-center justify-center"
            >
              <Search size={14} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(record); }}
            title="编辑标签"
            className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur hover:bg-emerald-600 text-white flex items-center justify-center"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={handleDelete}
            title="删除"
            disabled={deleting}
            className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur hover:bg-red-600 text-white flex items-center justify-center disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
