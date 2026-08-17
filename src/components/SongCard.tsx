import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Track } from '../types';
import { AlbumArt } from './AlbumArt';
import { WaveformVisualizer } from './WaveformVisualizer';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { formatDuration } from '../utils/generateId';
import { usePlayerStore } from '../store/playerStore';

interface SongCardProps {
  track: Track;
  onPress: (track: Track) => void;
  onLongPress?: (track: Track) => void;
  showIndex?: boolean;
  index?: number;
  isActive?: boolean;
  accentColor?: string;
}

export function SongCard({
  track,
  onPress,
  onLongPress,
  showIndex = false,
  index,
  isActive = false,
  accentColor = Colors.accent,
}: SongCardProps) {
  const { isPlaying } = usePlayerStore();
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.96, { duration: 100 }, () => {
      scale.value = withSpring(1);
    });
    onPress(track);
  }, [onPress, track]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(track);
  }, [onLongPress, track]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={[styles.container, isActive && styles.activeContainer]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.8}
      >
        {/* Left: index or art */}
        {showIndex && index !== undefined ? (
          <View style={styles.indexContainer}>
            {isActive && isPlaying ? (
              <WaveformVisualizer
                isPlaying
                accentColor={accentColor}
                barCount={4}
                height={16}
              />
            ) : (
              <Text style={[styles.index, isActive && { color: accentColor }]}>
                {index + 1}
              </Text>
            )}
          </View>
        ) : (
          <AlbumArt
            uri={track.artworkUri}
            size={50}
            borderRadius={8}
            showShadow={false}
          />
        )}

        {/* Track info */}
        <View style={styles.info}>
          <Text
            style={[styles.title, isActive && { color: accentColor }]}
            numberOfLines={1}
          >
            {track.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {track.artist} • {formatDuration(track.duration)}
          </Text>
        </View>

        {/* Right: favorite + menu */}
        <View style={styles.actions}>
          {track.isFavorite && (
            <Ionicons name="heart" size={14} color="#EF4444" style={styles.heartIcon} />
          )}
          <Ionicons name="ellipsis-vertical" size={18} color={Colors.textTertiary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
    borderRadius: 12,
  },
  activeContainer: {
    backgroundColor: Colors.surfaceElevated,
  },
  indexContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  index: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  meta: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heartIcon: {
    marginRight: 2,
  },
});
