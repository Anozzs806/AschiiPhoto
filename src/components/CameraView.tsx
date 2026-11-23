import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Camera, RefreshCw, AlertCircle, Play, Square, VideoOff, RotateCw } from 'lucide-react';
import type { FilterSettings, CameraResolution, CapturedPhoto } from '../types';
import { renderAsciiToCanvas, generateHighResAscii } from '../utils/ascii';
import { sound } from '../services/audio';

export interface CameraViewHandle {
  triggerCapture: () => void;
  startCamera: () => void;
  stopCamera: () => void;
  refreshCamera: () => void;
  toggleMockCamera: () => void;
}

interface CameraViewProps {
  settings: FilterSettings;
  resolution: CameraResolution;
  isMirrored: boolean;
  facingMode: 'user' | 'environment';
  countdownDuration: number;
  onCaptureComplete: (photo: CapturedPhoto) => void;
  onAddLog: (type: 'SYS' | 'CAM' | 'ASCII' | 'CAPTURE' | 'ALBUM' | 'WARN', msg: string) => void;
  onFpsUpdate: (fps: number) => void;
  onStreamStatusChange: (streaming: boolean) => void;
  onStatsUpdate: (stats: { charGrid: string; renderTimeMs: number; activePalette: string }) => void;
  photoCounter: number;
}

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(({
  settings,
  resolution,
  isMirrored,
  facingMode,
  countdownDuration,
  onCaptureComplete,
  onAddLog,
  onFpsUpdate,
  onStreamStatusChange,
  onStatsUpdate,
  photoCounter,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mockCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep a persistent ref to stream to avoid stale closure issues
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [useMockCamera, setUseMockCamera] = useState(false);

  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const animFrameIdRef = useRef<number | null>(null);
  const mockAnimRef = useRef<number | null>(null);

  if (!sampleCanvasRef.current && typeof document !== 'undefined') {
    sampleCanvasRef.current = document.createElement('canvas');
  }

  const getResolutionConstraints = useCallback((res: CameraResolution) => {
    switch (res) {
      case '1080p':
        return { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 } };
      case '480p':
        return { width: { ideal: 640, max: 640 }, height: { ideal: 480, max: 480 } };
      case '720p':
      default:
        return { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 } };
    }
  }, []);

  // Safe stop helper
  const safelyStopActiveTracks = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {
        console.warn('Error stopping tracks:', e);
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }
    setStream(null);
  }, []);

  // Start / Restart real webcam stream cleanly
  const startCamera = useCallback(async (targetRes: CameraResolution = resolution) => {
    setCameraError(null);
    setUseMockCamera(false);
    setIsReconnecting(true);

    safelyStopActiveTracks();

    // Small delay to ensure OS camera lock is fully released before acquiring a new stream
    await new Promise((r) => setTimeout(r, 60));

    try {
      onAddLog('CAM', `Connecting camera (${targetRes}, facing: ${facingMode})...`);

      const constraints: MediaStreamConstraints = {
        video: {
          ...getResolutionConstraints(targetRes),
          facingMode: { ideal: facingMode },
        },
        audio: false,
      };

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn('Initial resolution request failed, trying flexible fallback:', firstErr);
        // Fallback to basic video constraints if specific resolution was rejected (common on mobile)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        });
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for loadedmetadata to prevent frozen black canvas
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve();
          videoRef.current.onloadedmetadata = () => resolve();
          // Timeout fallback
          setTimeout(resolve, 500);
        });
        await videoRef.current.play().catch(() => {});
      }

      onStreamStatusChange(true);
      onAddLog('CAM', 'Camera stream active.');
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('Camera access failed:', error);
      setCameraError(error.message || 'Unable to access camera.');
      onStreamStatusChange(false);
      onAddLog('WARN', `Camera error: ${error.message}`);
    } finally {
      setIsReconnecting(false);
    }
  }, [facingMode, getResolutionConstraints, onAddLog, onStreamStatusChange, resolution, safelyStopActiveTracks]);

  // Clean stop
  const stopCamera = useCallback(() => {
    safelyStopActiveTracks();
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    onStreamStatusChange(false);
    onAddLog('CAM', 'Camera stopped.');
  }, [onAddLog, onStreamStatusChange, safelyStopActiveTracks]);

  // Refresh camera (specifically requested by user to unstuck or re-acquire)
  const refreshCamera = useCallback(() => {
    sound.playKeyClick();
    onAddLog('CAM', 'Refreshing camera stream...');
    startCamera(resolution);
  }, [onAddLog, resolution, startCamera]);

  // Handle resolution change cleanly using applyConstraints first, then falling back to restart
  useEffect(() => {
    let isCancelled = false;

    const applyNewResolution = async () => {
      // If we already have an active track, try to apply constraints without tearing down the stream
      const currentTrack = streamRef.current?.getVideoTracks()[0];
      if (currentTrack && currentTrack.readyState === 'live') {
        try {
          setIsReconnecting(true);
          const constraints = getResolutionConstraints(resolution);
          await currentTrack.applyConstraints(constraints);
          onAddLog('CAM', `Resolution changed to ${resolution}`);
          setIsReconnecting(false);
          return;
        } catch (e) {
          console.warn('applyConstraints failed, restarting camera with new constraints:', e);
        }
      }

      // If applyConstraints didn't work, do a full clean restart
      if (!isCancelled) {
        startCamera(resolution);
      }
    };

    applyNewResolution();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution, facingMode]);

  // Toggle simulation mode
  const toggleMockCamera = useCallback(() => {
    if (!useMockCamera) {
      safelyStopActiveTracks();
      setCameraError(null);
      setUseMockCamera(true);
      onStreamStatusChange(true);
      onAddLog('SYS', 'Test simulation feed activated.');
    } else {
      setUseMockCamera(false);
      onStreamStatusChange(false);
      onAddLog('SYS', 'Simulation feed stopped.');
    }
  }, [onAddLog, onStreamStatusChange, safelyStopActiveTracks, useMockCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      safelyStopActiveTracks();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (mockAnimRef.current) cancelAnimationFrame(mockAnimRef.current);
    };
  }, [safelyStopActiveTracks]);

  // Synthetic Test Pattern Feed
  useEffect(() => {
    if (!useMockCamera) return;

    if (!mockCanvasRef.current) {
      mockCanvasRef.current = document.createElement('canvas');
      mockCanvasRef.current.width = 960;
      mockCanvasRef.current.height = 540;
    }

    const mockCanvas = mockCanvasRef.current;
    const mCtx = mockCanvas.getContext('2d');
    if (!mCtx) return;

    let t = 0;
    const drawMockScene = () => {
      t += 0.03;
      const grad = mCtx.createLinearGradient(0, 0, mockCanvas.width, mockCanvas.height);
      grad.addColorStop(0, '#0a0d1a');
      grad.addColorStop(0.5, '#1e1133');
      grad.addColorStop(1, '#052219');
      mCtx.fillStyle = grad;
      mCtx.fillRect(0, 0, mockCanvas.width, mockCanvas.height);

      const cx = mockCanvas.width / 2;
      const cy = mockCanvas.height / 2;

      for (let r = 200; r > 30; r -= 30) {
        mCtx.strokeStyle = `hsl(${(t * 40 + r) % 360}, 90%, 55%)`;
        mCtx.lineWidth = 4;
        mCtx.beginPath();
        mCtx.arc(cx, cy, r + Math.sin(t + r) * 12, 0, Math.PI * 2);
        mCtx.stroke();
      }

      mCtx.fillStyle = '#ff8c38';
      mCtx.beginPath();
      mCtx.arc(cx, cy - 20, 90, 0, Math.PI * 2);
      mCtx.fill();

      mCtx.fillStyle = '#00F0FF';
      mCtx.fillRect(cx - 50 + Math.sin(t) * 5, cy - 35, 25, 14);
      mCtx.fillRect(cx + 25 + Math.sin(t) * 5, cy - 35, 25, 14);

      mCtx.strokeStyle = '#39FF88';
      mCtx.lineWidth = 6;
      mCtx.beginPath();
      mCtx.arc(cx, cy - 10, 45, 0.1 * Math.PI, 0.9 * Math.PI);
      mCtx.stroke();

      mCtx.fillStyle = '#9d4edd';
      mCtx.beginPath();
      mCtx.moveTo(cx - 160, mockCanvas.height);
      mCtx.lineTo(cx - 70, cy + 70);
      mCtx.lineTo(cx + 70, cy + 70);
      mCtx.lineTo(cx + 160, mockCanvas.height);
      mCtx.closePath();
      mCtx.fill();

      mockAnimRef.current = requestAnimationFrame(drawMockScene);
    };

    mockAnimRef.current = requestAnimationFrame(drawMockScene);

    return () => {
      if (mockAnimRef.current) cancelAnimationFrame(mockAnimRef.current);
    };
  }, [useMockCamera]);

  // Main 60 FPS Render Loop: Color ASCII rendering onto Canvas
  useEffect(() => {
    let active = true;

    const renderLoop = () => {
      if (!active) return;

      const targetCanvas = canvasRef.current;
      const sampleCanvas = sampleCanvasRef.current;
      const video = videoRef.current;

      const sourceElement = useMockCamera ? mockCanvasRef.current : video;

      if (
        targetCanvas &&
        sampleCanvas &&
        sourceElement &&
        ((useMockCamera && mockCanvasRef.current) || (video && video.readyState >= 2 && video.videoWidth > 0))
      ) {
        const startTime = performance.now();

        const srcWidth = useMockCamera ? 960 : video!.videoWidth || 1280;
        const srcHeight = useMockCamera ? 540 : video!.videoHeight || 720;

        if (targetCanvas.width !== targetCanvas.clientWidth || targetCanvas.height !== targetCanvas.clientHeight) {
          targetCanvas.width = targetCanvas.clientWidth || 960;
          targetCanvas.height = targetCanvas.clientHeight || 540;
        }

        renderAsciiToCanvas(
          sourceElement,
          srcWidth,
          srcHeight,
          targetCanvas,
          sampleCanvas,
          settings,
          isMirrored
        );

        const renderDuration = performance.now() - startTime;

        frameCountRef.current++;
        const now = performance.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          const fps = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
          onFpsUpdate(fps);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;

          const cols = Math.floor(targetCanvas.width / Math.max(4, settings.charSize * 0.58));
          const rows = Math.floor(targetCanvas.height / Math.max(6, settings.charSize));
          onStatsUpdate({
            charGrid: `${cols}x${rows}`,
            renderTimeMs: renderDuration,
            activePalette: settings.palette,
          });
        }
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      active = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isMirrored, onFpsUpdate, onStatsUpdate, settings, useMockCamera]);

  // Capture execution
  const triggerCapture = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    const source = useMockCamera ? mockCanvasRef.current : videoRef.current;
    if (!source) {
      setIsCapturing(false);
      return;
    }

    if (countdownDuration > 0) {
      onAddLog('CAPTURE', `Countdown: ${countdownDuration}s`);
      for (let c = countdownDuration; c > 0; c--) {
        setCountdownNumber(c);
        sound.playCountdownBeep(false);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCountdownNumber(0);
      sound.playCountdownBeep(true);
      await new Promise((r) => setTimeout(r, 200));
    }

    setCountdownNumber(null);

    // Flash & Shutter
    setShowFlash(true);
    sound.playShutterSound();
    onAddLog('CAPTURE', 'Capturing image...');

    setTimeout(() => {
      setShowFlash(false);
    }, 400);

    try {
      const srcW = useMockCamera ? 960 : videoRef.current?.videoWidth || 1280;
      const srcH = useMockCamera ? 540 : videoRef.current?.videoHeight || 720;

      // 1. High-res Original
      const origCanvas = document.createElement('canvas');
      origCanvas.width = srcW;
      origCanvas.height = srcH;
      const oCtx = origCanvas.getContext('2d');
      if (oCtx) {
        if (isMirrored) {
          oCtx.translate(srcW, 0);
          oCtx.scale(-1, 1);
        }
        oCtx.drawImage(source, 0, 0, srcW, srcH);
      }
      const originalDataUrl = origCanvas.toDataURL('image/png', 0.95);

      // 2. High-res Color ASCII
      const asciiDataUrl = await generateHighResAscii(source, settings, isMirrored);

      const newPhoto: CapturedPhoto = {
        id: `photo_${Date.now()}_${photoCounter + 1}`,
        captureNumber: photoCounter + 1,
        timestamp: Date.now(),
        asciiDataUrl,
        originalDataUrl,
        preferredView: 'ascii',
        width: srcW,
        height: srcH,
        aspectRatio: srcW / srcH,
        settingsSnapshot: { ...settings },
      };

      onCaptureComplete(newPhoto);
      onAddLog('CAPTURE', `Saved Photo #${String(photoCounter + 1).padStart(3, '0')}`);
    } catch (err) {
      console.error('Capture failed:', err);
      onAddLog('WARN', 'Failed to generate capture.');
    } finally {
      setIsCapturing(false);
    }
  }, [
    countdownDuration,
    isCapturing,
    isMirrored,
    onAddLog,
    onCaptureComplete,
    photoCounter,
    settings,
    useMockCamera,
  ]);

  useImperativeHandle(ref, () => ({
    triggerCapture,
    startCamera,
    stopCamera,
    refreshCamera,
    toggleMockCamera,
  }));

  return (
    <div className="relative w-full max-w-4xl mx-auto rounded-xl sm:rounded-2xl overflow-hidden bg-[#080808] border border-[#E5E5E5] shadow-xs flex flex-col">
      <button data-capture-trigger onClick={triggerCapture} className="hidden" />

      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="hidden"
      />

      {/* Main Viewport Container - Adaptive aspect ratio for mobile & desktop */}
      <div className="relative aspect-[4/3] xs:aspect-[16/10] sm:aspect-video w-full max-h-[60vh] sm:max-h-[65vh] bg-[#080808] overflow-hidden flex items-center justify-center">
        {/* Real-time Color ASCII Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />

        {/* Optional subtle scanlines if enabled */}
        {settings.scanlines && (
          <div className="absolute inset-0 subtle-scanlines pointer-events-none z-10 opacity-40" />
        )}

        {/* Reconnecting / Resolution Switch overlay */}
        {isReconnecting && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-xs">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/80 text-white text-xs border border-white/10">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Updating camera...</span>
            </div>
          </div>
        )}

        {/* Minimalist Flash Effect */}
        <div
          className={`absolute inset-0 bg-white pointer-events-none z-30 transition-opacity duration-300 ${
            showFlash ? 'opacity-95' : 'opacity-0'
          }`}
        />

        {/* Minimalist Countdown Display */}
        {countdownNumber !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-25 backdrop-blur-xs pointer-events-none">
            <span className="font-sans font-light text-6xl sm:text-8xl text-white tracking-wider">
              {countdownNumber === 0 ? 'Smile' : countdownNumber}
            </span>
          </div>
        )}

        {/* Camera Permission / Error Fallback */}
        {cameraError && !useMockCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080808]/95 p-5 text-center z-20">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[#A3A3A3] mb-2.5">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-white mb-1">
              Camera Access Required
            </h3>
            <p className="text-[11px] sm:text-xs text-[#888888] max-w-xs mb-3.5 leading-relaxed">
              {cameraError}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => startCamera(resolution)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#171717] font-medium text-xs hover:bg-[#E5E5E5] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera</span>
              </button>
              <button
                onClick={toggleMockCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#333333] text-white font-medium text-xs hover:bg-[#1A1A1A] transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Use Test Simulation</span>
              </button>
            </div>
          </div>
        )}

        {/* Understated Top Status Tag */}
        <div className="absolute top-2.5 left-2.5 z-15 flex items-center gap-1.5 pointer-events-none text-[10px] sm:text-[11px]">
          <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white/90 border border-white/10 font-medium">
            {useMockCamera ? 'Simulation' : isMirrored ? 'Mirrored' : 'Direct'}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white/70 border border-white/10 uppercase font-mono">
            {resolution}
          </span>
        </div>
      </div>

      {/* Understated Lower Bar - Mobile responsive layout */}
      <div className="bg-[#0D0D0D] border-t border-[#1F1F1F] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#888888]">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {stream ? (
            <button
              onClick={stopCamera}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1A1A1A] text-[#D4D4D4] hover:bg-[#262626] text-[11px] transition-colors"
            >
              <Square className="w-3 h-3" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={() => startCamera(resolution)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#FFFFFF] text-[#171717] hover:bg-[#E5E5E5] text-[11px] font-medium transition-colors"
            >
              <Camera className="w-3 h-3" />
              <span>Start</span>
            </button>
          )}

          {/* Quick Camera Refresh button (helps user unstuck camera instantly) */}
          <button
            onClick={refreshCamera}
            title="Refresh Camera"
            className="flex items-center gap-1 px-2 py-1 rounded border border-[#262626] text-[#A3A3A3] hover:text-white hover:bg-[#1A1A1A] text-[11px] transition-colors"
          >
            <RotateCw className="w-3 h-3" />
            <span className="hidden xs:inline">Refresh</span>
          </button>

          <button
            onClick={toggleMockCamera}
            className="flex items-center gap-1 px-2 py-1 rounded border border-[#262626] text-[#A3A3A3] hover:text-white text-[11px] transition-colors"
          >
            {useMockCamera ? <VideoOff className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{useMockCamera ? 'Exit Test' : 'Test Feed'}</span>
          </button>
        </div>

        <div className="text-[10px] sm:text-[11px] text-[#737373] font-mono flex items-center gap-1.5 ml-auto">
          <span>{settings.charSize}px</span>
          <span>•</span>
          <span className="uppercase">{settings.palette}</span>
        </div>
      </div>
    </div>
  );
});

CameraView.displayName = 'CameraView';
