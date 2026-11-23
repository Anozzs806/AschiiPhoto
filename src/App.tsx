import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { CameraView } from './components/CameraView';
import type { CameraViewHandle } from './components/CameraView';
import { CameraControls } from './components/CameraControls';
import { TerminalLogs } from './components/TerminalLogs';
import { PhotoGallery } from './components/PhotoGallery';
import { PhotoStripModal } from './components/PhotoStripModal';
import { SettingsModal } from './components/SettingsModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { PhotoDetailModal } from './components/PhotoDetailModal';
import type { FilterSettings, CapturedPhoto, CameraResolution, LogEntry } from './types';
import { getAllPhotosFromDB, savePhotoToDB, deletePhotoFromDB } from './services/db';
import { sound } from './services/audio';

const DEFAULT_SETTINGS: FilterSettings = {
  charSize: 9, // Fine resolution for recognizable facial details
  fontSize: 9,
  contrast: 1.15,
  brightness: 0,
  saturation: 1.25,
  palette: 'detailed',
  inverted: false,
  scanlines: false, // clean minimalist by default
  glow: false,
  vignette: false,
  colorBoost: true,
  backgroundColor: '#080808',
};

export function App() {
  const cameraRef = useRef<CameraViewHandle>(null);

  // Application State
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<FilterSettings>(() => {
    const saved = localStorage.getItem('ascii_photobooth_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_SETTINGS;
  });

  // Camera Configuration
  const [resolution, setResolution] = useState<CameraResolution>('720p');
  const [isMirrored, setIsMirrored] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [countdownDuration, setCountdownDuration] = useState<number>(3);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [fps, setFps] = useState(0);

  // Sound Engine
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStripModalOpen, setIsStripModalOpen] = useState(false);
  const [inspectPhoto, setInspectPhoto] = useState<CapturedPhoto | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<CapturedPhoto | null>(null);

  // System Stats
  const [, setSystemStats] = useState<{
    charGrid: string;
    renderTimeMs: number;
    activePalette: string;
  }>({
    charGrid: '120x68',
    renderTimeMs: 1.2,
    activePalette: 'DETAILED',
  });

  // Internal event logger (preserved for internal error tracking)
  const addLog = useCallback(
    (_type: LogEntry['type'], _message: string) => {
      // Internal tracking
    },
    []
  );

  // Initial load: IndexedDB photos
  useEffect(() => {
    getAllPhotosFromDB()
      .then((savedPhotos) => {
        setPhotos(savedPhotos);
        if (savedPhotos.length >= 3) {
          setSelectedPhotoIds([savedPhotos[0].id, savedPhotos[1].id, savedPhotos[2].id]);
        } else if (savedPhotos.length > 0) {
          setSelectedPhotoIds(savedPhotos.map((p) => p.id));
        }
      })
      .catch((err) => {
        console.error('Error reading photos from IndexedDB:', err);
      });
  }, []);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('ascii_photobooth_settings', JSON.stringify(settings));
  }, [settings]);

  // Handle Photo Capture
  const handleCaptureComplete = async (newPhoto: CapturedPhoto) => {
    try {
      await savePhotoToDB(newPhoto);
      setPhotos((prev) => [newPhoto, ...prev]);

      setSelectedPhotoIds((prev) => {
        if (prev.length < 3) {
          return [newPhoto.id, ...prev];
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to persist photo:', err);
    }
  };

  // Toggle photo selection for 3-photo strip
  const handleToggleSelectPhoto = (id: string) => {
    setSelectedPhotoIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pId) => pId !== id);
      } else {
        if (prev.length >= 3) {
          return [id, prev[0], prev[1]];
        } else {
          return [...prev, id];
        }
      }
    });
  };

  // Delete photo
  const handleConfirmDelete = async () => {
    if (!photoToDelete) return;
    try {
      await deletePhotoFromDB(photoToDelete.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photoToDelete.id));
      setSelectedPhotoIds((prev) => prev.filter((id) => id !== photoToDelete.id));
    } catch (err) {
      console.error('Failed to delete photo:', err);
    } finally {
      setPhotoToDelete(null);
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.setSoundEnabled(next);
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#171717] flex flex-col font-sans selection:bg-[#171717] selection:text-white">
      {/* 1. Minimalist Header */}
      <Header
        isStreaming={isStreaming}
        fps={fps}
        photoCount={photos.length}
        selectedCount={selectedPhotoIds.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenStripModal={() => setIsStripModalOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-5 sm:space-y-8">
        {/* Title & Editorial Intro */}
        <div className="text-center max-w-xl mx-auto space-y-1 pt-1 sm:pt-2">
          <h2 className="text-lg sm:text-2xl font-semibold tracking-tight text-[#171717]">
            :D
          </h2>
          <p className="text-[11px] sm:text-xs text-[#737373] leading-relaxed">
            Hey... I Recomended Using Pc/Laptop Better Fps Thanks!!!
          </p>
        </div>

        {/* 2. Main Camera Section & Controls */}
        <section className="space-y-3">
          <CameraView
            ref={cameraRef}
            settings={settings}
            resolution={resolution}
            isMirrored={isMirrored}
            facingMode={facingMode}
            countdownDuration={countdownDuration}
            onCaptureComplete={handleCaptureComplete}
            onAddLog={addLog}
            onFpsUpdate={setFps}
            onStreamStatusChange={setIsStreaming}
            onStatsUpdate={setSystemStats}
            photoCounter={photos.length}
            isSwitching={isSwitchingCamera}
            onSwitchingStateChange={setIsSwitchingCamera}
          />

          <CameraControls
            isStreaming={isStreaming}
            isSwitching={isSwitchingCamera}
            countdownDuration={countdownDuration}
            onSetCountdown={setCountdownDuration}
            isMirrored={isMirrored}
            onToggleMirror={() => setIsMirrored(!isMirrored)}
            facingMode={facingMode}
            onToggleFacingMode={() => {
              const next = facingMode === 'user' ? 'environment' : 'user';
              setFacingMode(next);
              // Auto-mirror: mirror for front selfie camera, direct for back environmental camera
              setIsMirrored(next === 'user');
            }}
            resolution={resolution}
            onSetResolution={setResolution}
            onRefreshCamera={() => cameraRef.current?.refreshCamera()}
            onCapture={() => {
              cameraRef.current?.triggerCapture();
            }}
            disabled={!isStreaming || isSwitchingCamera}
          />
        </section>

        {/* 3. Minimalist Terminal Message Section (Editable placeholder content) */}
        <section>
          <TerminalLogs />
        </section>

        {/* 4. Minimalist Photo Gallery */}
        <PhotoGallery
          photos={photos}
          selectedPhotoIds={selectedPhotoIds}
          onToggleSelectPhoto={handleToggleSelectPhoto}
          onOpenPhotoDetail={(photo) => setInspectPhoto(photo)}
          onRequestDelete={(photo) => setPhotoToDelete(photo)}
          onOpenStripModal={() => setIsStripModalOpen(true)}
        />
      </main>

      {/* 5. Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onChangeSettings={setSettings}
        onResetSettings={handleResetSettings}
      />

      <PhotoStripModal
        isOpen={isStripModalOpen}
        onClose={() => setIsStripModalOpen(false)}
        allPhotos={photos}
        selectedPhotoIds={selectedPhotoIds}
        onToggleSelectPhoto={handleToggleSelectPhoto}
        onAddLog={addLog}
      />

      <PhotoDetailModal
        photo={inspectPhoto}
        onClose={() => setInspectPhoto(null)}
        onSelectForStrip={(photo) => handleToggleSelectPhoto(photo.id)}
        isSelectedForStrip={inspectPhoto ? selectedPhotoIds.includes(inspectPhoto.id) : false}
      />

      <DeleteConfirmModal
        isOpen={photoToDelete !== null}
        captureNumber={photoToDelete?.captureNumber ?? 0}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPhotoToDelete(null)}
      />

      {/* Minimalist Footer */}
      <footer className="border-t border-[#E5E5E5] bg-white py-6 px-4 text-center text-xs text-[#888888]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Made By</span>
          <span className="text-[11px] text-[#A3A3A3]">
            Anozzs
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
