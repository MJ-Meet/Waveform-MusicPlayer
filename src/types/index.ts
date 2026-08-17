// Core track/song model
export interface Track {
  id: string;
  uri: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  artworkUri: string | null;
  artworkColor: string | null; // extracted dominant color
  fileSize: number; // bytes
  dateAdded: number; // unix timestamp ms
  lastPlayedAt: number | null; // unix timestamp ms
  playCount: number;
  isFavorite: boolean;
  mood: TrackMood | null;
  bpmEstimate: number | null;
}

export type TrackMood = 'chill' | 'focus' | 'workout';

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  artworkUri: string | null;
  isAuto: boolean; // auto-generated (mood playlists)
  mood: TrackMood | null;
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistTrack {
  playlistId: string;
  trackId: string;
  position: number;
}

export type RepeatMode = 'none' | 'track' | 'queue';
export type SortBy = 'title' | 'artist' | 'album' | 'dateAdded' | 'lastPlayed' | 'playCount';
export type SortOrder = 'asc' | 'desc';

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  position: number; // seconds
  duration: number; // seconds
  volume: number; // 0-1
  repeatMode: RepeatMode;
  isShuffle: boolean;
  sleepTimerEnd: number | null; // unix timestamp ms
}

export interface LibraryState {
  tracks: Track[];
  playlists: Playlist[];
  isScanning: boolean;
  lastScanned: number | null;
  hasPermission: boolean;
  scanError: string | null;
}

export interface ScanResult {
  tracks: Track[];
  errors: string[];
}
