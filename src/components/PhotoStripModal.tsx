import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Printer, Check, Eye, Sliders } from 'lucide-react';
import type { CapturedPhoto, StripCustomization } from '../types';
import { generateStripCanvas, downloadCanvas } from '../utils/stripGenerator';
import { sound } from '../services/audio';

interface PhotoStripModalProps {
  isOpen: boolean;
  onClose: () => void;
  allPhotos: CapturedPhoto[];
  selectedPhotoIds: string[];
  onToggleSelectPhoto: (id: string) => void;
  onAddLog: (type: 'SYS' | 'CAM' | 'ASCII' | 'CAPTURE' | 'ALBUM' | 'WARN', msg: string) => void;
}

export const PhotoStripModal: React.FC<PhotoStripModalProps> = ({
  isOpen,
  onClose,
  allPhotos,
  selectedPhotoIds,
  onToggleSelectPhoto,
  onAddLog,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const printableContainerRef = useRef<HTMLDivElement>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [cachedCanvas, setCachedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [mobileTab, setMobileTab] = useState<'preview' | 'customize'>('preview');

  const [customization, setCustomization] = useState<StripCustomization>({
    title: 'PHOTOBOOTH',
    caption: 'Memories Captured',
    paperStyle: 'classic-white',
    customBgColor: '#FFFFFF',
    customTextColor: '#171717',
    borderWidth: 0,
    photoGap: 16,
    padding: 24,
    showDate: true,
    showTime: false,
    showBarcode: false,
    showAsciiFooter: false,
    photoModes: ['ascii', 'ascii', 'ascii'],
  });

  const selectedPhotos = allPhotos.filter((p) => selectedPhotoIds.includes(p.id));

  useEffect(() => {
    if (!isOpen || selectedPhotos.length !== 3) return;

    let active = true;
    setIsGenerating(true);

    generateStripCanvas(selectedPhotos, customization)
      .then((generatedCanvas) => {
        if (!active) return;
        setCachedCanvas(generatedCanvas);

        const previewCanvas = previewCanvasRef.current;
        if (previewCanvas) {
          previewCanvas.width = generatedCanvas.width;
          previewCanvas.height = generatedCanvas.height;
          const ctx = previewCanvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.drawImage(generatedCanvas, 0, 0);
          }
        }
        setIsGenerating(false);
      })
      .catch((err) => {
        console.error('Failed to generate strip canvas:', err);
        setIsGenerating(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, selectedPhotos.length, customization, selectedPhotoIds]);

  if (!isOpen) return null;

  const update = (partial: Partial<StripCustomization>) => {
    setCustomization((prev) => ({ ...prev, ...partial }));
  };

  const setPhotoMode = (index: number, mode: 'ascii' | 'original') => {
    const newModes = [...customization.photoModes];
    newModes[index] = mode;
    update({ photoModes: newModes });
  };

  const handleDownload = (format: 'png' | 'jpg') => {
    if (!cachedCanvas) return;
    sound.playPrintSound();

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `photobooth_strip_${dateStr}.${format === 'jpg' ? 'jpg' : 'png'}`;
    downloadCanvas(cachedCanvas, filename, format === 'jpg' ? 'image/jpeg' : 'image/png');

    onAddLog('ALBUM', `Exported photo strip: ${filename}`);
  };

  const handlePrint = () => {
    if (!cachedCanvas) return;
    sound.playPrintSound();
    onAddLog('ALBUM', 'Opened print dialog.');

    if (printableContainerRef.current) {
      printableContainerRef.current.innerHTML = '';
      const img = new Image();
      img.src = cachedCanvas.toDataURL('image/png');
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '0 auto';
      printableContainerRef.current.appendChild(img);
    }

    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div id="printable-photo-strip-container" ref={printableContainerRef} className="hidden" />

      <div className="w-full max-w-5xl bg-white border border-[#E5E5E5] rounded-xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="border-b border-[#E5E5E5] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xs sm:text-sm font-semibold text-[#171717] tracking-tight">
              Three-Photo Photobooth Strip
            </h2>
            <p className="text-[10px] sm:text-xs text-[#737373]">
              Physical print layout with 3 vertical photographs
            </p>
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

        {/* Mobile Tab Switcher (Visible only on mobile when 3 photos are selected) */}
        {selectedPhotos.length === 3 && (
          <div className="flex md:hidden border-b border-[#E5E5E5] bg-[#FAFAFA] p-1.5 text-xs">
            <button
              onClick={() => {
                sound.playKeyClick();
                setMobileTab('preview');
              }}
              className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors ${
                mobileTab === 'preview' ? 'bg-white text-[#171717] shadow-xs' : 'text-[#737373]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Strip</span>
            </button>
            <button
              onClick={() => {
                sound.playKeyClick();
                setMobileTab('customize');
              }}
              className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors ${
                mobileTab === 'customize' ? 'bg-white text-[#171717] shadow-xs' : 'text-[#737373]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Customize</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        {selectedPhotos.length !== 3 ? (
          <div className="p-5 sm:p-8 overflow-y-auto text-center max-w-lg mx-auto">
            <h3 className="text-xs sm:text-sm font-medium text-[#171717] mb-1">
              Select 3 Photos
            </h3>
            <p className="text-xs text-[#737373] mb-5">
              You currently have <strong className="text-[#171717]">{selectedPhotos.length} of 3</strong> photos selected. Tap 3 photos below to assemble your strip.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 text-left">
              {allPhotos.map((photo) => {
                const isSel = selectedPhotoIds.includes(photo.id);
                return (
                  <div
                    key={photo.id}
                    onClick={() => {
                      sound.playKeyClick();
                      onToggleSelectPhoto(photo.id);
                    }}
                    className={`relative rounded-lg border overflow-hidden cursor-pointer bg-[#080808] transition-all ${
                      isSel ? 'border-[#171717] ring-2 ring-[#171717]' : 'border-[#E5E5E5] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={photo.asciiDataUrl}
                      alt={`#${photo.captureNumber}`}
                      className="w-full aspect-video object-cover"
                    />
                    <div className="p-1 bg-white flex items-center justify-between text-[10px]">
                      <span className="font-mono text-[#525252]">#{photo.captureNumber}</span>
                      {isSel && (
                        <span className="text-[#171717] font-semibold flex items-center gap-0.5">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Controls Panel */}
            <div
              className={`w-full md:w-80 border-r border-[#E5E5E5] overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5 bg-[#FAFAFA] text-xs ${
                mobileTab === 'customize' ? 'block' : 'hidden md:block'
              }`}
            >
              {/* Paper Background */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#171717] block">
                  Paper Background
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'classic-white', label: 'Plain White' },
                    { id: 'vintage-cream', label: 'Warm Paper' },
                    { id: 'terminal-black', label: 'Matte Dark' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => {
                        sound.playKeyClick();
                        update({ paperStyle: style.id as StripCustomization['paperStyle'] });
                      }}
                      className={`p-2 rounded-lg border text-center text-xs font-medium transition-colors ${
                        customization.paperStyle === style.id
                          ? 'border-[#171717] bg-[#171717] text-white'
                          : 'border-[#E5E5E5] bg-white text-[#525252] hover:bg-[#F0F0F0]'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Caption */}
              <div className="space-y-2.5">
                <div>
                  <label className="text-xs font-medium text-[#171717] block mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={customization.title}
                    onChange={(e) => update({ title: e.target.value })}
                    maxLength={24}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E5E5E5] text-[#171717] text-xs focus:outline-none focus:border-[#171717]"
                    placeholder="e.g. PHOTOBOOTH"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#171717] block mb-1">
                    Caption
                  </label>
                  <input
                    type="text"
                    value={customization.caption}
                    onChange={(e) => update({ caption: e.target.value })}
                    maxLength={36}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E5E5E5] text-[#171717] text-xs focus:outline-none focus:border-[#171717]"
                    placeholder="e.g. Memories Captured"
                  />
                </div>
              </div>

              {/* Photo Modes per frame */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#171717] block">
                  Frame Modes
                </label>
                <div className="space-y-2 bg-white p-2.5 rounded-lg border border-[#E5E5E5]">
                  {[0, 1, 2].map((idx) => {
                    const currentMode = customization.photoModes[idx] || 'ascii';
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-[#525252]">Photo 0{idx + 1}</span>
                        <div className="flex items-center rounded-md bg-[#F5F5F5] p-0.5 border border-[#E5E5E5]">
                          <button
                            onClick={() => {
                              sound.playKeyClick();
                              setPhotoMode(idx, 'ascii');
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                              currentMode === 'ascii'
                                ? 'bg-white text-[#171717] shadow-xs'
                                : 'text-[#737373] hover:text-[#171717]'
                            }`}
                          >
                            ASCII
                          </button>
                          <button
                            onClick={() => {
                              sound.playKeyClick();
                              setPhotoMode(idx, 'original');
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                              currentMode === 'original'
                                ? 'bg-white text-[#171717] shadow-xs'
                                : 'text-[#737373] hover:text-[#171717]'
                            }`}
                          >
                            Original
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Spacing & Padding Sliders */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-[#737373] text-[11px] mb-1">
                    <span>Spacing Gap</span>
                    <span>{customization.photoGap}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="32"
                    step="2"
                    value={customization.photoGap}
                    onChange={(e) => update({ photoGap: Number(e.target.value) })}
                    className="w-full accent-[#171717] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[#737373] text-[11px] mb-1">
                    <span>Paper Margin / Padding</span>
                    <span>{customization.padding}px</span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="40"
                    step="2"
                    value={customization.padding}
                    onChange={(e) => update({ padding: Number(e.target.value) })}
                    className="w-full accent-[#171717] cursor-pointer"
                  />
                </div>
              </div>

              {/* Date Stamp Toggle */}
              <div>
                <label className="flex items-center gap-2 text-xs text-[#525252] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customization.showDate}
                    onChange={(e) => update({ showDate: e.target.checked })}
                    className="accent-[#171717] rounded"
                  />
                  <span>Include Date Stamp</span>
                </label>
              </div>

              {/* Mobile Quick Action to Switch to Preview */}
              <div className="pt-2 md:hidden">
                <button
                  onClick={() => setMobileTab('preview')}
                  className="w-full py-2 rounded-lg bg-[#171717] text-white text-xs font-medium"
                >
                  View Preview Strip →
                </button>
              </div>
            </div>

            {/* Right Live Preview Area */}
            <div
              className={`flex-1 bg-[#F5F5F5] p-3 sm:p-6 flex flex-col items-center justify-center overflow-y-auto ${
                mobileTab === 'preview' ? 'flex' : 'hidden md:flex'
              }`}
            >
              <div className="max-h-[62vh] sm:max-h-[70vh] overflow-y-auto shadow-sm rounded-sm border border-[#E0E0E0] p-1 bg-white">
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-[58vh] sm:max-h-[66vh] w-auto h-auto object-contain block"
                />
              </div>

              <div className="flex items-center gap-2 mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-[#888888]">
                {isGenerating && <span className="w-1.5 h-1.5 rounded-full bg-[#171717] animate-ping" />}
                <span>{isGenerating ? 'Rendering preview...' : 'Single printable composite photograph'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="border-t border-[#E5E5E5] px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between text-xs bg-white">
          <button
            onClick={() => {
              sound.playKeyClick();
              onClose();
            }}
            className="px-3 sm:px-4 py-2 rounded-lg border border-[#E5E5E5] text-[#525252] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors"
          >
            Close
          </button>

          {selectedPhotos.length === 3 && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-2.5 sm:px-3.5 py-2 rounded-lg border border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5] font-medium transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Print</span>
              </button>

              <button
                onClick={() => handleDownload('jpg')}
                className="flex items-center gap-1 px-2.5 sm:px-3.5 py-2 rounded-lg border border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5] font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JPG</span>
              </button>

              <button
                onClick={() => handleDownload('png')}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-lg bg-[#171717] text-white hover:bg-[#262626] font-medium transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
