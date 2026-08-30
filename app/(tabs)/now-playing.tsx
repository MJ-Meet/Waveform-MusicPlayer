import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { usePlayerStore } from '../../src/store/playerStore';
import { AlbumArt } from '../../src/components/AlbumArt';
import { SongCard } from '../../src/components/SongCard';
import { WaveformVisualizer } from '../../src/components/WaveformVisualizer';
import { SleepTimerModal } from '../../src/components/SleepTimerModal';
import { SongActionModal } from '../../src/components/SongActionModal';
import { Colors } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { formatDuration } from '../../src/utils/generateId';
import { Track } from '../../src/types';

export default function NowPlayingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [selectedActionTrack, setSelectedActionTrack] = useState<Track | null>(null);

  const {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    position,
    duration,
    accentColor,
    setIsPlaying,
    next,
    prev,
    sleepTimerEnd,
    removeFromQueue,
  } = usePlayerStore();

  if (!currentTrack) {
    return (
      <View style={[styles.container, styles.emptyContainer, { paddingTop: insets.top }]}>
        <Text style={styles.emptyIcon}>🎵</Text>
        <Text style={styles.emptyTitle}>Nothing Playing</Text>
        <Text style={styles.emptySubtitle}>
          Go to Library and pick a song to start listening
        </Text>
      </View>
    );
  }

  const upNext = queue.slice(queueIndex + 1, queueIndex + 6);
  const remainingTimer = sleepTimerEnd
    ? Math.ceil((sleepTimerEnd - Date.now()) / 60000)
    : null;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <FlatList
        data={upNext}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <SongCard
            track={item}
            onPress={(t) => {
              usePlayerStore.getState().playTrack(t, queue);
              usePlayerStore.getState().setIsPlaying(true);
            }}
            onMenuPress={setSelectedActionTrack}
            showIndex
            index={queueIndex + 1 + index}
            accentColor={accentColor}
          />
        )}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
              <Text style={styles.screenTitle}>Now Playing</Text>
              <View style={styles.headerActions}>
                {/* Sleep timer badge */}
                {remainingTimer && (
                  <TouchableOpacity
                    style={[styles.timerBadge, { borderColor: accentColor }]}
                    onPress={() => setShowSleepTimer(true)}
                  >
                    <Ionicons name="moon" size={12} color={accentColor} />
                    <Text style={[styles.timerText, { color: accentColor }]}>
                      {remainingTimer}m
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowSleepTimer(true)}>
                  <Ionicons name="moon-outline" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Now Playing Card */}
            <TouchableOpacity
              style={styles.nowPlayingCard}
              onPress={() => router.push('/player-modal')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[accentColor + '30', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.nowPlayingContent}>
                <AlbumArt
                  uri={currentTrack.artworkUri}
                  size={80}
                  borderRadius={14}
                  sharedTag="miniPlayerArt"
                  showShadow
                  accentColor={accentColor}
                />

                <View style={styles.nowPlayingInfo}>
                  <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                    {currentTrack.title}
                  </Text>
                  <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                    {currentTrack.artist}
                  </Text>
                  <View style={styles.nowPlayingMeta}>
                    <Text style={styles.nowPlayingTime}>
                      {formatDuration(position)} / {formatDuration(duration)}
                    </Text>
                  </View>
                </View>

                <View style={styles.nowPlayingControls}>
                  <TouchableOpacity onPress={() => prev()}>
                    <Ionicons name="play-skip-back" size={22} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsPlaying(!isPlaying)}
                    style={[styles.playBtn, { backgroundColor: accentColor }]}
                  >
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => next()}>
                    <Ionicons name="play-skip-forward" size={22} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Progress */}
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${duration > 0 ? (position / duration) * 100 : 0}%`,
                      backgroundColor: accentColor,
                    },
                  ]}
                />
              </View>

              {/* Visualizer */}
              {isPlaying && (
                <WaveformVisualizer
                  isPlaying={isPlaying}
                  accentColor={accentColor}
                  barCount={20}
                  height={20}
                  style={styles.visualizer}
                />
              )}
            </TouchableOpacity>

            {/* Up Next header */}
            {upNext.length > 0 && (
              <View style={styles.queueHeader}>
                <Text style={styles.queueTitle}>Up Next</Text>
                <Text style={styles.queueCount}>{queue.length - queueIndex - 1} songs</Text>
              </View>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          upNext.length === 0 ? (
            <View style={styles.noQueue}>
              <Text style={styles.noQueueText}>Queue ends with this song</Text>
            </View>
          ) : null
        }
      />

      <SleepTimerModal
        visible={showSleepTimer}
        onClose={() => setShowSleepTimer(false)}
      />

      <SongActionModal
        visible={!!selectedActionTrack}
        track={selectedActionTrack}
        onClose={() => setSelectedActionTrack(null)}
        accentColor={accentColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  screenTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  timerText: {
    ...Typography.labelSmall,
    textTransform: 'none',
    letterSpacing: 0,
  },
  nowPlayingCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    marginBottom: 8,
  },
  nowPlayingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  nowPlayingInfo: {
    flex: 1,
  },
  nowPlayingTitle: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  nowPlayingArtist: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  nowPlayingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nowPlayingTime: {
    ...Typography.labelSmall,
    color: Colors.textTertiary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  nowPlayingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 3,
    backgroundColor: Colors.surfaceHighlight,
    marginHorizontal: 0,
  },
  progressFill: {
    height: 3,
  },
  visualizer: {
    marginVertical: 10,
    marginHorizontal: 16,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  queueTitle: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
  },
  queueCount: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  noQueue: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noQueueText: {
    ...Typography.bodyMedium,
    color: Colors.textTertiary,
  },
  listContent: {
    paddingBottom: 160,
  },
});
