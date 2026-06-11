import { useRef, useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface CropInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  src: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (crop: CropInfo) => void;
}

export default function ImageCropper({ src, open, onClose, onConfirm }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const dragRef = useRef<{ type: 'move' | 'tl' | 'tr' | 'bl' | 'br'; startX: number; startY: number; orig: typeof box } | null>(null);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const img = new Image();
    img.onload = () => {
      const container = containerRef.current!;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const ratio = Math.min(cw / img.width, ch / img.height, 1);
      const w = img.width * ratio;
      const h = img.height * ratio;
      setImgSize({ w, h });
      const bw = w * 0.7;
      const bh = h * 0.7;
      setBox({
        x: (cw - w) / 2 + (w - bw) / 2,
        y: (ch - h) / 2 + (h - bh) / 2,
        w: bw,
        h: bh,
      });
    };
    img.src = src;
  }, [open, src]);

  if (!open) return null;

  const handlePointerDown = (e: React.PointerEvent, type: typeof dragRef.current extends { type: infer T } ? T : never) => {
    e.preventDefault();
    dragRef.current = { type, startX: e.clientX, startY: e.clientY, orig: { ...box } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const o = dragRef.current.orig;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const imgLeft = (cw - imgSize.w) / 2;
    const imgTop = (ch - imgSize.h) / 2;
    const imgRight = imgLeft + imgSize.w;
    const imgBottom = imgTop + imgSize.h;

    let b = { ...o };
    switch (dragRef.current.type) {
      case 'move':
        b.x = Math.max(imgLeft, Math.min(imgRight - o.w, o.x + dx));
        b.y = Math.max(imgTop, Math.min(imgBottom - o.h, o.y + dy));
        break;
      case 'br':
        b.w = Math.max(40, Math.min(imgRight - o.x, o.w + dx));
        b.h = Math.max(40, Math.min(imgBottom - o.y, o.h + dy));
        break;
      case 'bl':
        const nx = Math.max(imgLeft, Math.min(o.x + o.w - 40, o.x + dx));
        b.w = o.w + (o.x - nx);
        b.x = nx;
        b.h = Math.max(40, Math.min(imgBottom - o.y, o.h + dy));
        break;
      case 'tr':
        const nyT = Math.max(imgTop, Math.min(o.y + o.h - 40, o.y + dy));
        b.h = o.h + (o.y - nyT);
        b.y = nyT;
        b.w = Math.max(40, Math.min(imgRight - o.x, o.w + dx));
        break;
      case 'tl':
        const nxT = Math.max(imgLeft, Math.min(o.x + o.w - 40, o.x + dx));
        const nyT2 = Math.max(imgTop, Math.min(o.y + o.h - 40, o.y + dy));
        b.w = o.w + (o.x - nxT);
        b.h = o.h + (o.y - nyT2);
        b.x = nxT;
        b.y = nyT2;
        break;
    }
    setBox(b);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const handleConfirm = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const imgLeft = (cw - imgSize.w) / 2;
    const imgTop = (ch - imgSize.h) / 2;
    const scaleBack = 1 / scale;
    const crop: CropInfo = {
      x: Math.max(0, (box.x - imgLeft) * scaleBack),
      y: Math.max(0, (box.y - imgTop) * scaleBack),
      width: box.w * scaleBack,
      height: box.h * scaleBack,
    };
    onConfirm(crop);
  };

  const cw = containerRef.current?.clientWidth ?? 800;
  const imgLeft = (cw - imgSize.w) / 2;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800">
        <h3 className="text-white font-medium">裁剪图片</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-2 text-zinc-300 hover:bg-zinc-800 rounded"><ZoomOut size={18} /></button>
          <span className="text-zinc-300 text-sm w-14 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-2 text-zinc-300 hover:bg-zinc-800 rounded"><ZoomIn size={18} /></button>
          <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-2 text-zinc-300 hover:bg-zinc-800 rounded"><RotateCw size={18} /></button>
          <button onClick={onClose} className="p-2 text-zinc-300 hover:bg-zinc-800 rounded"><X size={18} /></button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-zinc-950"
        onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
        <div
          className="absolute top-1/2 left-1/2 max-w-full max-h-full"
          style={{
            transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
            width: imgSize.w || undefined,
            height: imgSize.h || undefined,
            transition: 'transform 0.15s',
          }}
        >
          <img src={src} alt="" className="block max-w-full max-h-full w-full h-full object-contain select-none pointer-events-none" draggable={false} />
        </div>

        <div className="absolute inset-0 pointer-events-none" style={{
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.6)`,
          clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${box.y}px, ${box.x}px ${box.y}px, ${box.x}px ${box.y + box.h}px, ${box.x + box.w}px ${box.y + box.h}px, ${box.x + box.w}px ${box.y}px, 0 ${box.y}px)`,
        }} />

        <div
          className="absolute border-2 border-white cursor-move"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          onPointerDown={(e) => handlePointerDown(e, 'move')}
        >
          <Handle className="-top-2 -left-2 cursor-nw-resize" onDown={(e) => handlePointerDown(e, 'tl')} />
          <Handle className="-top-2 -right-2 cursor-ne-resize" onDown={(e) => handlePointerDown(e, 'tr')} />
          <Handle className="-bottom-2 -left-2 cursor-sw-resize" onDown={(e) => handlePointerDown(e, 'bl')} />
          <Handle className="-bottom-2 -right-2 cursor-se-resize" onDown={(e) => handlePointerDown(e, 'br')} />
          <div className="absolute inset-1/2 border-l border-white/40" />
          <div className="absolute inset-1/2 border-t border-white/40" />
        </div>

        {box.w > 0 && (
          <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1.5 rounded text-sm">
            {Math.round(box.w * (1 / scale))} × {Math.round(box.h * (1 / scale))}
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-zinc-300 hover:bg-zinc-800 rounded-lg">取消</button>
        <button onClick={handleConfirm} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2">
          <Check size={16} /> 确认裁剪
        </button>
      </div>
    </div>
  );
}

function Handle({ className, onDown }: { className?: string; onDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      className={cn('absolute w-4 h-4 bg-white rounded-full border-2 border-indigo-500 z-10', className)}
      onPointerDown={onDown}
    />
  );
}
