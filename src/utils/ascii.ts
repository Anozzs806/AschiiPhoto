import type { AsciiPaletteType, FilterSettings } from '../types';

export const PALETTES: Record<AsciiPaletteType, string[]> = {
  // Master detailed palette specified in prompt, sorted dark to light
  detailed: [
    '@', '#', 'W', '$', '8', '&', 'B', 'M', '0', 'Q', 'O', 'D', 'C', 'U',
    'Y', 'X', 'z', 'o', 'c', 'v', 'u', 'n', 'x', 'r', 'j', 'f', 't', '/',
    '\\', '|', '(', ')', '[', ']', '{', '}', '?', '!', ':', ';', '.', ' '
  ],
  // Classic standard ASCII
  classic: ['@', '%', '#', '*', '+', '=', '-', ':', '.', ' '],
  // Matrix/Hacker style (dense kanji/katakana/terminal symbols)
  matrix: ['█', '▓', '▒', '░', '0', '1', 'X', 'Z', 'Y', '7', 'T', ':', '.', ' '],
  // Density blocks
  blocks: ['█', '▉', '▊', '▋', '▌', '▍', '▎', '▏', ' '],
  // Cyber terminal
  cyber: ['#', 'X', '+', '*', '<', '>', '~', '^', '-', ':', '.', ' '],
  // Minimal high-contrast
  minimal: ['#', 'O', '+', ':', '.', ' ']
};

/**
 * Adjust pixel RGB using contrast, brightness, and saturation multipliers
 */
export function adjustColor(
  r: number,
  g: number,
  b: number,
  contrast: number,
  brightness: number,
  saturation: number,
  colorBoost: boolean
): [number, number, number] {
  // 1. Contrast & Brightness
  let nr = ((r / 255 - 0.5) * contrast + 0.5) * 255 + brightness;
  let ng = ((g / 255 - 0.5) * contrast + 0.5) * 255 + brightness;
  let nb = ((b / 255 - 0.5) * contrast + 0.5) * 255 + brightness;

  // 2. Saturation
  const lum = 0.299 * nr + 0.587 * ng + 0.114 * nb;
  let sat = saturation;
  if (colorBoost) sat *= 1.35;

  nr = lum + (nr - lum) * sat;
  ng = lum + (ng - lum) * sat;
  nb = lum + (nb - lum) * sat;

  // Clamp 0-255
  return [
    Math.max(0, Math.min(255, Math.round(nr))),
    Math.max(0, Math.min(255, Math.round(ng))),
    Math.max(0, Math.min(255, Math.round(nb))),
  ];
}

/**
 * Get ASCII character based on brightness and selected palette
 */
export function getAsciiChar(
  r: number,
  g: number,
  b: number,
  palette: string[],
  inverted: boolean
): string {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const normalized = luminance / 255;
  
  let index: number;
  if (inverted) {
    index = Math.floor(normalized * (palette.length - 1));
  } else {
    index = Math.floor((1 - normalized) * (palette.length - 1));
  }
  
  index = Math.max(0, Math.min(palette.length - 1, index));
  return palette[index];
}

/**
 * Render ASCII representation of a source image/video onto a target canvas.
 * Highly optimized for 60fps real-time camera rendering.
 */
export function renderAsciiToCanvas(
  source: CanvasImageSource,
  _sourceWidth: number,
  _sourceHeight: number,
  targetCanvas: HTMLCanvasElement,
  sampleCanvas: HTMLCanvasElement,
  settings: FilterSettings,
  isMirrored: boolean = false
): void {
  const targetCtx = targetCanvas.getContext('2d', { alpha: false });
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!targetCtx || !sampleCtx) return;

  const { charSize, contrast, brightness, saturation, palette: paletteKey, customPalette, inverted, colorBoost, backgroundColor } = settings;
  const activePalette = (paletteKey === 'detailed' && customPalette?.length) 
    ? customPalette.split('') 
    : PALETTES[paletteKey] || PALETTES.detailed;

  const cellH = Math.max(6, charSize);
  const cellW = Math.max(4, Math.round(cellH * 0.58));
  const fontSize = Math.round(cellH * 0.95);

  const cols = Math.floor(targetCanvas.width / cellW);
  const rows = Math.floor(targetCanvas.height / cellH);

  if (cols <= 0 || rows <= 0) return;

  if (sampleCanvas.width !== cols || sampleCanvas.height !== rows) {
    sampleCanvas.width = cols;
    sampleCanvas.height = rows;
  }

  sampleCtx.save();
  if (isMirrored) {
    sampleCtx.translate(cols, 0);
    sampleCtx.scale(-1, 1);
  }
  sampleCtx.drawImage(source, 0, 0, cols, rows);
  sampleCtx.restore();

  const imgData = sampleCtx.getImageData(0, 0, cols, rows);
  const pixels = imgData.data;

  targetCtx.fillStyle = backgroundColor || '#050505';
  targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

  targetCtx.font = `bold ${fontSize}px "Fira Code", monospace`;
  targetCtx.textBaseline = 'top';
  targetCtx.textAlign = 'left';

  for (let y = 0; y < rows; y++) {
    const yPos = y * cellH;
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * 4;
      const rawR = pixels[idx];
      const rawG = pixels[idx + 1];
      const rawB = pixels[idx + 2];

      const [r, g, b] = adjustColor(rawR, rawG, rawB, contrast, brightness, saturation, colorBoost);
      const char = getAsciiChar(r, g, b, activePalette, inverted);

      if (char === ' ') continue;

      targetCtx.fillStyle = `rgb(${r},${g},${b})`;
      targetCtx.fillText(char, x * cellW, yPos);
    }
  }

  if (settings.scanlines) {
    targetCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    for (let y = 0; y < targetCanvas.height; y += 4) {
      targetCtx.fillRect(0, y, targetCanvas.width, 1.5);
    }
  }
}

/**
 * Render a high-resolution ASCII snapshot from an image source
 */
export function generateHighResAscii(
  imgSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  settings: FilterSettings,
  isMirrored: boolean = false
): Promise<string> {
  return new Promise((resolve) => {
    let width = 1280;
    let height = 720;

    if (imgSource instanceof HTMLVideoElement) {
      width = imgSource.videoWidth || 1280;
      height = imgSource.videoHeight || 720;
    } else if (imgSource instanceof HTMLCanvasElement) {
      width = imgSource.width || 1280;
      height = imgSource.height || 720;
    } else if (imgSource instanceof HTMLImageElement) {
      width = imgSource.naturalWidth || 1280;
      height = imgSource.naturalHeight || 720;
    }

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = width;
    renderCanvas.height = height;

    const sampleCanvas = document.createElement('canvas');

    renderAsciiToCanvas(imgSource, width, height, renderCanvas, sampleCanvas, settings, isMirrored);

    resolve(renderCanvas.toDataURL('image/png', 0.95));
  });
}
