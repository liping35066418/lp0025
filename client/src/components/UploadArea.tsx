import { useRef, useState, useCallback, useEffect } from 'react';
import { UploadCloud, Image, X, Crop, Loader2, AlertCircle, FileImage } from 'lucide-react';
import { cn } from '../lib/utils';
import ImageCropper from './ImageCropper';
import { PendingImage } from '../types';

interface Props {
  onSubmit: (files: File[], croppedMap: Record<string, { x: number; y: number; width: number; height: number }>) => Promise<void>;
  processing: boolean;
}

export default function UploadArea({ onSubmit, processing }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [drag, setDrag] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<{ idx: number; src: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => pending.forEach(p => URL.revokeObjectURL(p.preview));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const processFiles = useCallback((fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      setError('请选择图片文件');
      return;
    }
    if (files.length > 50) {
      setError('一次最多上传50张图片');
      return;
    }
    const newPending: PendingImage[] = files.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setPending(p => [...p, ...newPending]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const removePending = (idx: number) => {
    setPending(p => {
      URL.revokeObjectURL(p[idx].preview);
      return p.filter((_, i) => i !== idx);
    });
  };

  const openCropper = (idx: number) => {
    setCropTarget({ idx, src: pending[idx].preview });
    setCropperOpen(true);
  };

  const confirmCrop = (crop: { x: number; y: number; width: number; height: number }) => {
    if (!cropTarget) return;
    setPending(p => p.map((item, i) => i === cropTarget.idx ? { ...item, crop } : item));
    setCropperOpen(false);
    setCropTarget(null);
  };

  const doSubmit = async () => {
    if (pending.length === 0) return;
    const croppedMap: Record<string, { x: number; y: number; width: number; height: number }> = {};
    pending.forEach(p => {
      if (p.crop) croppedMap[p.file.name] = p.crop;
    });
    try {
      await onSubmit(pending.map(p => p.file), croppedMap);
      pending.forEach(p => URL.revokeObjectURL(p.preview));
      setPending([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    }
  };

  return (
    <div className="mb-8">
      <div
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer',
          drag ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/40'
        )}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => !processing && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
          disabled={processing}
        />
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-4">
            <UploadCloud className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">拖拽或点击上传图片</h3>
          <p className="text-zinc-400 text-sm mb-3">支持 JPG / PNG / WebP 格式，单次最多 50 张，单张最大 20MB</p>
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-300">
              <Crop size={12} /> 支持裁剪预处理
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-300">
              <FileImage size={12} /> 自动压缩优化
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-300">
              <Image size={12} /> AI 智能识别
            </span>
          </div>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-white">待上传 ({pending.length})</h4>
            <div className="flex gap-2">
              <button
                onClick={() => { pending.forEach(p => URL.revokeObjectURL(p.preview)); setPending([]); }}
                className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 hover:bg-zinc-800 rounded-lg"
                disabled={processing}
              >
                清空
              </button>
              <button
                onClick={doSubmit}
                disabled={processing}
                className="text-sm px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-lg flex items-center gap-2 font-medium"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                {processing ? '识别处理中...' : `开始识别 ${pending.length} 张`}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {pending.map((p, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden bg-zinc-800 aspect-square">
                <img src={p.preview} alt="" className="w-full h-full object-cover" />
                {p.crop && (
                  <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded">已裁剪</div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-end p-2 opacity-0 group-hover:opacity-100">
                  <div className="flex gap-1 w-full">
                    <button
                      onClick={(e) => { e.stopPropagation(); openCropper(i); }}
                      className="flex-1 py-1.5 bg-white/90 hover:bg-white text-zinc-900 rounded text-xs flex items-center justify-center gap-1"
                    >
                      <Crop size={12} /> 裁剪
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removePending(i); }}
                      className="p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <ImageCropper
        open={cropperOpen}
        src={cropTarget?.src || ''}
        onClose={() => { setCropperOpen(false); setCropTarget(null); }}
        onConfirm={confirmCrop}
      />
    </div>
  );
}
