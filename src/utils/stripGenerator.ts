import type { CapturedPhoto, StripCustomization } from '../types';

interface MinimalThemeColors {
  bg: string;
  cardBg: string;
  border: string;
  text: string;
  muted: string;
}

export function getMinimalThemeColors(paperStyle: string): MinimalThemeColors {
  switch (paperStyle) {
    case 'terminal-black':
    case 'dark':
      return {
        bg: '#0F0F0F',
        cardBg: '#171717',
        border: '#2A2A2A',
        text: '#F5F5F5',
        muted: '#888888',
      };
    case 'vintage-cream':
    case 'warm':
      return {
        bg: '#FBF8F2',
        cardBg: '#F5F0E6',
        border: '#E8E0D2',
        text: '#262421',
        muted: '#7A756D',
      };
    case 'classic-white':
    default:
      return {
        bg: '#FFFFFF',
        cardBg: '#FFFFFF',
        border: '#EAEAEA',
        text: '#171717',
        muted: '#888888',
      };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Generate a high-resolution canvas of the minimalist 3-photo physical photobooth strip
 */
export async function generateStripCanvas(
  photos: CapturedPhoto[],
  customization: StripCustomization
): Promise<HTMLCanvasElement> {
  if (photos.length !== 3) {
    throw new Error('Photo strip requires exactly 3 photos.');
  }

  const theme = getMinimalThemeColors(customization.paperStyle);

  // Standard photobooth strip width: 720px
  const stripWidth = 720;
  const paddingX = customization.padding * 1.5;
  const paddingY = customization.padding * 1.8;
  const photoGap = customization.photoGap * 1.4;
  const innerBorder = customization.borderWidth;

  const photoWidth = stripWidth - paddingX * 2;
  
  // Adapt frame height to photo orientation (portrait on phones vs landscape on laptops)
  const avgAspect = photos.reduce((sum, p) => sum + (p.aspectRatio || (p.width && p.height ? p.width / p.height : 16 / 9)), 0) / 3;
  const isPortraitPhotos = avgAspect < 1;
  const photoHeight = isPortraitPhotos
    ? Math.round(photoWidth * Math.min(1.33, 1 / Math.max(0.65, avgAspect))) // e.g. 3:4 or 4:5 vertical frames
    : Math.round(photoWidth * (9 / 16)); // 16:9 landscape frames

  // Subtle minimal header (optional title) and footer
  const headerHeight = customization.title ? 70 : 30;
  const footerHeight = (customization.caption || customization.showDate) ? 90 : 40;

  const totalHeight = paddingY * 2 + headerHeight + (photoHeight * 3) + (photoGap * 2) + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = stripWidth;
  canvas.height = totalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context for strip canvas');

  // 1. Plain White / Clean Paper Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, stripWidth, totalHeight);

  let currentY = paddingY;

  // 2. Subtle Minimal Header
  if (customization.title) {
    ctx.textAlign = 'center';
    ctx.font = '500 18px "Inter", -apple-system, sans-serif';
    ctx.fillStyle = theme.text;
    ctx.letterSpacing = '3px';
    ctx.fillText(customization.title.toUpperCase(), stripWidth / 2, currentY + 30);
    ctx.letterSpacing = '0px';
    currentY += headerHeight;
  } else {
    currentY += 20;
  }

  // 3. Exactly 3 Vertically Stacked Photos
  for (let i = 0; i < 3; i++) {
    const photo = photos[i];
    const mode = customization.photoModes[i] || 'ascii';
    const srcUrl = mode === 'ascii' ? photo.asciiDataUrl : photo.originalDataUrl;

    try {
      const img = await loadImage(srcUrl);

      const px = paddingX;
      const py = currentY;

      // Draw subtle border if requested
      if (innerBorder > 0) {
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = innerBorder;
        ctx.strokeRect(px - innerBorder / 2, py - innerBorder / 2, photoWidth + innerBorder, photoHeight + innerBorder);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, photoWidth, photoHeight);
      ctx.clip();

      const imgRatio = img.width / img.height;
      const targetRatio = photoWidth / photoHeight;
      let drawW = photoWidth;
      let drawH = photoHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > targetRatio) {
        drawW = photoHeight * imgRatio;
        offsetX = -(drawW - photoWidth) / 2;
      } else {
        drawH = photoWidth / imgRatio;
        offsetY = -(drawH - photoHeight) / 2;
      }

      ctx.drawImage(img, px + offsetX, py + offsetY, drawW, drawH);
      ctx.restore();

    } catch (e) {
      console.error(`Failed to load photo ${i + 1}:`, e);
    }

    currentY += photoHeight + photoGap;
  }

  // 4. Subtle Footer Area
  currentY += 15;

  if (customization.caption) {
    ctx.textAlign = 'center';
    ctx.font = '500 15px "Inter", -apple-system, sans-serif';
    ctx.fillStyle = theme.text;
    ctx.fillText(customization.caption, stripWidth / 2, currentY + 16);
    currentY += 26;
  }

  if (customization.showDate) {
    const now = new Date(photos[2].timestamp || Date.now());
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '.');

    ctx.textAlign = 'center';
    ctx.font = '400 12px "Inter", -apple-system, sans-serif';
    ctx.fillStyle = theme.muted;
    ctx.fillText(dateStr, stripWidth / 2, currentY + 14);
  }

  return canvas;
}

export function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  format: 'image/png' | 'image/jpeg' = 'image/png'
): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL(format, format === 'image/jpeg' ? 0.95 : undefined);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
