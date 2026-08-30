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

// Parse ID3v2 tags from a local FILE (file:// URIs only — not content://)
async function parseId3Tags(uri: string): Promise<Partial<Track> | null> {
  // content:// URIs (Android Media Store) do NOT support offset/length reads
  // via expo-file-system — skip ID3 parsing and fall back to filename parsing
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

    // Check ID3v2 signature: 0x49 0x44 0x33 ("ID3")
    if (
      headerBytes[0] !== 0x49 ||
      headerBytes[1] !== 0x44 ||
      headerBytes[2] !== 0x33
    ) {
      return null;
    }

    const id3Version = headerBytes[3];
    const tagSize = syncsafeToInt(headerBytes[6], headerBytes[7], headerBytes[8], headerBytes[9]);

    if (tagSize <= 0 || tagSize > 5 * 1024 * 1024) return null;

    const blockBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: tagSize + 10,
      position: 0,
    });
    const bytes = base64ToBytes(blockBase64);

    const tags = parseId3Frames(bytes, 10, tagSize + 10, id3Version);
    return tags;
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

    const encoding = frameData[0];
    const text = decodeFrameText(frameData.slice(1), encoding);

    if (frameId === 'TIT2' || frameId === 'TT2') {
      result.title = text.trim();
    } else if (frameId === 'TPE1' || frameId === 'TP1') {
      result.artist = text.trim();
    } else if (frameId === 'TALB' || frameId === 'TAL') {
      result.album = text.trim();
    }
  }

  return result;
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

function parseFilename(filename: string): { title: string; artist: string } {
  const base = filename.replace(/\.[^.]+$/, '');

  const dashMatch = base.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (dashMatch) {
    return { artist: dashMatch[1].trim(), title: dashMatch[2].trim() };
  }

  const numberedMatch = base.match(/^\d+[.\s]+(.+)$/);
  if (numberedMatch) {
    return { title: numberedMatch[1].trim(), artist: 'Unknown Artist' };
  }

  return { title: base.trim(), artist: 'Unknown Artist' };
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

    const title = tags.title || filenameTitle;
    const artist = tags.artist || filenameArtist;
    const album = tags.album || 'Unknown Album';
    const mood = estimateMood(title, artist, album);
    const bpmEstimate = estimateBpm(title);

    return {
      title,
      artist,
      album,
      artworkUri,
      mood,
      bpmEstimate,
    };
  },
};
