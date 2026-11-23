import React, { useState } from 'react';
import { Download, Trash2, Check, Eye, Sparkles, ChevronDown } from 'lucide-react';
import type { CapturedPhoto } from '../types';
import { sound } from '../services/audio';

interface PhotoGalleryProps {
  photos: CapturedPhoto[];
  selectedPhotoIds: string[];
  onToggleSelectPhoto: (id: string) => void;
  onOpenPhotoDetail: (photo: CapturedPhoto) => void;
  onRequestDelete: (photo: CapturedPhoto) => void;
  onOpenStripModal: () => void;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  selectedPhotoIds,
  onToggleSelectPhoto,
  onOpenPhotoDetail,
  onRequestDelete,
  onOpenStripModal,
}) => {
  const [photoModes, setPhotoModes] = useState<Record<string, 'ascii' | 'original'>>({});
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState<string | null>(null);

  const toggleMode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playKeyClick();
    setPhotoModes((prev) => ({
      ...prev,
      [id]: prev[id] === 'original' ? 'ascii' : 'original',
    }));
  };

  const handleDownload = (photo: CapturedPhoto, mode: 'ascii' | 'original', format: 'png' | 'jpg', e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playKeyClick();
    setDownloadDropdownOpen(null);

    const src = mode === 'ascii' ? photo.asciiDataUrl : photo.originalDataUrl;
    const link = document.createElement('a');
    link.download = `photo_${String(photo.captureNumber).padStart(3, '0')}_${mode}.${format === 'jpg' ? 'jpeg' : 'png'}`;
    link.href = src;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="w-full max-w-4xl mx-auto space-y-4">
      {/* Gallery Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5E5] pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#171717]">
            Photo Gallery
          </h2>
          <p className="text-xs text-[#737373]">
            {photos.length} {photos.length === 1 ? 'capture' : 'captures'} recorded in local session
          </p>
        </div>

        {/* Photobooth Strip Action */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#737373] hidden sm:inline">
            Select 3 photos for strip:
          </span>
          <button
            onClick={() => {
              sound.playKeyClick();
              onOpenStripModal();
            }}
            disabled={selectedPhotoIds.length !== 3}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedPhotoIds.length === 3
                ? 'bg-[#171717] text-white hover:bg-[#262626] shadow-xs'
                : 'bg-[#F5F5F5] border border-[#E5E5E5] text-[#A3A3A3] cursor-not-allowed'
            }`}
          >
            <span>Create 3-Photo Strip ({selectedPhotoIds.length}/3)</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {photos.length === 0 ? (
        <div className="py-16 px-4 text-center border border-dashed border-[#E5E5E5] rounded-xl bg-white">
          <p className="text-sm font-medium text-[#171717] mb-1">
            No photographs captured yet
          </p>
          <p className="text-xs text-[#737373] max-w-sm mx-auto">
            Click "Capture Photo" above to take your first Color ASCII and high-resolution photograph.
          </p>
        </div>
      ) : (
        /* Grid of Photos */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo) => {
            const currentMode = photoModes[photo.id] || 'ascii';
            const isSelected = selectedPhotoIds.includes(photo.id);
            const isDropdownOpen = downloadDropdownOpen === photo.id;
            const displayImg = currentMode === 'ascii' ? photo.asciiDataUrl : photo.originalDataUrl;

            return (
              <div
                key={photo.id}
                className={`group rounded-xl border bg-white overflow-hidden transition-all duration-150 flex flex-col ${
                  isSelected
                    ? 'border-[#171717] ring-1 ring-[#171717]'
                    : 'border-[#E5E5E5] hover:border-[#D4D4D4]'
                }`}
              >
                {/* Photo Header */}
                <div className="px-3 py-2 border-b border-[#F0F0F0] flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] font-medium text-[#525252]">
                    #{String(photo.captureNumber).padStart(3, '0')}
                  </span>

                  {/* ASCII vs Original Toggle */}
                  <button
                    onClick={(e) => toggleMode(photo.id, e)}
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#F5F5F5] text-[#525252] hover:text-[#171717] hover:bg-[#E5E5E5] transition-colors"
                  >
                    {currentMode === 'ascii' ? (
                      <>
                        <Sparkles className="w-3 h-3 text-[#171717]" />
                        <span>ASCII</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3 text-[#171717]" />
                        <span>Original</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Thumbnail Image Viewport */}
                <div
                  onClick={() => {
                    sound.playKeyClick();
                    onOpenPhotoDetail(photo);
                  }}
                  className="relative aspect-video bg-[#080808] cursor-pointer overflow-hidden flex items-center justify-center"
                >
                  <img
                    src={displayImg}
                    alt={`Photo #${photo.captureNumber}`}
                    className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-95"
                  />

                  {/* Selection Indicator badge */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#171717] text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Actions Toolbar */}
                <div className="p-2.5 bg-white border-t border-[#F0F0F0] flex items-center justify-between gap-2 text-xs">
                  {/* Select for Strip */}
                  <button
                    onClick={() => {
                      sound.playKeyClick();
                      onToggleSelectPhoto(photo.id);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-[#171717] text-white'
                        : 'bg-[#F5F5F5] text-[#525252] hover:bg-[#EEEEEE] hover:text-[#171717]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSelected ? 'Selected' : 'Select'}</span>
                  </button>

                  {/* Download Dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.playKeyClick();
                        setDownloadDropdownOpen(isDropdownOpen ? null : photo.id);
                      }}
                      className="p-1.5 rounded-lg border border-[#E5E5E5] text-[#525252] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors flex items-center gap-0.5"
                      title="Download photo"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>

                    {isDropdownOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 bottom-full mb-1 z-30 w-40 rounded-lg bg-white border border-[#E5E5E5] shadow-lg p-1 text-xs space-y-0.5"
                      >
                        <div className="px-2 py-1 text-[10px] text-[#A3A3A3] font-semibold uppercase">
                          Download Format
                        </div>
                        <button
                          onClick={(e) => handleDownload(photo, 'ascii', 'png', e)}
                          className="w-full text-left px-2 py-1 rounded hover:bg-[#F5F5F5] flex items-center justify-between text-[#171717]"
                        >
                          <span>ASCII Art</span>
                          <span className="text-[10px] text-[#737373]">PNG</span>
                        </button>
                        <button
                          onClick={(e) => handleDownload(photo, 'ascii', 'jpg', e)}
                          className="w-full text-left px-2 py-1 rounded hover:bg-[#F5F5F5] flex items-center justify-between text-[#171717]"
                        >
                          <span>ASCII Art</span>
                          <span className="text-[10px] text-[#737373]">JPG</span>
                        </button>
                        <button
                          onClick={(e) => handleDownload(photo, 'original', 'png', e)}
                          className="w-full text-left px-2 py-1 rounded hover:bg-[#F5F5F5] flex items-center justify-between text-[#171717]"
                        >
                          <span>Original</span>
                          <span className="text-[10px] text-[#737373]">PNG</span>
                        </button>
                        <button
                          onClick={(e) => handleDownload(photo, 'original', 'jpg', e)}
                          className="w-full text-left px-2 py-1 rounded hover:bg-[#F5F5F5] flex items-center justify-between text-[#171717]"
                        >
                          <span>Original</span>
                          <span className="text-[10px] text-[#737373]">JPG</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      sound.playKeyClick();
                      onRequestDelete(photo);
                    }}
                    title="Delete photograph"
                    className="p-1.5 rounded-lg border border-[#E5E5E5] text-[#737373] hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
