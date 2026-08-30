import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';

import { useLibraryStore } from '../../src/store/libraryStore';
import { usePlayerStore } from '../../src/store/playerStore';
import { SongCard } from '../../src/components/SongCard';
import { AlbumArt } from '../../src/components/AlbumArt';
import { Colors, MoodColors, MoodType } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Track } from '../../src/types';
import { formatDuration, timeAgo } from '../../src/utils/generateId';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const REDISCOVER_CARD_WIDTH = 140;
const MOOD_CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

function MoodCard({ mood, count, onPress }: {
  mood: MoodType;
  count: number;
  onPress: () => void;
}) {
  const colors = MoodColors[mood];
  const icons: Record<MoodType, string> = {
    chill: '🌙',
    focus: '🎯',
    workout: '💪',
  };
  const names: Record<MoodType, string> = {
    chill: 'Chill Vibes',
    focus: 'Deep Focus',
    workout: 'Workout',
  };

  if (count === 0) return null;

  return (
    <TouchableOpacity style={styles.moodCard} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={[colors.primary + 'CC', colors.secondary + '88']}
        style={styles.moodGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.moodIcon}>{icons[mood]}</Text>
        <Text style={styles.moodName}>{names[mood]}</Text>
        <Text style={styles.moodCount}>{count} songs</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function RediscoverCard({ track, onPress }: { track: Track; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.rediscoverCard} onPress={onPress} activeOpacity={0.8}>
      <AlbumArt
        uri={track.artworkUri}
        size={REDISCOVER_CARD_WIDTH}
        borderRadius={12}
        showShadow={false}
      />
      <View style={styles.rediscoverInfo}>
        <Text style={styles.rediscoverTitle} numberOfLines={2}>
          {track.title}
        </Text>
        <Text style={styles.rediscoverArtist} numberOfLines={1}>
          {track.artist}
        </Text>
        <Text style={styles.rediscoverTime}>
          {timeAgo(track.lastPlayedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ScanProgress({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <View style={styles.scanProgress}>
      <View style={styles.scanProgressBar}>
        <Animated.View
          style={[styles.scanProgressFill, { width: `${pct}%`, backgroundColor: Colors.accent }]}
        />
      </View>
      <Text style={styles.scanProgressText}>
        Scanning {current} / {total} files…
      </Text>
    </View>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const {
    tracks,
    rediscoverTracks,
    isScanning,
    scanProgress,
    lastScanned,
    hasPermission,
    scanError,
    scanStatus,
    scanLibrary,
    loadLibrary,
    getTracksByMood,
  } = useLibraryStore();

  const { currentTrack, accentColor, playTrack } = usePlayerStore();
  const [refreshing, setRefreshing] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);

  useEffect(() => {
    loadLibrary().finally(() => setLibraryLoaded(true));
  }, []);

  // Auto-scan on first launch (Android) — only after library is loaded from DB
  useEffect(() => {
    if (libraryLoaded && Platform.OS === 'android' && !lastScanned && !isScanning) {
      scanLibrary();
    }
  }, [libraryLoaded]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await scanLibrary();
    setRefreshing(false);
  }, [scanLibrary]);

  const handleTrackPress = useCallback(
    (track: Track) => {
      playTrack(track, tracks);
      usePlayerStore.getState().setIsPlaying(true);
    },
    [tracks, playTrack]
  );

  const handleMoodPress = useCallback(
    (mood: MoodType) => {
      const moodTracks = getTracksByMood(mood);
      if (moodTracks.length > 0) {
        playTrack(moodTracks[0], moodTracks);
        usePlayerStore.getState().setIsPlaying(true);
      }
    },
    [getTracksByMood, playTrack]
  );

  const chillCount = getTracksByMood('chill').length;
  const focusCount = getTracksByMood('focus').length;
  const workoutCount = getTracksByMood('workout').length;
  const hasMoodPlaylists = chillCount + focusCount + workoutCount > 0;

  const ListHeader = (
    <View>
      {/* Top header */}
      <LinearGradient
        colors={[accentColor + '25', 'transparent']}
        style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>Waveform</Text>
            <Text style={styles.trackCount}>
              {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {/* Scan / Import button */}
            <TouchableOpacity
              style={[styles.headerButton, { borderColor: accentColor + '60' }]}
              onPress={scanLibrary}
              disabled={isScanning}
            >
              <Ionicons
                name={Platform.OS === 'ios' ? 'add-circle' : 'refresh'}
                size={18}
                color={accentColor}
              />
              <Text style={[styles.headerButtonText, { color: accentColor }]}>
                {Platform.OS === 'ios' ? 'Import' : 'Scan'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Scan progress */}
      {isScanning && (
        <View style={styles.scanProgress}>
          <View style={styles.scanProgressBar}>
            <Animated.View
              style={[styles.scanProgressFill, { width: `${scanProgress.total > 0 ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0}%`, backgroundColor: Colors.accent }]}
            />
          </View>
          <Text style={styles.scanProgressText}>
            {scanStatus || (scanProgress.total > 0
              ? `Scanning ${scanProgress.current} / ${scanProgress.total} files…`
              : 'Scanning...')}
          </Text>
        </View>
      )}

      {/* Scan status (non-scanning) */}
      {!isScanning && scanStatus && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{scanStatus}</Text>
        </View>
      )}

      {/* Scan error */}
      {scanError && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={16} color={Colors.warning} />
          <Text style={styles.errorText}>{scanError}</Text>
        </View>
      )}

      {/* Permission prompt */}
      {!hasPermission && !isScanning && (
        <TouchableOpacity
          style={[styles.permissionBanner, { borderColor: accentColor + '40' }]}
          onPress={scanLibrary}
        >
          <Ionicons name="shield-checkmark" size={20} color={accentColor} />
          <Text style={styles.permissionText}>
            Grant permission to scan your music library
          </Text>
          <Ionicons name="chevron-forward" size={16} color={accentColor} />
        </TouchableOpacity>
      )}

      {/* Rediscover section */}
      {rediscoverTracks.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🕰️ Rediscover</Text>
            <Text style={styles.sectionSubtitle}>Songs you haven't heard in a while</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rediscoverList}
          >
            {rediscoverTracks.slice(0, 10).map((track) => (
              <RediscoverCard
                key={track.id}
                track={track}
                onPress={() => handleTrackPress(track)}
              />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Mood playlists */}
      {hasMoodPlaylists && (
        <Animated.View entering={FadeInDown.delay(200)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>✨ Mood</Text>
          </View>
          <View style={styles.moodGrid}>
            <MoodCard mood="chill" count={chillCount} onPress={() => handleMoodPress('chill')} />
            <MoodCard mood="focus" count={focusCount} onPress={() => handleMoodPress('focus')} />
            <MoodCard mood="workout" count={workoutCount} onPress={() => handleMoodPress('workout')} />
          </View>
        </Animated.View>
      )}

      {/* All Songs header */}
      {tracks.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Songs</Text>
          </View>
        </Animated.View>
      )}

      {/* Empty state */}
      {tracks.length === 0 && !isScanning && (
        <Animated.View entering={FadeIn} style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎵</Text>
          <Text style={styles.emptyTitle}>No music found</Text>
          <Text style={styles.emptySubtitle}>
            {Platform.OS === 'ios'
              ? 'Tap Import to add music from the Files app'
              : 'Tap Scan to find music on your device'}
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: accentColor }]}
            onPress={scanLibrary}
          >
            <Text style={styles.emptyButtonText}>
              {Platform.OS === 'ios' ? 'Import Music' : 'Scan Now'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <SongCard
            track={item}
            onPress={handleTrackPress}
            index={index}
            isActive={currentTrack?.id === item.id}
            accentColor={accentColor}
          />
        )}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  appName: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  trackCount: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: Colors.surfaceElevated,
  },
  headerButtonText: {
    ...Typography.labelLarge,
  },
  scanProgress: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  scanProgressBar: {
    height: 3,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 2,
    marginBottom: 6,
  },
  scanProgressFill: {
    height: 3,
    borderRadius: 2,
  },
  scanProgressText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.warning + '20',
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.warning,
    flex: 1,
  },
  statusBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
  },
  statusText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: Colors.surfaceElevated,
  },
  permissionText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  rediscoverList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  rediscoverCard: {
    width: REDISCOVER_CARD_WIDTH,
  },
  rediscoverInfo: {
    marginTop: 8,
  },
  rediscoverTitle: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  rediscoverArtist: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  rediscoverTime: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  moodCard: {
    width: MOOD_CARD_WIDTH - 5,
    borderRadius: 20,
    overflow: 'hidden',
  },
  moodGradient: {
    padding: 20,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  moodIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  moodName: {
    ...Typography.titleMedium,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  moodCount: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.7)',
  },
  listContent: {
    paddingBottom: 160, // Account for mini player + tab bar
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
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
    marginBottom: 32,
    lineHeight: 22,
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyButtonText: {
    ...Typography.titleMedium,
    color: '#FFFFFF',
  },
});
