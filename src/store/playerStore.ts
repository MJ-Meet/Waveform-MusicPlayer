import { create } from 'zustand';
import { Track, RepeatMode } from '../types';
import { shuffleArray } from '../utils/generateId';
import { DatabaseService } from '../services/DatabaseService';

interface PlayerStore {
  currentTrack: Track | null;
  queue: Track[];
  originalQueue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  volume: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  sleepTimerEnd: number | null;
  accentColor: string;

  // Actions
  playTrack: (track: Track, queue?: Track[]) => void;
  pause: () => void;
  resume: () => void;
  next: () => Track | null;
  prev: () => Track | null;
  seekTo: (position: number) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setVolume: (volume: number) => void;
  setSleepTimer: (endTime: number | null) => void;
  setAccentColor: (color: string) => void;
  markTrackPlayed: (trackId: string) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
}

let onSeekCallback: ((pos: number) => void) | null = null;

export function setPlayerSeekCallback(cb: (pos: number) => void) {
  onSeekCallback = cb;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  queue: [],
  originalQueue: [],
  queueIndex: 0,
  isPlaying: false,
  isLoading: false,
  position: 0,
  duration: 0,
  volume: 1,
  repeatMode: 'none',
  isShuffle: false,
  sleepTimerEnd: null,
  accentColor: '#A855F7',

  playTrack: (track, queue) => {
    const currentQueue = queue || get().queue;
    const index = currentQueue.findIndex((t) => t.id === track.id);
    set({
      currentTrack: track,
      queue: currentQueue,
      originalQueue: currentQueue,
      queueIndex: Math.max(index, 0),
      isLoading: true,
      position: 0,
    });
  },

  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),

  next: () => {
    const { queue, queueIndex, repeatMode, isShuffle } = get();
    if (queue.length === 0) return null;

    if (repeatMode === 'track') {
      // Stay on current track — caller handles replay
      return get().currentTrack;
    }

    let nextIndex: number;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'queue') {
          nextIndex = 0;
        } else {
          return null; // End of queue
        }
      }
    }

    const nextTrack = queue[nextIndex];
    set({ currentTrack: nextTrack, queueIndex: nextIndex, position: 0, isLoading: true });
    return nextTrack;
  },

  prev: () => {
    const { queue, queueIndex, position } = get();
    if (queue.length === 0) return null;

    // If more than 3 seconds in, restart current track
    if (position > 3) {
      set({ position: 0 });
      return get().currentTrack;
    }

    const prevIndex = Math.max(queueIndex - 1, 0);
    const prevTrack = queue[prevIndex];
    set({ currentTrack: prevTrack, queueIndex: prevIndex, position: 0, isLoading: true });
    return prevTrack;
  },

  seekTo: (position) => {
    set({ position });
    onSeekCallback?.(position);
  },

  setQueue: (tracks, startIndex = 0) => {
    set({
      queue: tracks,
      originalQueue: tracks,
      queueIndex: startIndex,
      currentTrack: tracks[startIndex] || null,
    });
  },

  setRepeatMode: (mode) => set({ repeatMode: mode }),

  toggleShuffle: () => {
    const { isShuffle, originalQueue, currentTrack } = get();
    if (!isShuffle) {
      const shuffled = shuffleArray(originalQueue);
      const currentIdx = shuffled.findIndex((t) => t.id === currentTrack?.id);
      set({ isShuffle: true, queue: shuffled, queueIndex: Math.max(currentIdx, 0) });
    } else {
      const currentIdx = originalQueue.findIndex((t) => t.id === currentTrack?.id);
      set({ isShuffle: false, queue: originalQueue, queueIndex: Math.max(currentIdx, 0) });
    }
  },

  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setVolume: (volume) => set({ volume }),
  setSleepTimer: (sleepTimerEnd) => set({ sleepTimerEnd }),
  setAccentColor: (accentColor) => set({ accentColor }),

  markTrackPlayed: async (trackId) => {
    await DatabaseService.updateLastPlayed(trackId);
  },

  addToQueue: (track) => {
    const { queue } = get();
    set({ queue: [...queue, track] });
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex } = get();
    const newQueue = queue.filter((_, i) => i !== index);
    const newIndex = index < queueIndex ? queueIndex - 1 : queueIndex;
    set({ queue: newQueue, queueIndex: Math.max(0, newIndex) });
  },

  moveInQueue: (from, to) => {
    const { queue } = get();
    const newQueue = [...queue];
    const [removed] = newQueue.splice(from, 1);
    newQueue.splice(to, 0, removed);
    set({ queue: newQueue });
  },

  clearQueue: () => set({ queue: [], originalQueue: [], currentTrack: null, queueIndex: 0 }),
}));
