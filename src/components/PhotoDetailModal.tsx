import React, { useState } from 'react';
import { X, Download, Eye, Sparkles, Check } from 'lucide-react';
import type { CapturedPhoto } from '../types';
import { sound } from '../services/audio';

interface PhotoDetailModalProps {
  photo: CapturedPhoto | null;
  onClose: () => void;
  onSelectForStrip: (photo: CapturedPhoto) => void;
  isSelectedForStrip: boolean;
}

export const PhotoDetailModal: React.FC<PhotoDetailModalProps> = ({
  photo,
  onClose,
  onSelectForStrip,
  isSelectedForStrip,
}) => {
  const [viewMode, setViewMode] = useState<'ascii' | 'original'>('ascii');

  if (!photo) return null;

  const currentImage = viewMode === 'ascii' ? photo.asciiDataUrl : photo.originalDataUrl;

  const handleDownload = (format: 'png' | 'jpg') => {
    sound.playKeyClick();
    const link = document.createElement('a');
    link.download = `photo_#${String(photo.captureNumber).padStart(3, '0')}_${viewMode}.${format === 'jpg' ? 'jpeg' : 'png'}`;
    link.href = currentImage;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formattedDate = new Date(photo.timestamp).toLocaleDateString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-4xl bg-white border border-[#E5E5E5] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-[#171717]">
              Photo #{String(photo.captureNumber).padStart(3, '0')}
            </span>
            <span className="text-[#D4D4D4]">•</span>
            <span className="text-xs text-[#737373]">
              {photo.width} × {photo.height}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg bg-[#F5F5F5] p-0.5 border border-[#E5E5E5]">
              <button
                onClick={() => {
                  sound.playKeyClick();
                  setViewMode('ascii');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'ascii'
                    ? 'bg-white text-[#171717] shadow-xs'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Color ASCII</span>
              </button>
              <button
                onClick={() => {
                  sound.playKeyClick();
                  setViewMode('original');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'original'
                    ? 'bg-white text-[#171717] shadow-xs'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Original</span>
              </button>
            </div>

            <button
              onClick={() => {
                sound.playKeyClick();
                onClose();
              }}
              className="p-1.5 rounded-lg text-[#737373] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="flex-1 bg-[#080808] p-4 flex items-center justify-center overflow-hidden min-h-[350px]">
          <img
            src={currentImage}
            alt={`Capture #${photo.captureNumber}`}
            className="max-h-[62vh] max-w-full object-contain rounded-lg"
          />
        </div>

        {/* Footer */}
        <div className="border-t border-[#E5E5E5] px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs bg-white">
          <div className="flex items-center gap-3 text-[#737373]">
            <span>{formattedDate}</span>
            <span>•</span>
            <span className="font-mono uppercase">{photo.settingsSnapshot.palette} palette ({photo.settingsSnapshot.charSize}px)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playKeyClick();
                onSelectForStrip(photo);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isSelectedForStrip
                  ? 'border-[#171717] bg-[#171717] text-white'
                  : 'border-[#E5E5E5] bg-white text-[#525252] hover:bg-[#F5F5F5]'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSelectedForStrip ? 'Selected for Strip' : 'Select for Strip'}</span>
            </button>

            <button
              onClick={() => handleDownload('jpg')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5] font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JPG</span>
            </button>

            <button
              onClick={() => handleDownload('png')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#171717] text-white hover:bg-[#262626] font-medium transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
