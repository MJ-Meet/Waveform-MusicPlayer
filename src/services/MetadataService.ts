import * as FileSystem from 'expo-file-system';
import { Track, TrackMood } from '../types';

// Mood keyword heuristics for classification
const MOOD_KEYWORDS: Record<TrackMood, string[]> = {
  chill: [
    'chill', 'lofi', 'lo-fi', 'ambient', 'relax', 'calm', 'sleep', 'study',
    'acoustic', 'soft', 'mellow', 'smooth', 'easy', 'slow', 'background', 'rain',
  ],
  focus: [
    'focus', 'deep', 'concentrate', 'work', 'productivity', 'instrumental',
    'classical', 'piano', 'orchestral', 'cinematic', 'epic', 'brain',
  ],
  workout: [
    'workout', 'gym', 'run', 'training', 'beast', 'power', 'energy', 'hype',
    'hard', 'rock', 'metal', 'pump', 'bass', 'edm', 'electronic', 'dance',
    'rap', 'hip-hop', 'hiphop', 'trap', 'bounce',
  ],
};

function estimateMood(title: string, artist: string, album: string): TrackMood | null {
  const combined = `${title} ${artist} ${album}`.toLowerCase();

  let chillScore = 0;
  let focusScore = 0;
  let workoutScore = 0;

  for (const keyword of MOOD_KEYWORDS.chill) {
    if (combined.includes(keyword)) chillScore++;
  }
  for (const keyword of MOOD_KEYWORDS.focus) {
    if (combined.includes(keyword)) focusScore++;
  }
  for (const keyword of MOOD_KEYWORDS.workout) {
    if (combined.includes(keyword)) workoutScore++;
  }

  const maxScore = Math.max(chillScore, focusScore, workoutScore);
  if (maxScore === 0) return null;

  if (maxScore === chillScore) return 'chill';
  if (maxScore === workoutScore) return 'workout';
  return 'focus';
}

function estimateBpm(title: string): number | null {
  const lower = title.toLowerCase();

  if (MOOD_KEYWORDS.workout.some((k) => lower.includes(k))) {
    return 120 + Math.floor(Math.random() * 40);
  }
  if (MOOD_KEYWORDS.chill.some((k) => lower.includes(k))) {
    return 60 + Math.floor(Math.random() * 30);
  }
  return null;
}

// Parse ID3v2 tags from a local FILE (file:// URIs)
async function parseId3Tags(uri: string): Promise<Partial<Track> | null> {
  if (!uri.startsWith('file://')) return null;

  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) return null;

    const headerBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 10,
      position: 0,
    });

    const headerBytes = base64ToBytes(headerBase64);

    // Check ID3v2 signature: "ID3"
    if (
      headerBytes[0] !== 0x49 ||
      headerBytes[1] !== 0x44 ||
      headerBytes[2] !== 0x33
    ) {
      return null;
    }

    const id3Version = headerBytes[3];
    const tagSize = syncsafeToInt(headerBytes[6], headerBytes[7], headerBytes[8], headerBytes[9]);

    if (tagSize <= 0 || tagSize > 8 * 1024 * 1024) return null;

    const blockBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: tagSize + 10,
      position: 0,
    });
    const bytes = base64ToBytes(blockBase64);

    return parseId3Frames(bytes, 10, tagSize + 10, id3Version);
  } catch {
    return null;
  }
}

