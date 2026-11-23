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
 * Preserves exact physical aspect ratio without squishing ("anti-gepeng").
 */
export function renderAsciiToCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
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

  // Get true source dimensions
  let srcW = sourceWidth || 1280;
  let srcH = sourceHeight || 720;
  if (source instanceof HTMLVideoElement && source.videoWidth > 0) {
    srcW = source.videoWidth;
    srcH = source.videoHeight;
  } else if (source instanceof HTMLCanvasElement && source.width > 0) {
    srcW = source.width;
    srcH = source.height;
  } else if (source instanceof HTMLImageElement && source.naturalWidth > 0) {
    srcW = source.naturalWidth;
    srcH = source.naturalHeight;
  }

  // Monospace character font and exact metric calculation
  const fontSize = Math.max(6, Math.round(charSize * 0.95));
  targetCtx.font = `bold ${fontSize}px "JetBrains Mono", "Courier New", monospace`;
  
  // Measure standard monospace character width dynamically
  const measuredW = targetCtx.measureText('M').width || (fontSize * 0.6);
  const cellW = Math.max(4, Math.round(measuredW));
  const cellH = Math.max(6, charSize);

  const cols = Math.floor(targetCanvas.width / cellW);
  const rows = Math.floor(targetCanvas.height / cellH);

  if (cols <= 0 || rows <= 0) return;

  if (sampleCanvas.width !== cols || sampleCanvas.height !== rows) {
    sampleCanvas.width = cols;
    sampleCanvas.height = rows;
  }

  // Calculate EXACT visual aspect ratio of the rendered ASCII character grid
  // This guarantees that horizontal scale == vertical scale (zero distortion / anti-gepeng)
  const visualGridAspect = (cols * cellW) / (rows * cellH);
  const srcAspect = srcW / srcH;

  let cropX = 0;
  let cropY = 0;
  let cropW = srcW;
  let cropH = srcH;

  if (srcAspect > visualGridAspect) {
    // Source video is wider than visual grid: crop horizontal sides (center crop)
    cropW = srcH * visualGridAspect;
    cropX = (srcW - cropW) / 2;
  } else {
    // Source video is taller than visual grid: crop top & bottom (center crop)
    cropH = srcW / visualGridAspect;
    cropY = (srcH - cropH) / 2;
  }

  sampleCtx.save();
  if (isMirrored) {
    sampleCtx.translate(cols, 0);
    sampleCtx.scale(-1, 1);
  }

  // Sample with source crop mapped to (0, 0, cols, rows)
  sampleCtx.drawImage(
    source,
    cropX, cropY, cropW, cropH,
    0, 0, cols, rows
  );
  sampleCtx.restore();

  const imgData = sampleCtx.getImageData(0, 0, cols, rows);
  const pixels = imgData.data;

  targetCtx.fillStyle = backgroundColor || '#050505';
  targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

  targetCtx.font = `bold ${fontSize}px "JetBrains Mono", "Courier New", monospace`;
  targetCtx.textBaseline = 'top';
  targetCtx.textAlign = 'left';

  // Center the ASCII grid if there's any small rounding remainder
  const offsetX = Math.floor((targetCanvas.width - cols * cellW) / 2);
  const offsetY = Math.floor((targetCanvas.height - rows * cellH) / 2);

  for (let y = 0; y < rows; y++) {
    const yPos = offsetY + y * cellH;
    for (let x = 0; x < cols; x++) {
      const idx = (y * cols + x) * 4;
      const rawR = pixels[idx];
      const rawG = pixels[idx + 1];
      const rawB = pixels[idx + 2];

      const [r, g, b] = adjustColor(rawR, rawG, rawB, contrast, brightness, saturation, colorBoost);
      const char = getAsciiChar(r, g, b, activePalette, inverted);

      if (char === ' ') continue;

      targetCtx.fillStyle = `rgb(${r},${g},${b})`;
      targetCtx.fillText(char, offsetX + x * cellW, yPos);
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
 * Optionally preserves the specified viewfinder aspect ratio
 */
export function generateHighResAscii(
  imgSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  settings: FilterSettings,
  isMirrored: boolean = false,
  targetAspect?: number
): Promise<string> {
  return new Promise((resolve) => {
    let srcW = 1280;
    let srcH = 720;

    if (imgSource instanceof HTMLVideoElement) {
      srcW = imgSource.videoWidth || 1280;
      srcH = imgSource.videoHeight || 720;
    } else if (imgSource instanceof HTMLCanvasElement) {
      srcW = imgSource.width || 1280;
      srcH = imgSource.height || 720;
    } else if (imgSource instanceof HTMLImageElement) {
      srcW = imgSource.naturalWidth || 1280;
      srcH = imgSource.naturalHeight || 720;
    }

    const aspect = targetAspect || (srcW / srcH);
    let width = 1280;
    let height = Math.round(width / aspect);
    if (aspect < 1.0) {
      // Portrait orientation
      height = 1280;
      width = Math.round(height * aspect);
    }

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = width;
    renderCanvas.height = height;

    const sampleCanvas = document.createElement('canvas');

    renderAsciiToCanvas(imgSource, srcW, srcH, renderCanvas, sampleCanvas, settings, isMirrored);

    resolve(renderCanvas.toDataURL('image/png', 0.95));
  });
}
