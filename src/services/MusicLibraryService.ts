import { Platform } from 'react-native';
import { Track, ScanResult } from '../types';
import { AndroidMusicScanner } from './AndroidMusicScanner';
import { IOSMusicImporter } from './IOSMusicImporter';
import { DatabaseService } from './DatabaseService';

// Platform-agnostic music library service
// The rest of the app only talks to this — not platform-specific scanners
export const MusicLibraryService = {
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return AndroidMusicScanner.requestPermission();
    }
    return IOSMusicImporter.requestPermission();
  },

  async hasPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return AndroidMusicScanner.hasPermission();
    }
    return IOSMusicImporter.hasPermission();
  },

  // Android: auto-scans all device audio
  // iOS: opens document picker for user selection
  async scanOrImport(
    onProgress?: (current: number, total: number) => void
  ): Promise<ScanResult> {
    const errors: string[] = [];
    let tracks: Track[] = [];

    try {
      if (Platform.OS === 'android') {
        tracks = await AndroidMusicScanner.scanAllAudio(onProgress);
      } else {
        tracks = await IOSMusicImporter.importFiles(onProgress);
      }
    } catch (error: any) {
      errors.push(error?.message || 'Unknown scan error');
    }

    return { tracks, errors };
  },

  // Save scan results to DB and update last scanned timestamp
  async persistScanResults(tracks: Track[]): Promise<void> {
    await DatabaseService.upsertTracks(tracks);
    await DatabaseService.setMetadata('lastScanned', Date.now().toString());
  },

  async getLastScanned(): Promise<number | null> {
    const value = await DatabaseService.getMetadata('lastScanned');
    return value ? parseInt(value, 10) : null;
  },

  // Android only: subscribe to new audio file additions
  subscribeToNewFiles(
    callback: (tracks: Track[]) => void
  ): (() => void) | null {
    if (Platform.OS !== 'android') return null;

    return AndroidMusicScanner.subscribeToChanges(async (newTracks) => {
      const freshTracks: Track[] = [];
      for (const track of newTracks) {
        const existing = await DatabaseService.getTrackById(track.id);
        if (!existing) {
          freshTracks.push(track);
        }
      }
      if (freshTracks.length > 0) {
        await DatabaseService.upsertTracks(freshTracks);
        callback(freshTracks);
      }
    });
  },
};