function syncsafeToInt(a: number, b: number, c: number, d: number): number {
  return (a << 21) | (b << 14) | (c << 7) | d;
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function parseId3Frames(
  bytes: Uint8Array,
  offset: number,
  end: number,
  version: number
): Partial<Track> {
  const result: Partial<Track> = {};
  const frameIdLen = version < 3 ? 3 : 4;
  const frameSizeLen = version < 3 ? 3 : 4;

  while (offset + frameIdLen + frameSizeLen + 2 < end) {
    const frameId = String.fromCharCode(...Array.from(bytes.slice(offset, offset + frameIdLen)));
    if (!frameId.match(/^[A-Z0-9]{3,4}$/)) break;

    offset += frameIdLen;

    let frameSize: number;
    if (version < 3) {
      frameSize = (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
    } else if (version === 3) {
      frameSize = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    } else {
      frameSize = syncsafeToInt(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    }
    offset += frameSizeLen;
    offset += 2; // skip flags

    if (frameSize <= 0 || frameSize > end - offset) break;

    const frameData = bytes.slice(offset, offset + frameSize);
    offset += frameSize;

    if (frameId === 'TIT2' || frameId === 'TT2') {
      const text = decodeFrameText(frameData.slice(1), frameData[0]);
      if (text) result.title = text.trim();
    } else if (frameId === 'TPE1' || frameId === 'TP1') {
      const text = decodeFrameText(frameData.slice(1), frameData[0]);
      if (text) result.artist = text.trim();
    } else if (frameId === 'TALB' || frameId === 'TAL') {
      const text = decodeFrameText(frameData.slice(1), frameData[0]);
      if (text) result.album = text.trim();
    } else if ((frameId === 'APIC' || frameId === 'PIC') && !result.artworkUri) {
      try {
        const artworkData = extractApicImage(frameData, version);
        if (artworkData) {
          result.artworkUri = artworkData;
        }
      } catch (e) {
        console.warn('[Metadata] Could not extract APIC image:', e);
      }
    }
  }

  return result;
}

function extractApicImage(frameData: Uint8Array, version: number): string | null {
  try {
    const encoding = frameData[0];
    let pos = 1;

    let mimeType = 'image/jpeg';
    if (version < 3) {
      // 3 bytes format e.g. "JPG" or "PNG"
      const format = String.fromCharCode(frameData[pos], frameData[pos + 1], frameData[pos + 2]).toLowerCase();
      mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      pos += 3;
    } else {
      // Null-terminated MIME string
      let mimeStr = '';
      while (pos < frameData.length && frameData[pos] !== 0) {
        mimeStr += String.fromCharCode(frameData[pos]);
        pos++;
      }
      pos++; // skip null
      if (mimeStr.toLowerCase().includes('png')) {
        mimeType = 'image/png';
      }
    }

    // Skip picture type byte
    pos++;

    // Skip description string
    if (encoding === 0 || encoding === 3) {
      while (pos < frameData.length && frameData[pos] !== 0) {
        pos++;
      }
      pos++; // skip null
    } else {
      // UTF-16 has 2 zero bytes
      while (pos + 1 < frameData.length && !(frameData[pos] === 0 && frameData[pos + 1] === 0)) {
        pos += 2;
      }
      pos += 2;
    }

    if (pos >= frameData.length) return null;

    const imgBytes = frameData.slice(pos);
    if (imgBytes.length < 100) return null; // Too small to be a valid image

    const base64 = bytesToBase64(imgBytes);
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

function decodeFrameText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      return Array.from(bytes)
        .map((b) => String.fromCharCode(b))
        .join('')
        .replace(/\0/g, '');
    } else if (encoding === 1) {
      const decoder = new TextDecoder('utf-16');
      return decoder.decode(bytes).replace(/\0/g, '');
    } else if (encoding === 3) {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes).replace(/\0/g, '');
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Clean promotional web tags, quality markers, track numbers, and underscores from filename
 */
export function sanitizeFilename(raw: string): string {
  let name = raw.replace(/\.[^.]+$/, ''); // Strip extension

  // Replace underscores and excessive dots with spaces
  name = name.replace(/_/g, ' ').replace(/\.{2,}/g, ' ');

  // Strip promotional domain names and website tags
  const promoPatterns = [
    /\[?\s*www\.[a-z0-9-]+\.[a-z]{2,6}\s*\]?/gi,
    /\(?\s*www\.[a-z0-9-]+\.[a-z]{2,6}\s*\)?/gi,
    /\[?\s*[a-z0-9-]+\.(com|me|info|link|pw|org|net|in|vip|site|cc|top)\s*\]?/gi,
    /\(?\s*[a-z0-9-]+\.(com|me|info|link|pw|org|net|in|vip|site|cc|top)\s*\)?/gi,
    /\[?\s*(pagalworld|djmaza|songspk|mr-jatt|jiosaavn|gaana|wynk|mp3mad|naasongs|masstamilan|sensongs)\s*\]?/gi,
    /\(?\s*(pagalworld|djmaza|songspk|mr-jatt|jiosaavn|gaana|wynk|mp3mad|naasongs|masstamilan|sensongs)\s*\)?/gi,
  ];

  for (const pattern of promoPatterns) {
    name = name.replace(pattern, '');
  }

  // Strip bitrate and quality tags
  name = name.replace(/\[?\s*(320|256|192|128|64)\s*kbps\s*\]?/gi, '');
  name = name.replace(/\(?\s*(320|256|192|128|64)\s*kbps\s*\)?/gi, '');
  name = name.replace(/\[?\s*(hq|hd|flac|lossless|cd-rip|dvd-rip|web-dl)\s*\]?/gi, '');
  name = name.replace(/\(?\s*(hq|hd|flac|lossless|cd-rip|dvd-rip|web-dl)\s*\)?/gi, '');

  // Strip video and extra tags
  name = name.replace(/\[?\s*(official\s*(music\s*)?(video|audio|track)?|lyrics?|lyrical|audio|full\s*song)\s*\]?/gi, '');
  name = name.replace(/\(?\s*(official\s*(music\s*)?(video|audio|track)?|lyrics?|lyrical|audio|full\s*song)\s*\)?/gi, '');

  // Strip leading track numbers like "01. ", "01 - ", "1. ", "1 - "
  name = name.replace(/^(\d{1,3}[\s.\-_–]+)/, '');

  // Clean empty parentheses or brackets left behind
  name = name.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '').replace(/\{\s*\}/g, '');

  // Normalize whitespace
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}

function parseFilename(filename: string): { title: string; artist: string } {
  const clean = sanitizeFilename(filename);

  // Match "Artist - Title" or "Artist – Title"
  const dashMatch = clean.match(/^(.+?)\s*[-–|:]\s*(.+)$/);
  if (dashMatch) {
    const part1 = dashMatch[1].trim();
    const part2 = dashMatch[2].trim();

    if (part1 && part2) {
      return { artist: part1, title: part2 };
    }
  }

  // Match "Title by Artist"
  const byMatch = clean.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
  }

  return { title: clean || filename.replace(/\.[^.]+$/, ''), artist: 'Unknown Artist' };
}

export const MetadataService = {
  async parseTrack(
    uri: string,
    filename: string,
    duration: number,
    fileSize: number,
    artworkUri: string | null
  ): Promise<Partial<Track>> {
    let tags: Partial<Track> = {};

    try {
      const id3Tags = await parseId3Tags(uri);
      if (id3Tags) {
        tags = id3Tags;
      }
    } catch {
      // Fallback to filename parsing
    }

    const { title: filenameTitle, artist: filenameArtist } = parseFilename(filename);

    const title = tags.title ? sanitizeFilename(tags.title) : filenameTitle;
    const artist = (tags.artist && tags.artist !== 'Unknown Artist') ? sanitizeFilename(tags.artist) : filenameArtist;
    const album = (tags.album && tags.album !== 'Unknown Album') ? sanitizeFilename(tags.album) : 'Unknown Album';
    const finalArtwork = tags.artworkUri || artworkUri;

    const mood = estimateMood(title, artist, album);
    const bpmEstimate = estimateBpm(title);

    return {
      title: title || filenameTitle || 'Unknown Title',
      artist: artist || 'Unknown Artist',
      album,
      artworkUri: finalArtwork,
      mood,
      bpmEstimate,
    };
  },
};

