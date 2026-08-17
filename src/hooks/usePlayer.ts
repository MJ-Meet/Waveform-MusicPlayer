import { useEffect, useRef, useCallback } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { usePlayerStore } from '../store/playerStore';
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

  // Create player for the current track URI
  const player = useAudioPlayer(
    currentTrack ? { uri: currentTrack.uri } : null
  );

  const status = useAudioPlayerStatus(player);

  // Sync status to store
  useEffect(() => {
    if (!status) return;

    if (status.currentTime !== undefined) {
      setPosition(status.currentTime);
    }

    if (status.duration !== undefined && status.duration > 0) {
      setDuration(status.duration);
    }

    if (status.isLoaded !== undefined) {
      setIsLoading(!status.isLoaded);
    }

    // Track ended
    if (status.didJustFinish) {
      handleTrackEnd();
    }
  }, [status]);

  const handleTrackEnd = useCallback(() => {
    if (repeatMode === 'track') {
      player.seekTo(0);
      player.play();
    } else {
      const nextTrack = next();
      if (!nextTrack) {
        setIsPlaying(false);
      }
    }
  }, [repeatMode, next, player, setIsPlaying]);

  // Play/pause sync
  useEffect(() => {
    if (!currentTrack || !player) return;
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, currentTrack?.uri]);

  // Volume sync
  useEffect(() => {
    if (player) {
      player.volume = volume;
    }
  }, [volume, player]);

  // Sleep timer
  useEffect(() => {
    if (!sleepTimerEnd) return;

    const interval = setInterval(() => {
      const remaining = sleepTimerEnd - Date.now();

      if (remaining <= 0) {
        player?.pause();
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
  }, [sleepTimerEnd]);

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
      player?.seekTo(position);
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
