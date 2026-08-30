import { create } from 'zustand';
import { Track, Playlist, SortBy, SortOrder } from '../types';
import { MusicLibraryService } from '../services/MusicLibraryService';
import { DatabaseService } from '../services/DatabaseService';
import { generatePlaylistId } from '../utils/generateId';

interface LibraryStore {
  tracks: Track[];
  playlists: Playlist[];
  rediscoverTracks: Track[];
  isScanning: boolean;
  scanProgress: { current: number; total: number };
  lastScanned: number | null;
  hasPermission: boolean;
  scanError: string | null;
  scanStatus: string | null; // step-by-step diagnostic message
  sortBy: SortBy;
  sortOrder: SortOrder;
  searchQuery: string;
  searchResults: Track[];

  // Actions
  loadLibrary: () => Promise<void>;
  scanLibrary: () => Promise<void>;
  importFiles: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  toggleFavorite: (trackId: string) => Promise<void>;
  loadRediscover: () => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
  setSearchQuery: (query: string) => Promise<void>;
  getTracksByMood: (mood: string) => Track[];
  refreshMoodPlaylists: () => Promise<void>;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  tracks: [],
  playlists: [],
  rediscoverTracks: [],
  isScanning: false,
  scanProgress: { current: 0, total: 0 },
  lastScanned: null,
  hasPermission: false,
  scanError: null,
  scanStatus: null,
  sortBy: 'title',
  sortOrder: 'asc',
  searchQuery: '',
  searchResults: [],

  loadLibrary: async () => {
    try {
      const [tracks, playlists, lastScanned] = await Promise.all([
        DatabaseService.getAllTracks(),
        DatabaseService.getAllPlaylists(),
        MusicLibraryService.getLastScanned(),
      ]);

      const hasPermission = await MusicLibraryService.hasPermission();

      set({ tracks, playlists, lastScanned, hasPermission });
      await get().loadRediscover();
    } catch (error: any) {
      set({ scanError: error?.message || 'Failed to load library' });
    }
  },

  scanLibrary: async () => {
    set({ isScanning: true, scanError: null, scanStatus: '⏳ Starting scan...', scanProgress: { current: 0, total: 0 } });

    try {
      // Step 1: Check permission
      set({ scanStatus: '🔐 Checking media permission...' });
      const hasPermission = await MusicLibraryService.hasPermission();
      if (!hasPermission) {
        set({ scanStatus: '🔐 Requesting permission...' });
        const granted = await MusicLibraryService.requestPermission();
        if (!granted) {
          set({
            isScanning: false,
            scanStatus: null,
            scanError: '❌ Permission denied — go to Settings → Apps → Waveform → Permissions → enable "Files and media"',
            hasPermission: false,
          });
          return;
        }
      }
      set({ hasPermission: true, scanStatus: '✅ Permission granted. Scanning files...' });

      // Step 2: Scan device
      const result = await MusicLibraryService.scanOrImport((current, total) => {
        set({
          scanProgress: { current, total },
          scanStatus: total === 0
            ? '🔍 Scanning...'
            : `🎵 Reading file ${current} of ${total}...`,
        });
      });

      // Step 3: Report what was found
      if (result.errors.length > 0) {
        console.warn('[Library] Scan errors:', result.errors);
      }

      if (result.tracks.length === 0) {
        set({
          isScanning: false,
          scanStatus: null,
          scanProgress: { current: 0, total: 0 },
          scanError:
            '⚠️ No audio files found on device.\n\n' +
            'Make sure you have .mp3, .m4a, .flac or .wav files in your device storage (e.g. the "Music" folder). ' +
            'If you just copied files, try restarting your phone first so Android can index them.',
        });
        return;
      }

      // Step 4: Save to database
      set({ scanStatus: `💾 Saving ${result.tracks.length} tracks to database...` });
      await MusicLibraryService.persistScanResults(result.tracks);

      // Step 5: Reload from DB
      set({ scanStatus: '📂 Loading library...' });
      const [tracks, playlists] = await Promise.all([
        DatabaseService.getAllTracks(),
        DatabaseService.getAllPlaylists(),
      ]);

      set({
        tracks,
        playlists,
        lastScanned: Date.now(),
        isScanning: false,
        scanProgress: { current: 0, total: 0 },
        scanStatus: null,
        scanError: null,
      });

      await get().loadRediscover();
      await get().refreshMoodPlaylists();
    } catch (error: any) {
      console.error('[Library] scanLibrary error:', error);
      set({
        isScanning: false,
        scanStatus: null,
        scanError: `❌ Scan failed: ${error?.message || 'Unknown error'}`,
      });
    }
  },

