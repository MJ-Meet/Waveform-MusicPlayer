import * as MediaLibrary from 'expo-media-library';
import { Track } from '../types';
import { MetadataService } from './MetadataService';
import { generateId } from '../utils/generateId';

const AUDIO_EXTENSIONS = [
  '.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac', '.opus', '.wma', '.aiff', '.alac',
];

const EXCLUDED_PATTERNS = [
  /call[\s_-]*rec(ording)?/i,
  /record(ing)?[\s_-]*\d+/i,
  /audio[\s_-]*record(er|ing)?/i,
  /voice[\s_-]*record(er|ing)?/i,
  /voice[\s_-]*memo/i,
  /voice[\s_-]*note/i,
  /voicenote/i,
  /whatsapp[\s_-]*audio/i,
  /^ptt[\s_-]/i,
  /^aud[\s_-]\d{6,}/i,
  /call_rec_/i,
  /telegram[\s_-]*audio/i,
  /\/call_?recordings?\//i,
  /\/recordings?\//i,
  /\/voice_?recorder\//i,
  /\/notifications?\//i,
  /\/ringtones?\//i,
  /\/alarms?\//i,
];

function isMusicFile(filename: string, duration?: number, uri?: string): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase();

  // Extension check
  if (!AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return false;
  }

  // Duration check: ignore audio under 15s during automatic scan (notifications, beeps, ringtones)
  if (duration !== undefined && duration > 0 && duration < 15) {
    return false;
  }

  // Exclude call recordings, voice memos, WhatsApp PTT, etc.
  const target = `${filename} ${uri || ''}`;
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(target)) {
      return false;
    }
  }

  return true;
}

export const AndroidMusicScanner = {
  async requestPermission(): Promise<boolean> {
    try {
      const res = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
      return res.status === 'granted' || res.granted;
    } catch {
      try {
        const res = await MediaLibrary.requestPermissionsAsync();
        return res.status === 'granted' || res.granted;
      } catch {
        return false;
      }
    }
  },

  async hasPermission(): Promise<boolean> {
    try {
      const res = await MediaLibrary.getPermissionsAsync(false, ['audio']);
      return res.status === 'granted' || res.granted;
    } catch {
      try {
        const res = await MediaLibrary.getPermissionsAsync();
        return res.status === 'granted' || res.granted;
      } catch {
        return false;
      }
    }
  },

  async scanAllAudio(
    onProgress?: (current: number, total: number) => void
  ): Promise<Track[]> {
    const tracks: Track[] = [];

    // Attempt 1: Modern Expo SDK 57 Query API
    try {
      if (MediaLibrary.Query && MediaLibrary.AssetField && MediaLibrary.MediaType) {
        const query = new MediaLibrary.Query()
          .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.AUDIO);
        
        const assets = await query.exe();
        if (assets && assets.length > 0) {
          let processed = 0;
          for (const asset of assets) {
            try {
              const filename = (await asset.getFilename()) || `audio_${processed}.mp3`;
              const uri = asset.id; // Content URI on Android
              const rawDuration = (await asset.getDuration()) || 0;
              const durationSec = rawDuration > 1000 ? rawDuration / 1000 : rawDuration;
              const creationTime = (await asset.getCreationTime()) || Date.now();

              // Filter out call recordings & voice memos
              if (!isMusicFile(filename, durationSec, uri)) {
                processed++;
                onProgress?.(processed, assets.length);
                continue;
              }

              const metadata = await MetadataService.parseTrack(
                uri,
                filename,
                durationSec,
                0,
                null
              );

              const track: Track = {
                id: generateId(uri),
                uri,
                filename,
                title: metadata.title || filename.replace(/\.[^.]+$/, ''),
                artist: metadata.artist || 'Unknown Artist',
                album: metadata.album || 'Unknown Album',
                duration: durationSec,
                artworkUri: metadata.artworkUri || null,
                artworkColor: null,
                fileSize: 0,
                dateAdded: creationTime,
                lastPlayedAt: null,
                playCount: 0,
                isFavorite: false,
                mood: metadata.mood || null,
                bpmEstimate: metadata.bpmEstimate || null,
              };

              tracks.push(track);
            } catch (e) {
              console.warn('[Scanner Query] Skipping asset:', e);
            }
            processed++;
            onProgress?.(processed, assets.length);
          }

          if (tracks.length > 0) {
            return tracks;
          }
        }
      }
    } catch (queryErr) {
      console.warn('[Scanner] Query API error, trying getAssetsAsync fallback:', queryErr);
    }

    // Attempt 2: Legacy getAssetsAsync API
    try {
      let after: string | undefined = undefined;
      let totalCount = 0;
      let processed = 0;

      const initial = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType?.AUDIO ?? 'audio',
        first: 1,
      });
      totalCount = initial.totalCount;

      if (totalCount > 0) {
        do {
          const result = await MediaLibrary.getAssetsAsync({
            mediaType: MediaLibrary.MediaType?.AUDIO ?? 'audio',
            first: 100,
            after,
          });

          for (const asset of result.assets) {
            const rawDuration = asset.duration || 0;
            const durationSec = rawDuration > 1000 ? rawDuration / 1000 : rawDuration;

            if (!isMusicFile(asset.filename, durationSec, asset.uri)) {
              processed++;
              onProgress?.(processed, totalCount);
              continue;
            }

            try {
              const uri = asset.uri;
              const metadata = await MetadataService.parseTrack(
                uri,
                asset.filename,
                durationSec,
                0,
                null
              );

              const track: Track = {
                id: generateId(uri),
                uri,
                filename: asset.filename,
                title: metadata.title || asset.filename.replace(/\.[^.]+$/, ''),
                artist: metadata.artist || 'Unknown Artist',
                album: metadata.album || 'Unknown Album',
                duration: durationSec,
                artworkUri: metadata.artworkUri || null,
                artworkColor: null,
                fileSize: 0,
                dateAdded: asset.creationTime,
                lastPlayedAt: null,
                playCount: 0,
                isFavorite: false,
                mood: metadata.mood || null,
                bpmEstimate: metadata.bpmEstimate || null,
              };

              tracks.push(track);
            } catch (e) {
              console.warn('[Scanner Legacy] Skipped file:', asset.filename, e);
            }

            processed++;
            onProgress?.(processed, totalCount);
          }

          after = result.endCursor;
          if (!result.hasNextPage) break;
        } while (true);
      }
    } catch (legacyErr) {
      console.warn('[Scanner] Legacy API error:', legacyErr);
    }

    return tracks;
  },

  // Watch for new media additions using MediaLibrary subscription
  subscribeToChanges(callback: (newTracks: Track[]) => void): () => void {
    try {
      const subscription = MediaLibrary.addListener(async (event) => {
        if (event.hasIncrementalChanges) {
          const newTracks = await AndroidMusicScanner.scanAllAudio();
          if (newTracks.length > 0) {
            callback(newTracks);
          }
        }
      });
      return () => subscription.remove();
    } catch {
      return () => {};
    }
  },
};

