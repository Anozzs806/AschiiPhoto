import React from 'react';
import { SlidersHorizontal, Image as ImageIcon, Volume2, VolumeX } from 'lucide-react';
import { sound } from '../services/audio';

interface HeaderProps {
  isStreaming: boolean;
  fps: number;
  photoCount: number;
  selectedCount: number;
  onOpenSettings: () => void;
  onOpenStripModal: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isStreaming,
  fps,
  photoCount,
  selectedCount,
  onOpenSettings,
  onOpenStripModal,
  soundEnabled,
  onToggleSound,
}) => {
  return (
    <header className="border-b border-[#E5E5E5] bg-[#FFFFFF]/90 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-6 py-2.5 sm:py-3.5">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#171717] flex items-center justify-center text-white shrink-0">
            <span className="font-mono text-xs font-semibold">#</span>
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-semibold tracking-tight text-[#171717] leading-none">
              COLOR ASCII PHOTOBOOTH
            </h1>
            <p className="text-[10px] sm:text-[11px] text-[#737373] hidden md:block mt-0.5">
              Real-time RGB ASCII camera & print studio
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs">
          {/* Subtle Live Status Indicator (hidden on very small screens to preserve space) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] text-[#525252]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isStreaming ? 'bg-emerald-500' : 'bg-neutral-400'
              }`}
            />
            <span className="text-[11px] font-medium text-[#171717]">
              {isStreaming ? `${fps} fps` : 'Standby'}
            </span>
          </div>

          {/* Photo Count badge (desktop) */}
          <div className="px-2 py-1 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] text-[#525252] text-[11px] font-medium hidden lg:block">
            {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            className="p-1.5 sm:p-2 rounded-lg border border-[#E5E5E5] bg-[#FFFFFF] text-[#525252] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => {
              sound.playKeyClick();
              onOpenSettings();
            }}
            title="Camera & ASCII Settings"
            className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-[#E5E5E5] bg-[#FFFFFF] text-[#525252] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors font-medium text-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Photo Strip Action Button */}
          <button
            onClick={() => {
              sound.playKeyClick();
              onOpenStripModal();
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg font-medium text-xs transition-all ${
              selectedCount === 3
                ? 'bg-[#171717] text-white hover:bg-[#262626]'
                : 'bg-[#F5F5F5] border border-[#E5E5E5] text-[#171717] hover:bg-[#EEEEEE]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Photo Strip</span>
            <span className="xs:hidden">Strip</span>
            {selectedCount > 0 && (
              <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-black/10 dark:bg-white/20">
                {selectedCount}/3
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
