import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Camera, RefreshCw, AlertCircle, Play, Square, VideoOff, RotateCw } from 'lucide-react';
import type { FilterSettings, CameraResolution, CapturedPhoto } from '../types';
import { renderAsciiToCanvas, generateHighResAscii } from '../utils/ascii';
import { sound } from '../services/audio';

export interface CameraViewHandle {
  triggerCapture: () => void;
  startCamera: (res?: CameraResolution, facing?: 'user' | 'environment') => Promise<void>;
  stopCamera: () => void;
  refreshCamera: () => void;
  toggleMockCamera: () => void;
  switchCamera: (newFacing: 'user' | 'environment') => Promise<void>;
  changeResolution: (newRes: CameraResolution) => Promise<void>;
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
  isSwitching?: boolean;
  onSwitchingStateChange?: (switching: boolean) => void;
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
  onSwitchingStateChange,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mockCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [useMockCamera, setUseMockCamera] = useState(false);

  // Dynamic device orientation tracking
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  );

  // Previous facingMode and resolution refs to detect what changed
  const prevFacingModeRef = useRef(facingMode);
  const prevResolutionRef = useRef(resolution);

  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const animFrameIdRef = useRef<number | null>(null);
  const mockAnimRef = useRef<number | null>(null);

  if (!sampleCanvasRef.current && typeof document !== 'undefined') {
    sampleCanvasRef.current = document.createElement('canvas');
  }

  // Listen to orientation change & window resize for portrait/landscape adaptation
  useEffect(() => {
    const handleOrientation = () => {
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
    };

    window.addEventListener('resize', handleOrientation);
    window.addEventListener('orientationchange', handleOrientation);
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientation);
    }

    return () => {
      window.removeEventListener('resize', handleOrientation);
      window.removeEventListener('orientationchange', handleOrientation);
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientation);
      }
    };
  }, []);

  const getResolutionConstraints = useCallback((res: CameraResolution) => {
    switch (res) {
      case '1080p':
        return { width: { ideal: 1920 }, height: { ideal: 1080 } };
      case '480p':
        return { width: { ideal: 640 }, height: { ideal: 480 } };
      case '720p':
      default:
        return { width: { ideal: 1280 }, height: { ideal: 720 } };
    }
  }, []);

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

  // Robust Camera Startup with multi-camera identification and progressive fallback
  const startCamera = useCallback(async (
    targetRes: CameraResolution = resolution,
    targetFacing: 'user' | 'environment' = facingMode
  ) => {
    setCameraError(null);
    setUseMockCamera(false);
    setIsReconnecting(true);
    onSwitchingStateChange?.(true);

    safelyStopActiveTracks();
    // Allow mobile camera driver (Android HAL / iOS AVFoundation) 180ms to cleanly release sensor
    await new Promise((r) => setTimeout(r, 180));

    try {
      onAddLog('CAM', `Connecting to ${targetFacing === 'user' ? 'front' : 'back'} camera (${targetRes})...`);

      // 1. Check enumerated devices to find specific hardware camera lens on phones
      let targetDeviceId: string | undefined;
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevs = devices.filter((d) => d.kind === 'videoinput');
          if (videoDevs.length > 1) {
            const matched = videoDevs.find((d) => {
              const label = (d.label || '').toLowerCase();
              if (targetFacing === 'environment') {
                return label.includes('back') || label.includes('rear') || label.includes('environment');
              } else {
                return label.includes('front') || label.includes('user') || label.includes('face');
              }
            });
            if (matched && matched.deviceId) {
              targetDeviceId = matched.deviceId;
            }
          }
        }
      } catch (e) {
        console.warn('Enumerate devices lookup warning:', e);
      }

      const resConstraints = getResolutionConstraints(targetRes);
      let mediaStream: MediaStream | null = null;

      // Tier 1: Target deviceId + ideal facingMode
      if (targetDeviceId) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { ideal: targetDeviceId },
              facingMode: { ideal: targetFacing },
              ...resConstraints,
            },
            audio: false,
          });
        } catch {}
      }

      // Tier 2: Ideal facingMode + resolution (avoids exact: facingMode which fails on many Android devices)
      if (!mediaStream) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: targetFacing },
              ...resConstraints,
            },
            audio: false,
          });
        } catch {}
      }

      // Tier 3: Bare facingMode
      if (!mediaStream) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetFacing },
            audio: false,
          });
        } catch {}
      }

      // Tier 4: Generic video fallback
      if (!mediaStream) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve();

          let resolved = false;
          const onReady = () => {
            if (resolved) return;
            resolved = true;
            resolve();
          };

          videoRef.current.onloadedmetadata = onReady;
          videoRef.current.onloadeddata = onReady;
          videoRef.current.oncanplay = onReady;

          setTimeout(onReady, 1200);
        });

        await videoRef.current.play().catch(() => {});
      }

      onStreamStatusChange(true);
      onAddLog('CAM', `Camera active (${targetFacing === 'user' ? 'Front' : 'Back'}).`);
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('Camera access failed:', error);
      setCameraError(error.message || 'Unable to access camera.');
      onStreamStatusChange(false);
      onAddLog('WARN', `Camera error: ${error.message}`);
    } finally {
      setIsReconnecting(false);
      onSwitchingStateChange?.(false);
    }
  }, [facingMode, getResolutionConstraints, onAddLog, onStreamStatusChange, onSwitchingStateChange, resolution, safelyStopActiveTracks]);

  const stopCamera = useCallback(() => {
    safelyStopActiveTracks();
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    onStreamStatusChange(false);
    onAddLog('CAM', 'Camera stopped.');
  }, [onAddLog, onStreamStatusChange, safelyStopActiveTracks]);

  const refreshCamera = useCallback(() => {
    sound.playKeyClick();
    onAddLog('CAM', 'Refreshing camera stream...');
    startCamera(resolution, facingMode);
  }, [facingMode, onAddLog, resolution, startCamera]);

  const switchCamera = useCallback(async (newFacing: 'user' | 'environment') => {
    await startCamera(resolution, newFacing);
  }, [resolution, startCamera]);

  const changeResolution = useCallback(async (newRes: CameraResolution) => {
    await startCamera(newRes, facingMode);
  }, [facingMode, startCamera]);

  // AUTOMATIC CAMERA REFRESH:
  // When facingMode or resolution changes, automatically acquire camera without requiring manual refresh!
  useEffect(() => {
    if (prevFacingModeRef.current !== facingMode) {
      prevFacingModeRef.current = facingMode;
      prevResolutionRef.current = resolution;
      startCamera(resolution, facingMode);
      return;
    }

    if (prevResolutionRef.current !== resolution) {
      prevResolutionRef.current = resolution;
      startCamera(resolution, facingMode);
    }
  }, [facingMode, resolution, startCamera]);

  // Initial startup
  useEffect(() => {
    startCamera(resolution, facingMode);
    return () => {
      safelyStopActiveTracks();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (mockAnimRef.current) cancelAnimationFrame(mockAnimRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Synthetic Test Pattern Feed
  useEffect(() => {
    if (!useMockCamera) return;

    const mockW = isLandscape ? 960 : 720;
    const mockH = isLandscape ? 540 : 960;

    if (!mockCanvasRef.current) {
      mockCanvasRef.current = document.createElement('canvas');
    }

    const mockCanvas = mockCanvasRef.current;
    mockCanvas.width = mockW;
    mockCanvas.height = mockH;

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

      for (let r = 180; r > 30; r -= 30) {
        mCtx.strokeStyle = `hsl(${(t * 40 + r) % 360}, 90%, 55%)`;
        mCtx.lineWidth = 4;
        mCtx.beginPath();
        mCtx.arc(cx, cy, r + Math.sin(t + r) * 10, 0, Math.PI * 2);
        mCtx.stroke();
      }

      // Proportional face circle (guaranteed 1:1)
      mCtx.fillStyle = '#ff8c38';
      mCtx.beginPath();
      mCtx.arc(cx, cy - 20, 85, 0, Math.PI * 2);
      mCtx.fill();

      // Eyes
      mCtx.fillStyle = '#00F0FF';
      mCtx.fillRect(cx - 45 + Math.sin(t) * 4, cy - 35, 22, 14);
      mCtx.fillRect(cx + 23 + Math.sin(t) * 4, cy - 35, 22, 14);

      // Smile
      mCtx.strokeStyle = '#39FF88';
      mCtx.lineWidth = 5;
      mCtx.beginPath();
      mCtx.arc(cx, cy - 10, 42, 0.1 * Math.PI, 0.9 * Math.PI);
      mCtx.stroke();

      // Clothes
      mCtx.fillStyle = '#9d4edd';
      mCtx.beginPath();
      mCtx.moveTo(cx - 150, mockCanvas.height);
      mCtx.lineTo(cx - 65, cy + 65);
      mCtx.lineTo(cx + 65, cy + 65);
      mCtx.lineTo(cx + 150, mockCanvas.height);
      mCtx.closePath();
      mCtx.fill();

      mockAnimRef.current = requestAnimationFrame(drawMockScene);
    };

    mockAnimRef.current = requestAnimationFrame(drawMockScene);

    return () => {
      if (mockAnimRef.current) cancelAnimationFrame(mockAnimRef.current);
    };
  }, [isLandscape, useMockCamera]);

  // Main 60 FPS Render Loop: Anti-gepeng Color ASCII rendering onto Canvas
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

        const srcWidth = useMockCamera
          ? (mockCanvasRef.current?.width || 960)
          : (video!.videoWidth || 1280);
        const srcHeight = useMockCamera
          ? (mockCanvasRef.current?.height || 540)
          : (video!.videoHeight || 720);

        // Exact client bounding rect measurement
        const rect = targetCanvas.getBoundingClientRect();
        const displayW = Math.round(rect.width) || targetCanvas.clientWidth || 640;
        const displayH = Math.round(rect.height) || targetCanvas.clientHeight || 480;

        if (targetCanvas.width !== displayW || targetCanvas.height !== displayH) {
          targetCanvas.width = displayW;
          targetCanvas.height = displayH;
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

  // Capture execution with matching aspect ratio
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

    setShowFlash(true);
    sound.playShutterSound();
    onAddLog('CAPTURE', 'Capturing image...');

    setTimeout(() => {
      setShowFlash(false);
    }, 400);

    try {
      const srcW = useMockCamera ? (mockCanvasRef.current?.width || 960) : (videoRef.current?.videoWidth || 1280);
      const srcH = useMockCamera ? (mockCanvasRef.current?.height || 540) : (videoRef.current?.videoHeight || 720);

      // Target aspect ratio matching the active viewfinder (3:4 for portrait, 16:9 for landscape)
      const targetAspect = isLandscape ? (16 / 9) : (3 / 4);
      const capW = isLandscape ? 1280 : 960;
      const capH = Math.round(capW / targetAspect);

      // 1. High-res Original Photo (center cropped to match viewfinder)
      const origCanvas = document.createElement('canvas');
      origCanvas.width = capW;
      origCanvas.height = capH;
      const oCtx = origCanvas.getContext('2d');
      if (oCtx) {
        let cropX = 0;
        let cropY = 0;
        let cropW = srcW;
        let cropH = srcH;
        const srcAspect = srcW / srcH;

        if (srcAspect > targetAspect) {
          cropW = srcH * targetAspect;
          cropX = (srcW - cropW) / 2;
        } else {
          cropH = srcW / targetAspect;
          cropY = (srcH - cropH) / 2;
        }

        if (isMirrored) {
          oCtx.translate(capW, 0);
          oCtx.scale(-1, 1);
        }
        oCtx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, capW, capH);
      }
      const originalDataUrl = origCanvas.toDataURL('image/png', 0.95);

      // 2. High-res Color ASCII (preserving viewfinder framing)
      const asciiDataUrl = await generateHighResAscii(source, settings, isMirrored, targetAspect);

      const newPhoto: CapturedPhoto = {
        id: `photo_${Date.now()}_${photoCounter + 1}`,
        captureNumber: photoCounter + 1,
        timestamp: Date.now(),
        asciiDataUrl,
        originalDataUrl,
        preferredView: 'ascii',
        width: capW,
        height: capH,
        aspectRatio: targetAspect,
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
    isLandscape,
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
    switchCamera,
    changeResolution,
  }));

  return (
    <div className="flex flex-col items-center justify-center w-full">
      {/* Outer camera card - adjusts seamlessly between portrait & landscape without squishing */}
      <div
        style={
          isLandscape
            ? {
                maxHeight: 'min(62vh, 480px)',
                maxWidth: '94vw',
              }
            : undefined
        }
        className={`relative rounded-xl sm:rounded-2xl overflow-hidden bg-[#080808] border border-[#E5E5E5] shadow-xs flex flex-col transition-all duration-300 ${
          isLandscape
            ? 'w-fit mx-auto items-center'
            : 'w-full max-w-[340px] xs:max-w-[380px] sm:max-w-[420px] mx-auto'
        }`}
      >
        <button data-capture-trigger onClick={triggerCapture} className="hidden" />

        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="hidden"
        />

        {/* Viewport container with mathematically unstretchable aspect-ratio */}
        <div
          style={
            isLandscape
              ? {
                  height: 'min(50vh, 400px)',
                  aspectRatio: '16 / 9',
                  maxWidth: '100%',
                }
              : {
                  width: '100%',
                  aspectRatio: '3 / 4',
                }
          }
          className={`relative bg-[#080808] overflow-hidden flex items-center justify-center ${
            isLandscape ? 'w-auto' : 'h-auto'
          }`}
        >
          {/* Real-time Color ASCII Canvas */}
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
          />

          {/* Optional subtle scanlines if enabled */}
          {settings.scanlines && (
            <div className="absolute inset-0 subtle-scanlines pointer-events-none z-10 opacity-40" />
          )}

          {/* Reconnecting / Camera Switching overlay */}
          {isReconnecting && (
            <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-20 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/90 text-white text-xs border border-white/15 shadow-lg">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                <span className="font-medium">
                  {facingMode === 'user' ? 'Switching to Front camera...' : 'Switching to Back camera...'}
                </span>
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
                  onClick={() => startCamera(resolution, facingMode)}
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
            <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white/70 border border-white/10 text-[9px]">
              {isLandscape ? 'Landscape' : 'Portrait'}
            </span>
          </div>
        </div>

        {/* Lower Toolbar */}
        <div className="w-full bg-[#0D0D0D] border-t border-[#1F1F1F] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#888888]">
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
                onClick={() => startCamera(resolution, facingMode)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#FFFFFF] text-[#171717] hover:bg-[#E5E5E5] text-[11px] font-medium transition-colors"
              >
                <Camera className="w-3 h-3" />
                <span>Start</span>
              </button>
            )}

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
    </div>
  );
});

CameraView.displayName = 'CameraView';
