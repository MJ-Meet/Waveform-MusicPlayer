import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayerStore } from '../store/playerStore';
import { AlbumArt } from './AlbumArt';
import { WaveformVisualizer } from './WaveformVisualizer';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { formatDuration } from '../utils/generateId';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 60;
const MINI_PLAYER_HEIGHT = 72;
const SWIPE_THRESHOLD = -60;

export function MiniPlayer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    accentColor,
    setIsPlaying,
    next,
    prev,
  } = usePlayerStore();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const swipeGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX * 0.3;
      if (e.translationY < 0) {
        translateY.value = e.translationY * 0.2;
      }
    })
    .onEnd((e) => {
      // Swipe up → open full player
      if (e.translationY < SWIPE_THRESHOLD) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        runOnJS(openFullPlayer)();
        return;
      }

      // Swipe left → next
      if (e.translationX < -80) {
        translateX.value = withSpring(0);
        runOnJS(handleNext)();
        return;
      }

      // Swipe right → prev
      if (e.translationX > 80) {
        translateX.value = withSpring(0);
        runOnJS(handlePrev)();
        return;
      }

      // Snap back
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  const openFullPlayer = useCallback(() => {
    router.push('/player-modal');
  }, [router]);

  const handleNext = useCallback(() => {
    next();
  }, [next]);

  const handlePrev = useCallback(() => {
    prev();
  }, [prev]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? position / duration : 0;

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={[styles.container, animStyle]}>
        <BlurView
          intensity={80}
          tint="dark"
          style={styles.blurContainer}
        >
          {/* Progress bar at top */}
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>

          <TouchableOpacity
            style={styles.content}
            onPress={openFullPlayer}
            activeOpacity={0.9}
          >
            {/* Album Art */}
            <AlbumArt
              uri={currentTrack.artworkUri}
              size={48}
              borderRadius={8}
              sharedTag="miniPlayerArt"
              showShadow={false}
              accentColor={accentColor}
            />

            {/* Track info */}
            <View style={styles.trackInfo}>
              <Text style={styles.title} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>

            {/* Waveform or controls */}
            <View style={styles.controls}>
              {isPlaying && (
                <WaveformVisualizer
                  isPlaying={isPlaying}
                  accentColor={accentColor}
                  barCount={12}
                  height={24}
                  style={styles.visualizer}
                />
              )}
              <TouchableOpacity
                onPress={() => setIsPlaying(!isPlaying)}
                style={styles.playButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={22}
                  color={Colors.textPrimary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNext}
                style={styles.nextButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name="play-skip-forward"
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </BlurView>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT,
    left: 8,
    right: 8,
    height: MINI_PLAYER_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 100,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
  },
  progressBar: {
    height: 2,
    backgroundColor: Colors.surfaceHighlight,
    width: '100%',
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
  },
  artist: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visualizer: {
    marginRight: 4,
  },
  playButton: {
    padding: 4,
  },
  nextButton: {
    padding: 4,
  },
});
