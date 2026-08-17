import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/playerStore';
import { AlbumArt } from './AlbumArt';
import { SeekBar } from './SeekBar';
import { WaveformVisualizer } from './WaveformVisualizer';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { formatDuration } from '../utils/generateId';
import { useLibraryStore } from '../store/libraryStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ART_SIZE = SCREEN_WIDTH - 64;

export function FullPlayer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    repeatMode,
    isShuffle,
    accentColor,
    queue,
    queueIndex,
    setIsPlaying,
    setRepeatMode,
    toggleShuffle,
    next,
    prev,
  } = usePlayerStore();

  const { toggleFavorite } = useLibraryStore();

  const dismissY = useSharedValue(0);

  const dismissGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        dismissY.value = e.translationY;
      } else if (e.translationX < -80) {
        runOnJS(next)();
      } else if (e.translationX > 80) {
        runOnJS(prev)();
      }
    })
    .onEnd((e) => {
      if (e.translationY > 120) {
        runOnJS(dismiss)();
      }
      dismissY.value = withSpring(0);
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissY.value }],
    opacity: interpolate(dismissY.value, [0, 200], [1, 0.5], Extrapolation.CLAMP),
  }));

  const dismiss = useCallback(() => {
    router.back();
  }, [router]);

  const handleRepeat = useCallback(() => {
    const modes = ['none', 'queue', 'track'] as const;
    const current = modes.indexOf(repeatMode);
    setRepeatMode(modes[(current + 1) % modes.length]);
  }, [repeatMode, setRepeatMode]);

  const repeatIcon = repeatMode === 'track' ? 'repeat-outline' : 'repeat';
  const repeatColor =
    repeatMode === 'none' ? Colors.textTertiary : accentColor;

  if (!currentTrack) return null;

  return (
    <GestureDetector gesture={dismissGesture}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Blurred gradient background */}
        <LinearGradient
          colors={[accentColor + '40', Colors.background, Colors.background]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.5 }}
        />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={dismiss} style={styles.dismissButton}>
            <Ionicons name="chevron-down" size={28} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Now Playing</Text>
            <Text style={styles.headerSubtitle}>
              {queueIndex + 1} of {queue.length}
            </Text>
          </View>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Album Art */}
        <View style={styles.artContainer}>
          <AlbumArt
            uri={currentTrack.artworkUri}
            size={ART_SIZE}
            borderRadius={24}
            sharedTag="miniPlayerArt"
            showShadow
            accentColor={accentColor}
          />
        </View>

        {/* Waveform Visualizer */}
        <WaveformVisualizer
          isPlaying={isPlaying}
          accentColor={accentColor}
          barCount={40}
          height={40}
          style={styles.visualizer}
        />

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <View style={styles.trackTextContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
            <Text style={styles.album} numberOfLines={1}>
              {currentTrack.album}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => toggleFavorite(currentTrack.id)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={currentTrack.isFavorite ? 'heart' : 'heart-outline'}
              size={26}
              color={currentTrack.isFavorite ? '#EF4444' : Colors.textTertiary}
            />
          </TouchableOpacity>
        </View>

        {/* Seek Bar */}
        <SeekBar accentColor={accentColor} />

        {/* Controls */}
        <BlurView
          intensity={30}
          tint="dark"
          style={styles.controlsBlur}
        >
          <View style={styles.controls}>
            {/* Shuffle */}
            <TouchableOpacity onPress={toggleShuffle} style={styles.controlButton}>
              <Ionicons
                name="shuffle"
                size={22}
                color={isShuffle ? accentColor : Colors.textTertiary}
              />
            </TouchableOpacity>

            {/* Previous */}
            <TouchableOpacity onPress={() => prev()} style={styles.controlButton}>
              <Ionicons name="play-skip-back" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>

            {/* Play/Pause */}
            <TouchableOpacity
              onPress={() => setIsPlaying(!isPlaying)}
              style={[styles.playPauseButton, { backgroundColor: accentColor }]}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={32}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Next */}
            <TouchableOpacity onPress={() => next()} style={styles.controlButton}>
              <Ionicons name="play-skip-forward" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>

            {/* Repeat */}
            <TouchableOpacity onPress={handleRepeat} style={styles.controlButton}>
              <Ionicons name={repeatIcon} size={22} color={repeatColor} />
              {repeatMode === 'track' && (
                <View style={[styles.repeatOneBadge, { backgroundColor: accentColor }]}>
                  <Text style={styles.repeatOneText}>1</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Bottom spacing */}
        <View style={{ height: insets.bottom + 16 }} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  dismissButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  headerSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  moreButton: {
    padding: 4,
  },
  artContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  visualizer: {
    marginHorizontal: 32,
    marginBottom: 8,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginVertical: 12,
    gap: 16,
  },
  trackTextContainer: {
    flex: 1,
  },
  title: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  artist: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  album: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  controlsBlur: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    marginTop: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  controlButton: {
    padding: 8,
    position: 'relative',
  },
  playPauseButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  repeatOneBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOneText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
});
