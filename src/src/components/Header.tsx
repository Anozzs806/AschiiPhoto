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
    <header className="border-b border-[#E5E5E5] bg-[#FFFFFF]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#171717] flex items-center justify-center text-white">
            <span className="font-mono text-xs font-semibold">#</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-[#171717]">
              Welp :d
            </h1>
            <p className="text-[11px] text-[#737373] hidden sm:block">
              Just random project
            </p>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center gap-3 text-xs">
          {/* Subtle Live Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] text-[#525252]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isStreaming ? 'bg-emerald-500' : 'bg-neutral-400'
              }`}
            />
            <span className="text-[11px] font-medium text-[#171717]">
              {isStreaming ? `Live (${fps} fps)` : 'Standby'}
            </span>
          </div>

          {/* Photo Count */}
          <div className="px-2.5 py-1 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] text-[#525252] text-[11px] font-medium hidden xs:block">
            {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            className="p-2 rounded-lg border border-[#E5E5E5] bg-[#FFFFFF] text-[#525252] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Open Settings */}
          <button
            onClick={() => {
              sound.playKeyClick();
              onOpenSettings();
            }}
            title="Camera & ASCII Settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E5E5] bg-[#FFFFFF] text-[#525252] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors font-medium text-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Photo Strip Action */}
          <button
            onClick={() => {
              sound.playKeyClick();
              onOpenStripModal();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium text-xs transition-all ${
              selectedCount === 3
                ? 'bg-[#171717] text-white hover:bg-[#262626]'
                : 'bg-[#F5F5F5] border border-[#E5E5E5] text-[#171717] hover:bg-[#EEEEEE]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>
              Photo Strip {selectedCount > 0 ? `(${selectedCount}/3)` : ''}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
