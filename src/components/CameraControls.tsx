import React from 'react';
import { Camera, FlipHorizontal, SwitchCamera, Timer, RotateCw } from 'lucide-react';
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
  onRefreshCamera?: () => void;
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
  onRefreshCamera,
  onCapture,
  disabled,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto bg-white border border-[#E5E5E5] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
      {/* Top Mobile / Desktop Main Capture Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Timer selector */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start order-2 sm:order-1">
          <span className="text-xs text-[#737373] flex items-center gap-1">
            <Timer className="w-3.5 h-3.5" />
            <span>Timer:</span>
          </span>
          <div className="flex items-center gap-1">
            {[0, 3, 5, 10].map((dur) => (
              <button
                key={dur}
                onClick={() => {
                  sound.playKeyClick();
                  onSetCountdown(dur);
                }}
                className={`min-w-[34px] py-1.5 sm:py-1 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                  countdownDuration === dur
                    ? 'bg-[#171717] text-white'
                    : 'bg-[#F5F5F5] text-[#525252] hover:bg-[#E5E5E5] hover:text-[#171717]'
                }`}
              >
                {dur === 0 ? 'Off' : `${dur}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Large Clean Capture Button */}
        <div className="w-full sm:w-auto order-1 sm:order-2">
          <button
            onClick={onCapture}
            disabled={disabled || !isStreaming}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 sm:py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-all ${
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

        {/* Right: Camera Orientation & Mirror Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto order-3">
          {/* Mirror Toggle */}
          <button
            onClick={() => {
              sound.playKeyClick();
              onToggleMirror();
            }}
            title={isMirrored ? 'Disable Mirror' : 'Enable Mirror'}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              isMirrored
                ? 'border-[#171717] bg-[#171717] text-white'
                : 'border-[#E5E5E5] bg-[#FFFFFF] text-[#525252] hover:bg-[#F5F5F5] hover:text-[#171717]'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>Mirror</span>
          </button>

          {/* Front / Back switch (Essential for mobile) */}
          <button
            onClick={() => {
              sound.playKeyClick();
              onToggleFacingMode();
            }}
            title="Switch Front / Back Camera"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E5E5] bg-[#FFFFFF] text-[#525252] hover:bg-[#F5F5F5] hover:text-[#171717] text-xs font-medium transition-colors"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
            <span>{facingMode === 'user' ? 'Front' : 'Back'}</span>
          </button>
        </div>
      </div>

      {/* Sub-bar: Resolution Selection & Quick Refresh */}
      <div className="pt-2 border-t border-[#F0F0F0] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#737373] text-[11px]">Resolution:</span>
          <div className="flex items-center rounded-lg bg-[#F5F5F5] p-0.5 border border-[#E5E5E5]">
            {(['480p', '720p', '1080p'] as CameraResolution[]).map((res) => (
              <button
                key={res}
                onClick={() => {
                  sound.playKeyClick();
                  onSetResolution(res);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
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

        {/* Explicit Refresh Camera Action */}
        {onRefreshCamera && (
          <button
            onClick={() => {
              sound.playKeyClick();
              onRefreshCamera();
            }}
            title="Refresh Camera Stream"
            className="flex items-center gap-1.5 text-[11px] text-[#737373] hover:text-[#171717] transition-colors py-1 px-2 rounded hover:bg-[#F5F5F5]"
          >
            <RotateCw className="w-3 h-3" />
            <span>Refresh Camera</span>
          </button>
        )}
      </div>
    </div>
  );
};
