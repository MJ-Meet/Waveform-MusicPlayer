import * as MediaLibrary from 'expo-media-library';
import { Track } from '../types';
import { MetadataService } from './MetadataService';
import { generateId } from '../utils/generateId';

const AUDIO_EXTENSIONS = [
  '.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac', '.opus', '.wma', '.aiff', '.alac',
];

function isAudioFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const AndroidMusicScanner = {
  async requestPermission(): Promise<boolean> {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  },

  async hasPermission(): Promise<boolean> {
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status === 'granted';
  },

  async scanAllAudio(
    onProgress?: (current: number, total: number) => void
  ): Promise<Track[]> {
    const tracks: Track[] = [];
    let after: string | undefined = undefined;
    let totalCount = 0;
    let processed = 0;

    // Get total count first
    const initial = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.AUDIO,
      first: 1,
    });
    totalCount = initial.totalCount;

    do {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.AUDIO,
        first: 100,
        after,
      });

      for (const asset of result.assets) {
        if (!isAudioFile(asset.filename)) continue;

        try {
          // Get full asset info (includes localUri)
          const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
          const uri = assetInfo.localUri || asset.uri;

          const metadata = await MetadataService.parseTrack(
            uri,
            asset.filename,
            asset.duration,
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
            duration: asset.duration,
            artworkUri: null,
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
        } catch {
          // Skip problematic files
        }

        processed++;
        onProgress?.(processed, totalCount);
      }

      after = result.endCursor;
      if (!result.hasNextPage) break;
    } while (true);

    return tracks;
  },

  // Watch for new media additions using MediaLibrary subscription
  subscribeToChanges(callback: (newTracks: Track[]) => void): () => void {
    const subscription = MediaLibrary.addListener(async (event) => {
      if (event.hasIncrementalChanges) {
        // Re-scan to pick up new audio files
        const newTracks = await AndroidMusicScanner.scanAllAudio();
        if (newTracks.length > 0) {
          callback(newTracks);
        }
      }
    });
    return () => subscription.remove();
  },
};