  importFiles: async () => {
    set({ isScanning: true, scanError: null, scanStatus: '📂 Opening file picker...', scanProgress: { current: 0, total: 0 } });

    try {
      const tracks = await IOSMusicImporter.importFiles((current, total) => {
        set({
          scanProgress: { current, total },
          scanStatus: `📥 Importing ${current + 1} of ${total} files...`,
        });
      });

      if (tracks.length > 0) {
        set({ scanStatus: `💾 Saving ${tracks.length} imported tracks...` });
        await MusicLibraryService.persistScanResults(tracks);

        const [allTracks, playlists] = await Promise.all([
          DatabaseService.getAllTracks(),
          DatabaseService.getAllPlaylists(),
        ]);

        set({
          tracks: allTracks,
          playlists,
          lastScanned: Date.now(),
          isScanning: false,
          scanProgress: { current: 0, total: 0 },
          scanStatus: null,
          scanError: null,
        });

        await get().loadRediscover();
        await get().refreshMoodPlaylists();
      } else {
        set({ isScanning: false, scanStatus: null });
      }
    } catch (error: any) {
      console.error('[Library] importFiles error:', error);
      set({
        isScanning: false,
        scanStatus: null,
        scanError: `❌ Import failed: ${error?.message || 'Unknown error'}`,
      });
    }
  },

  requestPermission: async () => {
    const granted = await MusicLibraryService.requestPermission();
    set({ hasPermission: granted });
    return granted;
  },

  toggleFavorite: async (trackId) => {
    const newFav = await DatabaseService.toggleFavorite(trackId);
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, isFavorite: newFav } : t
      ),
    }));
  },

  loadRediscover: async () => {
    const rediscoverTracks = await DatabaseService.getRediscoverTracks(30);
    set({ rediscoverTracks });
  },

  createPlaylist: async (name, description) => {
    const playlist: Playlist = {
      id: generatePlaylistId(),
      name,
      description: description || null,
      artworkUri: null,
      isAuto: false,
      mood: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await DatabaseService.createPlaylist(playlist);
    set((state) => ({ playlists: [playlist, ...state.playlists] }));
    return playlist;
  },

  deletePlaylist: async (id) => {
    await DatabaseService.deletePlaylist(id);
    set((state) => ({ playlists: state.playlists.filter((p) => p.id !== id) }));
  },

  addTrackToPlaylist: async (playlistId, trackId) => {
    const tracks = await DatabaseService.getPlaylistTracks(playlistId);
    await DatabaseService.addTrackToPlaylist(playlistId, trackId, tracks.length);
  },

  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),

  setSearchQuery: async (query) => {
    set({ searchQuery: query });
    if (query.length < 2) {
      set({ searchResults: [] });
      return;
    }
    const results = await DatabaseService.searchTracks(query);
    set({ searchResults: results });
  },

  getTracksByMood: (mood) => {
    return get().tracks.filter((t) => t.mood === mood);
  },

  refreshMoodPlaylists: async () => {
    const { playlists } = get();
    const existingMoodPlaylists = playlists.filter((p) => p.isAuto);

    const moods: Array<{ mood: string; name: string; description: string }> = [
      { mood: 'chill', name: '🌙 Chill Vibes', description: 'Relax and unwind' },
      { mood: 'focus', name: '🎯 Deep Focus', description: 'Stay in the zone' },
      { mood: 'workout', name: '💪 Workout Mode', description: 'Push your limits' },
    ];

    for (const { mood, name, description } of moods) {
      const tracksForMood = await DatabaseService.getTracksByMood(mood);
      if (tracksForMood.length === 0) continue;

      const existingPlaylist = existingMoodPlaylists.find((p) => p.mood === mood);
      if (!existingPlaylist) {
        const playlist: Playlist = {
          id: generatePlaylistId(),
          name,
          description,
          artworkUri: tracksForMood[0]?.artworkUri || null,
          isAuto: true,
          mood: mood as any,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await DatabaseService.createPlaylist(playlist);

        // Add tracks to playlist
        for (let i = 0; i < tracksForMood.length; i++) {
          await DatabaseService.addTrackToPlaylist(playlist.id, tracksForMood[i].id, i);
        }
      }
    }

    const updatedPlaylists = await DatabaseService.getAllPlaylists();
    set({ playlists: updatedPlaylists });
  },
}));
