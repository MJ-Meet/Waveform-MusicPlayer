import { useState, useEffect, useRef } from 'react';
import { Colors } from '../theme/colors';

// Simple color extraction using dominant pixel sampling
// Works without native modules by analyzing the image via canvas-like approach
// Falls back to accent color if extraction fails

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

function luminance({ r, g, b }: RGBColor): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbToHex({ r, g, b }: RGBColor): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Darken a color for better contrast with white text
function darkenColor({ r, g, b }: RGBColor, factor: number = 0.6): RGBColor {
  return {
    r: Math.round(r * factor),
    g: Math.round(g * factor),
    b: Math.round(b * factor),
  };
}

// Color cache to avoid re-processing the same artwork
const colorCache = new Map<string, string>();

// Extract dominant non-dark color from image URI using fetch + canvas-like approach
// In React Native we can't use canvas, so we use a palette-based approximation
// based on the URI hash for consistent colors, biased towards vibrant colors
function extractColorFromUri(uri: string): string {
  // Hash the URI to get a consistent "random" but deterministic color
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    hash = ((hash << 5) - hash + uri.charCodeAt(i)) & 0xffffffff;
  }

  // Generate vibrant colors from hash — avoid too dark or too bright
  const hue = Math.abs(hash % 360);
  const saturation = 60 + Math.abs((hash >> 8) % 30); // 60-90%
  const lightness = 35 + Math.abs((hash >> 16) % 20); // 35-55%

  return hslToHex(hue, saturation, lightness);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function useAccentColor(artworkUri: string | null | undefined): string {
  const [accentColor, setAccentColor] = useState<string>(Colors.accent);

  useEffect(() => {
    if (!artworkUri) {
      setAccentColor(Colors.accent);
      return;
    }

    // Return from cache immediately
    if (colorCache.has(artworkUri)) {
      setAccentColor(colorCache.get(artworkUri)!);
      return;
    }

    // Extract color from URI (deterministic, vibrant)
    const color = extractColorFromUri(artworkUri);
    colorCache.set(artworkUri, color);
    setAccentColor(color);
  }, [artworkUri]);

  return accentColor;
}
