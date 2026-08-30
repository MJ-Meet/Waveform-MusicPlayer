import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useLibraryStore } from '../../src/store/libraryStore';
import { usePlayerStore } from '../../src/store/playerStore';
import { DatabaseService } from '../../src/services/DatabaseService';
import { AlbumArt } from '../../src/components/AlbumArt';
import { SongCard } from '../../src/components/SongCard';
import { SongActionModal } from '../../src/components/SongActionModal';
import { Colors, MoodColors } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Playlist, Track } from '../../src/types';

function PlaylistCard({
  playlist,
  trackCount,
  onPress,
  onDelete,
}: {
  playlist: Playlist;
  trackCount: number;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const moodColors = playlist.mood ? MoodColors[playlist.mood] : null;

  return (
    <TouchableOpacity style={styles.playlistCard} onPress={onPress} activeOpacity={0.8}>
      {moodColors ? (
        <LinearGradient
          colors={[moodColors.primary + 'CC', moodColors.secondary + '88']}
          style={styles.playlistArtGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.moodEmoji}>
            {playlist.mood === 'chill' ? '🌙' : playlist.mood === 'focus' ? '🎯' : '💪'}
          </Text>
        </LinearGradient>
      ) : (
        <AlbumArt
          uri={playlist.artworkUri}
          size={56}
          borderRadius={10}
          showShadow={false}
        />
      )}

      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={styles.playlistMeta}>
          {playlist.isAuto ? 'Auto • ' : ''}{trackCount} songs
        </Text>
      </View>

      <View style={styles.playlistActions}>
        {!playlist.isAuto && onDelete && (
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const { playlists, createPlaylist, deletePlaylist } = useLibraryStore();
  const { playTrack, accentColor } = usePlayerStore();
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedActionTrack, setSelectedActionTrack] = useState<Track | null>(null);

  const handlePlaylistPress = useCallback(async (playlist: Playlist) => {
    const tracks = await DatabaseService.getPlaylistTracks(playlist.id);
    setPlaylistTracks(tracks);
    setSelectedPlaylist(playlist);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
  }, []);

  const handleDeletePlaylist = useCallback(
    (playlist: Playlist) => {
      Alert.alert(
        'Delete Playlist',
        `Delete "${playlist.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deletePlaylist(playlist.id),
          },
        ]
      );
    },
    [deletePlaylist]
  );

  const handleCreatePlaylist = useCallback(async () => {
    if (!newPlaylistName.trim()) return;
    await createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setShowCreateInput(false);
  }, [newPlaylistName, createPlaylist]);

  // Playlist detail view
  if (selectedPlaylist) {
    const moodColors = selectedPlaylist.mood ? MoodColors[selectedPlaylist.mood] : null;

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {selectedPlaylist.name}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Playlist art */}
        <View style={styles.detailArtContainer}>
          {moodColors ? (
            <LinearGradient
              colors={[moodColors.primary, moodColors.secondary]}
              style={styles.detailArtGradient}
            >
              <Text style={styles.detailMoodEmoji}>
                {selectedPlaylist.mood === 'chill' ? '🌙' : selectedPlaylist.mood === 'focus' ? '🎯' : '💪'}
              </Text>
            </LinearGradient>
          ) : (
            <AlbumArt
              uri={selectedPlaylist.artworkUri}
              size={160}
              borderRadius={20}
            />
          )}
          <View style={styles.detailMeta}>
            <Text style={styles.detailPlaylistName}>{selectedPlaylist.name}</Text>
            <Text style={styles.detailTrackCount}>{playlistTracks.length} songs</Text>
            {playlistTracks.length > 0 && (
              <TouchableOpacity
                style={[styles.playAllButton, { backgroundColor: accentColor }]}
                onPress={() => {
                  if (playlistTracks.length > 0) {
                    playTrack(playlistTracks[0], playlistTracks);
                    usePlayerStore.getState().setIsPlaying(true);
                  }
                }}
              >
                <Ionicons name="play" size={18} color="#fff" />
                <Text style={styles.playAllText}>Play All</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tracks */}
        <FlatList
          data={playlistTracks}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <SongCard
              track={item}
              onPress={(t) => {
                playTrack(t, playlistTracks);
                usePlayerStore.getState().setIsPlaying(true);
              }}
              onMenuPress={setSelectedActionTrack}
              showIndex
              index={index}
              accentColor={accentColor}
            />
          )}
          contentContainerStyle={{ paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyPlaylist}>
              <Text style={styles.emptyPlaylistText}>No songs in this playlist</Text>
            </View>
          }
        />

        {/* Song Actions Menu Modal */}
        <SongActionModal
          visible={!!selectedActionTrack}
          track={selectedActionTrack}
          onClose={() => setSelectedActionTrack(null)}
          accentColor={accentColor}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Playlists</Text>
        <TouchableOpacity
          style={[styles.createButton, { borderColor: accentColor + '60' }]}
          onPress={() => setShowCreateInput(!showCreateInput)}
        >
          <Ionicons name="add" size={18} color={accentColor} />
          <Text style={[styles.createButtonText, { color: accentColor }]}>New</Text>
        </TouchableOpacity>
      </View>

      {showCreateInput && (
        <Animated.View entering={FadeInDown} style={styles.createInputRow}>
          <TextInput
            style={[styles.createInput, { borderColor: accentColor + '60', color: Colors.textPrimary }]}
            placeholder="Playlist name…"
            placeholderTextColor={Colors.textTertiary}
            value={newPlaylistName}
            onChangeText={setNewPlaylistName}
            autoFocus
            onSubmitEditing={handleCreatePlaylist}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.createConfirmButton, { backgroundColor: accentColor }]}
            onPress={handleCreatePlaylist}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PlaylistCard
            playlist={item}
            trackCount={0}
            onPress={() => handlePlaylistPress(item)}
            onDelete={!item.isAuto ? () => handleDeletePlaylist(item) : undefined}
          />
        )}
        contentContainerStyle={styles.playlistList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎵</Text>
            <Text style={styles.emptyTitle}>No playlists yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a playlist or scan your library to generate mood playlists
            </Text>
          </View>
        }
      />
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  screenTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: Colors.surfaceElevated,
  },
  createButtonText: {
    ...Typography.labelLarge,
  },
  createInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  createInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surfaceElevated,
    fontFamily: 'Outfit-Regular',
    fontSize: 15,
  },
  createConfirmButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistList: {
    paddingHorizontal: 16,
    paddingBottom: 160,
    gap: 4,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.card,
    marginBottom: 8,
    gap: 14,
  },
  playlistArtGradient: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: {
    fontSize: 24,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  playlistMeta: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  playlistActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 56,
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
  // Detail view styles
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  detailTitle: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  detailArtContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 20,
    alignItems: 'center',
  },
  detailArtGradient: {
    width: 160,
    height: 160,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMoodEmoji: {
    fontSize: 64,
  },
  detailMeta: {
    flex: 1,
    gap: 8,
  },
  detailPlaylistName: {
    ...Typography.headlineLarge,
    color: Colors.textPrimary,
  },
  detailTrackCount: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  playAllText: {
    ...Typography.titleSmall,
    color: '#fff',
  },
  emptyPlaylist: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyPlaylistText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
});
