import React from 'react';
import { X, RotateCcw, Sliders } from 'lucide-react';
import type { FilterSettings, AsciiPaletteType } from '../types';
import { PALETTES } from '../utils/ascii';
import { sound } from '../services/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FilterSettings;
  onChangeSettings: (newSettings: FilterSettings) => void;
  onResetSettings: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
  onResetSettings,
}) => {
  if (!isOpen) return null;

  const update = (partial: Partial<FilterSettings>) => {
    onChangeSettings({ ...settings, ...partial });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-sans">
      <div className="w-full max-w-xl bg-white border border-[#E5E5E5] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#171717]" />
            <h2 className="font-semibold text-sm text-[#171717]">
              Camera & ASCII Settings
            </h2>
          </div>
          <button
            onClick={() => {
              sound.playKeyClick();
              onClose();
            }}
            className="p-1 rounded-lg text-[#737373] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#171717]">
          {/* Section 1: Character Palette */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#171717] block">
              ASCII Character Palette
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PALETTES) as AsciiPaletteType[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    sound.playKeyClick();
                    update({ palette: key });
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    settings.palette === key
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#E5E5E5] bg-white text-[#525252] hover:bg-[#F5F5F5]'
                  }`}
                >
                  <div className="font-medium capitalize text-xs">{key}</div>
                  <div className="font-mono text-[10px] opacity-70 truncate mt-0.5">
                    {PALETTES[key].slice(0, 8).join('')}...
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Character Density */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-[#171717]">Character Density</span>
              <span className="text-[#737373] font-mono">{settings.charSize}px</span>
            </div>
            <input
              type="range"
              min="6"
              max="20"
              step="1"
              value={settings.charSize}
              onChange={(e) => update({ charSize: Number(e.target.value), fontSize: Number(e.target.value) })}
              className="w-full accent-[#171717] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#888888]">
              <span>6px (Detailed)</span>
              <span>12px (Balanced)</span>
              <span>20px (Chunky)</span>
            </div>
          </div>

          {/* Section 3: Contrast & Saturation */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-[#171717]">Contrast</span>
                <span className="text-[#737373] font-mono">{Math.round(settings.contrast * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={settings.contrast}
                onChange={(e) => update({ contrast: parseFloat(e.target.value) })}
                className="w-full accent-[#171717] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-[#171717]">Color Saturation (RGB Vibrancy)</span>
                <span className="text-[#737373] font-mono">{Math.round(settings.saturation * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.2"
                step="0.1"
                value={settings.saturation}
                onChange={(e) => update({ saturation: parseFloat(e.target.value) })}
                className="w-full accent-[#171717] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-[#171717]">Brightness</span>
                <span className="text-[#737373] font-mono">{settings.brightness > 0 ? `+${settings.brightness}` : settings.brightness}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="2"
                value={settings.brightness}
                onChange={(e) => update({ brightness: parseInt(e.target.value, 10) })}
                className="w-full accent-[#171717] cursor-pointer"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="pt-2 border-t border-[#F0F0F0] space-y-2">
            <label className="flex items-center gap-2.5 text-xs text-[#171717] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.colorBoost}
                onChange={(e) => update({ colorBoost: e.target.checked })}
                className="accent-[#171717] rounded"
              />
              <span>Punchy RGB color boost for facial contours</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-[#171717] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.inverted}
                onChange={(e) => update({ inverted: e.target.checked })}
                className="accent-[#171717] rounded"
              />
              <span>Invert character luminance mapping</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#E5E5E5] px-6 py-3 flex items-center justify-between text-xs bg-white">
          <button
            onClick={() => {
              sound.playKeyClick();
              onResetSettings();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-[#737373] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={() => {
              sound.playKeyClick();
              onClose();
            }}
            className="px-5 py-2 rounded-lg bg-[#171717] text-white font-medium hover:bg-[#262626] transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
