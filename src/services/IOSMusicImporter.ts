import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Track } from '../types';
import { MetadataService } from './MetadataService';
import { generateId } from '../utils/generateId';

const MUSIC_DIR = `${FileSystem.documentDirectory ?? ''}music/`;
const AUDIO_MIME_TYPES = ['audio/*'];

async function ensureMusicDirExists(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MUSIC_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MUSIC_DIR, { intermediates: true });
  }
}

export const IOSMusicImporter = {
  async requestPermission(): Promise<boolean> {
    return true;
  },

  async hasPermission(): Promise<boolean> {
    return true;
  },

  async importFiles(
    onProgress?: (current: number, total: number) => void
  ): Promise<Track[]> {
    const result = await DocumentPicker.getDocumentAsync({
      type: AUDIO_MIME_TYPES,
      multiple: true,
      copyToCacheDirectory: false,
    });

    if (result.canceled || result.assets.length === 0) {
      return [];
    }

    await ensureMusicDirExists();

    const tracks: Track[] = [];

    for (let i = 0; i < result.assets.length; i++) {
      const asset = result.assets[i];
      onProgress?.(i, result.assets.length);

      try {
        const filename = asset.name;
        const destUri = `${MUSIC_DIR}${filename}`;

        // Copy file into app sandbox
        await FileSystem.copyAsync({
          from: asset.uri,
          to: destUri,
        });

        const fileInfo = await FileSystem.getInfoAsync(destUri);
        const fileSize = fileInfo.exists && 'size' in fileInfo ? (fileInfo as any).size || 0 : 0;

        const metadata = await MetadataService.parseTrack(
          destUri,
          filename,
          0,
          fileSize,
          null
        );

        const track: Track = {
          id: generateId(destUri),
          uri: destUri,
          filename,
          title: metadata.title || filename.replace(/\.[^.]+$/, ''),
          artist: metadata.artist || 'Unknown Artist',
          album: metadata.album || 'Unknown Album',
          duration: 0,
          artworkUri: null,
          artworkColor: null,
          fileSize,
          dateAdded: Date.now(),
          lastPlayedAt: null,
          playCount: 0,
          isFavorite: false,
          mood: metadata.mood || null,
          bpmEstimate: metadata.bpmEstimate || null,
        };

        tracks.push(track);
      } catch {
        // Skip failed imports
      }
    }

    onProgress?.(result.assets.length, result.assets.length);
    return tracks;
  },

  async getImportedFiles(): Promise<string[]> {
    await ensureMusicDirExists();
    const files = await FileSystem.readDirectoryAsync(MUSIC_DIR);
    return files.map((f) => `${MUSIC_DIR}${f}`);
  },

  async deleteImportedFile(uri: string): Promise<void> {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  },
};
