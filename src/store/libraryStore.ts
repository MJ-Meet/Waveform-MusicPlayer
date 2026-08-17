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
    set({ isScanning: true, scanError: null, scanProgress: { current: 0, total: 0 } });

    try {
      const hasPermission = await MusicLibraryService.hasPermission();
      if (!hasPermission) {
        const granted = await MusicLibraryService.requestPermission();
        if (!granted) {
          set({ isScanning: false, scanError: 'Permission denied', hasPermission: false });
          return;
        }
      }

      set({ hasPermission: true });

      const result = await MusicLibraryService.scanOrImport((current, total) => {
        set({ scanProgress: { current, total } });
      });

      if (result.tracks.length > 0) {
        await MusicLibraryService.persistScanResults(result.tracks);
      }

      // Reload from DB (deduplicated, with favorites/play counts preserved)
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
      });

      await get().loadRediscover();
      await get().refreshMoodPlaylists();
    } catch (error: any) {
      set({
        isScanning: false,
        scanError: error?.message || 'Scan failed',
      });
    }
  },

  importFiles: async () => {
    // iOS-specific: trigger document picker
    await get().scanLibrary();
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
