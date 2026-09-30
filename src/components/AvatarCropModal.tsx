import React, { useState, useRef, useEffect } from 'react';
import { Camera, ZoomIn, ZoomOut, Check, X, AlertCircle, RefreshCw } from 'lucide-react';

interface AvatarCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (compressedBase64: string) => void;
  currentUploadCount: number;
  maxMonthlyUploads?: number;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  onClose,
  onCropComplete,
  currentUploadCount,
  maxMonthlyUploads = 5
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  const remainingUploads = Math.max(0, maxMonthlyUploads - currentUploadCount);

  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size <= 10MB
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('檔案大小超過 10MB 限制，請選擇較小的圖片！');
      return;
    }

    if (remainingUploads <= 0) {
      setErrorMessage(`本月修改次數已達上限 (${maxMonthlyUploads} 次)，下個月將重置次數。`);
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedImage(result);
      const img = new Image();
      img.onload = () => {
        imageObjRef.current = img;
        setZoom(1);
        setPan({ x: 0, y: 0 });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleConfirmCrop = () => {
    if (!imageObjRef.current || !canvasRef.current) return;
    setIsProcessing(true);

    try {
      const canvas = canvasRef.current;
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, 200, 200);

      // Draw circular mask or square with zoom & pan
      const img = imageObjRef.current;
      const size = Math.min(img.width, img.height);
      const aspect = img.width / img.height;

      let drawWidth = 200 * zoom;
      let drawHeight = 200 * zoom;
      if (aspect > 1) {
        drawWidth = 200 * aspect * zoom;
      } else {
        drawHeight = (200 / aspect) * zoom;
      }

      const drawX = (200 - drawWidth) / 2 + pan.x;
      const drawY = (200 - drawHeight) / 2 + pan.y;

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

      // Compress to 200x200 JPEG
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      onCropComplete(compressedDataUrl);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || '裁切壓縮處理失敗');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-rose-100/60 dark:border-slate-800">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-300">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                自訂大頭照裁切
              </h3>
              <p className="text-[11px] text-slate-400">
                本月剩餘額度：<span className={remainingUploads > 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>{remainingUploads} / {maxMonthlyUploads} 次</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!selectedImage ? (
            <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              <Camera className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                上傳大頭照（支援最大 10MB）
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                本機自動裁切並壓縮為 200x200px 節省流量
              </p>

              <button
                disabled={remainingUploads <= 0}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-4 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition-all ${
                  remainingUploads > 0
                    ? 'hover:opacity-95 active:scale-95'
                    : 'opacity-50 cursor-not-allowed'
                }`}
                style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
              >
                {remainingUploads > 0 ? '選擇圖片' : '本月次數已達上限'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Preview Crop Window (200x200 circular mask inside) */}
              <div
                className="relative w-52 h-52 mx-auto rounded-full overflow-hidden border-4 border-rose-300 dark:border-rose-700 shadow-md bg-slate-900 cursor-move select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={selectedImage}
                  alt="Crop preview"
                  className="absolute pointer-events-none select-none max-w-none transition-transform"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center'
                  }}
                />
              </div>

              {/* Zoom slider */}
              <div className="flex items-center justify-center gap-3 px-2">
                <ZoomOut className="w-4 h-4 text-slate-400" />
                <input
                  type="range"
                  min="0.8"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={e => setZoom(parseFloat(e.target.value))}
                  className="w-40 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <ZoomIn className="w-4 h-4 text-slate-400" />
              </div>

              {/* Reset button & Instructions */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>可按住滑鼠拖曳調整位置</span>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <RefreshCw className="w-3 h-3" /> 重設位置
                </button>
              </div>

              {/* Hidden Canvas for 200x200 compression */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  重新選擇
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmCrop}
                  className="flex-1 py-2 rounded-xl text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1 hover:opacity-95"
                  style={{ backgroundColor: 'var(--color-primary, #c06c84)' }}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isProcessing ? '壓縮中...' : '確認並儲存'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
