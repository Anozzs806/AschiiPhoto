import React from 'react';
import { Camera, FlipHorizontal, SwitchCamera, Timer } from 'lucide-react';
import type { CameraResolution } from '../types';
import { sound } from '../services/audio';

interface CameraControlsProps {
  isStreaming: boolean;
  countdownDuration: number;
  onSetCountdown: (duration: number) => void;
  isMirrored: boolean;
  onToggleMirror: () => void;
  facingMode: 'user' | 'environment';
  onToggleFacingMode: () => void;
  resolution: CameraResolution;
  onSetResolution: (res: CameraResolution) => void;
  onCapture: () => void;
  disabled: boolean;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  isStreaming,
  countdownDuration,
  onSetCountdown,
  isMirrored,
  onToggleMirror,
  facingMode,
  onToggleFacingMode,
  resolution,
  onSetResolution,
  onCapture,
  disabled,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto bg-white border border-[#E5E5E5] rounded-xl p-3 shadow-xs">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Timer selector */}
        <div className="flex items-center gap-1.5 order-2 sm:order-1">
          <span className="text-xs text-[#737373] flex items-center gap-1 pr-1">
            <Timer className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Timer:</span>
          </span>
          {[0, 3, 5, 10].map((dur) => (
            <button
              key={dur}
              onClick={() => {
                sound.playKeyClick();
                onSetCountdown(dur);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                countdownDuration === dur
                  ? 'bg-[#171717] text-white'
                  : 'bg-[#F5F5F5] text-[#525252] hover:bg-[#E5E5E5] hover:text-[#171717]'
              }`}
            >
              {dur === 0 ? 'Off' : `${dur}s`}
            </button>
          ))}
        </div>

        {/* Center: Clean Capture Button */}
        <div className="order-1 sm:order-2 my-1 sm:my-0">
          <button
            onClick={onCapture}
            disabled={disabled || !isStreaming}
            className={`flex items-center justify-center gap-2 px-7 py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-all ${
              disabled || !isStreaming
                ? 'bg-[#E5E5E5] text-[#A3A3A3] cursor-not-allowed'
                : 'bg-[#171717] text-white hover:bg-[#2A2A2A] active:scale-97 shadow-xs'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>
              {countdownDuration > 0 ? `Capture (${countdownDuration}s)` : 'Capture Photo'}
            </span>
          </button>
        </div>

        {/* Right: Camera Options */}
        <div className="flex items-center gap-2 order-3">
          {/* Mirror Toggle */}
          <button
            onClick={() => {
              sound.playKeyClick();
              onToggleMirror();
            }}
            title={isMirrored ? 'Disable Mirror' : 'Enable Mirror'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
              isMirrored
                ? 'border-[#171717] bg-[#171717] text-white'
                : 'border-[#E5E5E5] bg-[#FFFFFF] text-[#525252] hover:bg-[#F5F5F5] hover:text-[#171717]'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mirror</span>
          </button>

          {/* Front / Back switch */}
          <button
            onClick={() => {
              sound.playKeyClick();
              onToggleFacingMode();
            }}
            title="Switch Camera Orientation"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#E5E5E5] bg-[#FFFFFF] text-[#525252] hover:bg-[#F5F5F5] hover:text-[#171717] text-xs font-medium transition-colors"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{facingMode === 'user' ? 'Front' : 'Back'}</span>
          </button>

          {/* Resolution Selector */}
          <div className="flex items-center rounded-md bg-[#F5F5F5] p-0.5 border border-[#E5E5E5]">
            {(['480p', '720p', '1080p'] as CameraResolution[]).map((res) => (
              <button
                key={res}
                onClick={() => {
                  sound.playKeyClick();
                  onSetResolution(res);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  resolution === res
                    ? 'bg-white text-[#171717] shadow-xs'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
