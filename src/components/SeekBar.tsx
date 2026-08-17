import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { usePlayerStore } from '../store/playerStore';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { formatDuration } from '../utils/generateId';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SeekBarProps {
  accentColor?: string;
}

export function SeekBar({ accentColor = Colors.accent }: SeekBarProps) {
  const { position, duration, seekTo } = usePlayerStore();

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const thumbX = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const dragProgress = useSharedValue(progress);

  const TRACK_WIDTH = SCREEN_WIDTH - 64;
  const THUMB_SIZE = 14;

  const seekGesture = Gesture.Pan()
    .onBegin((e) => {
      isDragging.value = true;
      dragProgress.value = Math.min(Math.max(e.x / TRACK_WIDTH, 0), 1);
      thumbX.value = dragProgress.value * TRACK_WIDTH;
    })
    .onUpdate((e) => {
      dragProgress.value = Math.min(Math.max(e.x / TRACK_WIDTH, 0), 1);
      thumbX.value = dragProgress.value * TRACK_WIDTH;
    })
    .onEnd(() => {
      isDragging.value = false;
      const newPosition = dragProgress.value * duration;
      runOnJS(seekTo)(newPosition);
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: isDragging.value
      ? dragProgress.value * TRACK_WIDTH
      : progress * TRACK_WIDTH,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: isDragging.value
          ? thumbX.value - THUMB_SIZE / 2
          : progress * TRACK_WIDTH - THUMB_SIZE / 2,
      },
    ],
    opacity: isDragging.value ? 1 : 0.7,
  }));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={seekGesture}>
        <View style={styles.trackContainer}>
          {/* Track background */}
          <View
            style={[styles.track, { backgroundColor: Colors.surfaceHighlight }]}
          />
          {/* Fill */}
          <Animated.View
            style={[styles.fill, fillStyle, { backgroundColor: accentColor }]}
          />
          {/* Thumb */}
          <Animated.View
            style={[
              styles.thumb,
              thumbStyle,
              {
                backgroundColor: accentColor,
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_SIZE / 2,
              },
            ]}
          />
        </View>
      </GestureDetector>

      {/* Time labels */}
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatDuration(position)}</Text>
        <Text style={styles.timeText}>{formatDuration(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
    marginVertical: 8,
  },
  trackContainer: {
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 4,
    borderRadius: 2,
    width: '100%',
  },
  fill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    top: '50%',
    marginTop: -2,
    left: 0,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -7,
    left: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    ...Typography.labelSmall,
    color: Colors.textTertiary,
    textTransform: 'none',
    letterSpacing: 0,
  },
});
