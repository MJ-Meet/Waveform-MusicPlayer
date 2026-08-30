import { useEffect, useRef, useCallback } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { usePlayerStore, setPlayerSeekCallback } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { Track } from '../types';

export function usePlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    sleepTimerEnd,
    repeatMode,
    setPosition,
    setDuration,
    setIsPlaying,
    setIsLoading,
    setVolume,
    setSleepTimer,
    next,
    markTrackPlayed,
  } = usePlayerStore();

  const player = useAudioPlayer(
    currentTrack ? { uri: currentTrack.uri } : null
  );

  const status = useAudioPlayerStatus(player);
  const currentUriRef = useRef<string | null>(null);

  // Set seek callback
  useEffect(() => {
    if (player) {
      setPlayerSeekCallback((pos: number) => {
        try {
          player.seekTo(pos);
        } catch (e) {
          console.warn('[Player] Seek error:', e);
        }
      });
    }
    return () => {
      setPlayerSeekCallback(() => {});
    };
  }, [player]);

  // Track change & auto-play
  useEffect(() => {
    if (!currentTrack || !player) return;

    if (currentUriRef.current !== currentTrack.uri) {
      currentUriRef.current = currentTrack.uri;
      try {
        player.replace({ uri: currentTrack.uri });
        if (isPlaying) {
          player.play();
        }

        // Enable lockscreen controls on supported platforms
        try {
          player.setActiveForLockScreen(true, {
            title: currentTrack.title || 'Unknown Title',
            artist: currentTrack.artist || 'Unknown Artist',
            albumTitle: currentTrack.album || 'Unknown Album',
          });
        } catch {}
      } catch (err) {
        console.warn('[Player] Error replacing audio source:', err);
      }
    }
  }, [currentTrack?.id, currentTrack?.uri, player, isPlaying]);

  // Play / Pause sync
  useEffect(() => {
    if (!player || !currentTrack) return;
    try {
      if (isPlaying) {
        player.play();
      } else {
        player.pause();
      }
    } catch (err) {
      console.warn('[Player] Play/Pause sync error:', err);
    }
  }, [isPlaying, player]);

  // Volume sync
  useEffect(() => {
    if (player) {
      try {
        player.volume = volume;
      } catch {}
    }
  }, [volume, player]);

  // Sync status to store & update real track duration
  useEffect(() => {
    if (!status) return;

    if (status.currentTime !== undefined && !isNaN(status.currentTime)) {
      setPosition(status.currentTime);
    }

    if (status.duration !== undefined && status.duration > 0 && !isNaN(status.duration)) {
      setDuration(status.duration);

      // If the current track in library has duration 0 or different, update it
      if (currentTrack && Math.abs((currentTrack.duration || 0) - status.duration) > 1) {
        useLibraryStore.getState().updateTrackDuration(currentTrack.id, status.duration);
      }
    }

    if (status.isLoaded !== undefined) {
      setIsLoading(!status.isLoaded);
    }

    // Sync play state if OS or headphones triggered a pause/resume
    if (status.playing !== undefined && status.playing !== isPlaying) {
      setIsPlaying(status.playing);
    }

    // Track ended
    if (status.didJustFinish) {
      handleTrackEnd();
    }
  }, [status]);

  const handleTrackEnd = useCallback(() => {
    if (repeatMode === 'track') {
      try {
        player?.seekTo(0);
        player?.play();
      } catch {}
    } else {
      const nextTrack = next();
      if (!nextTrack) {
        setIsPlaying(false);
      }
    }
  }, [repeatMode, next, player, setIsPlaying]);

  // Sleep timer
  useEffect(() => {
    if (!sleepTimerEnd) return;

    const interval = setInterval(() => {
      const remaining = sleepTimerEnd - Date.now();

      if (remaining <= 0) {
        try {
          player?.pause();
        } catch {}
        setIsPlaying(false);
        setSleepTimer(null);
        setVolume(1);
        if (player) player.volume = 1;
        clearInterval(interval);
        return;
      }

      // Gradual fade in last 30 seconds
      if (remaining <= 30000) {
        const fadeVolume = Math.max(0, remaining / 30000);
        if (player) player.volume = fadeVolume;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerEnd, player]);

  // Track first play tracking
  const trackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentTrack && status?.currentTime && status.currentTime > 5 && trackedRef.current !== currentTrack.id) {
      trackedRef.current = currentTrack.id;
      markTrackPlayed(currentTrack.id);
    }
  }, [currentTrack?.id, status?.currentTime]);

  const playTrack = useCallback(
    async (track: Track, queue?: Track[]) => {
      usePlayerStore.getState().playTrack(track, queue);
      usePlayerStore.getState().setIsPlaying(true);
    },
    []
  );

  const togglePlayPause = useCallback(() => {
    const { isPlaying: playing } = usePlayerStore.getState();
    usePlayerStore.getState().setIsPlaying(!playing);
  }, []);

  const seek = useCallback(
    (position: number) => {
      try {
        player?.seekTo(position);
      } catch {}
      setPosition(position);
    },
    [player, setPosition]
  );

  return {
    player,
    status,
    playTrack,
    togglePlayPause,
    seek,
  };
}

/**
 * Global component mounted at root to keep the audio player alive
 * throughout the entire app lifecycle
 */
export function AudioPlayerController() {
  usePlayer();
  return null;
}

