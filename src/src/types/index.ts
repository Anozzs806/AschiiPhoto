export type AsciiPaletteType = 'detailed' | 'matrix' | 'blocks' | 'classic' | 'minimal' | 'cyber';

export interface FilterSettings {
  charSize: number; // e.g. 6 to 18 (determines character density)
  fontSize: number; // matching font size
  contrast: number; // 0.5 to 2.0 (default 1.15)
  brightness: number; // -50 to 50 (default 5)
  saturation: number; // 0.0 to 2.5 (default 1.25)
  palette: AsciiPaletteType;
  customPalette?: string;
  inverted: boolean;
  scanlines: boolean;
  glow: boolean;
  vignette: boolean;
  colorBoost: boolean; // enhance RGB saturation for punchy ASCII characters
  backgroundColor: string; // default '#050505'
}

export interface CapturedPhoto {
  id: string;
  captureNumber: number;
  timestamp: number;
  asciiDataUrl: string;
  originalDataUrl: string;
  preferredView: 'ascii' | 'original';
  width: number;
  height: number;
  aspectRatio: number;
  settingsSnapshot: FilterSettings;
}

export type PaperStyle = 'classic-white' | 'terminal-black' | 'vintage-cream' | 'cyber-neon' | 'custom';

export interface StripCustomization {
  title: string;
  caption: string;
  paperStyle: PaperStyle;
  customBgColor: string;
  customTextColor: string;
  borderWidth: number; // 8 to 32px
  photoGap: number; // 8 to 32px
  padding: number; // 16 to 48px
  showDate: boolean;
  showTime: boolean;
  showBarcode: boolean;
  showAsciiFooter: boolean;
  photoModes: ('ascii' | 'original')[]; // mode for each of the 3 photos
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'SYS' | 'CAM' | 'ASCII' | 'CAPTURE' | 'ALBUM' | 'WARN';
  message: string;
}

export type CameraResolution = '720p' | '1080p' | '480p';
