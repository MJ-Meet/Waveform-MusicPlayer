import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Track } from '../types';
import { AlbumArt } from './AlbumArt';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { formatDuration } from '../utils/generateId';

interface SongActionModalProps {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  accentColor?: string;
}

export function SongActionModal({
  visible,
  track,
  onClose,
  accentColor = Colors.accent,
}: SongActionModalProps) {
  const { playlists, toggleFavorite, addTrackToPlaylist, deleteTrack } = useLibraryStore();
  const { currentTrack, pause } = usePlayerStore();
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!track) return null;

  const handleToggleFav = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(track.id);
    onClose();
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await addTrackToPlaylist(playlistId, track.id);
    setShowPlaylists(false);
    onClose();
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Remove Song',
      `Remove "${track.title}" from your library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (currentTrack?.id === track.id) {
              pause();
            }
            await deleteTrack(track.id);
            onClose();
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setShowPlaylists(false);
    setShowDetails(false);
    onClose();
  };

  const userPlaylists = playlists.filter((p) => !p.isAuto);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Track Header */}
          <View style={styles.header}>
            <AlbumArt
              uri={track.artworkUri}
              size={54}
              borderRadius={10}
              showShadow={false}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.title} numberOfLines={1}>
                {track.title}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {track.artist} {track.album !== 'Unknown Album' ? `• ${track.album}` : ''}
              </Text>
              <Text style={styles.duration}>
                {formatDuration(track.duration)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Playlist picker sub-view */}
          {showPlaylists ? (
            <View style={styles.playlistSection}>
              <View style={styles.subHeader}>
                <TouchableOpacity onPress={() => setShowPlaylists(false)} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.subTitle}>Add to Playlist</Text>
              </View>

              {userPlaylists.length === 0 ? (
                <Text style={styles.emptyText}>No custom playlists yet. Create one in Playlists tab.</Text>
              ) : (
                <ScrollView style={styles.playlistList} showsVerticalScrollIndicator={false}>
                  {userPlaylists.map((pl) => (
                    <TouchableOpacity
                      key={pl.id}
                      style={styles.playlistItem}
                      onPress={() => handleAddToPlaylist(pl.id)}
                    >
                      <Ionicons name="musical-notes" size={18} color={accentColor} />
                      <Text style={styles.playlistName} numberOfLines={1}>
                        {pl.name}
                      </Text>
                      <Ionicons name="add" size={18} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : showDetails ? (
            /* Details sub-view */
            <View style={styles.detailsSection}>
              <View style={styles.subHeader}>
                <TouchableOpacity onPress={() => setShowDetails(false)} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.subTitle}>Song Details</Text>
              </View>

              <ScrollView style={styles.detailsList} showsVerticalScrollIndicator={false}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Title</Text>
                  <Text style={styles.detailValue}>{track.title}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Artist</Text>
                  <Text style={styles.detailValue}>{track.artist}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Album</Text>
                  <Text style={styles.detailValue}>{track.album}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{formatDuration(track.duration)}</Text>
                </View>
                {track.mood && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Mood</Text>
                    <Text style={[styles.detailValue, { textTransform: 'capitalize' }]}>{track.mood}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>File</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>{track.filename}</Text>
                </View>
              </ScrollView>
            </View>
          ) : (
            /* Main Actions List */
            <View style={styles.actionsList}>
              {/* Favorite */}
              <TouchableOpacity style={styles.actionRow} onPress={handleToggleFav}>
                <Ionicons
                  name={track.isFavorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={track.isFavorite ? '#EF4444' : Colors.textPrimary}
                />
                <Text style={styles.actionText}>
                  {track.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </Text>
              </TouchableOpacity>

              {/* Add to Playlist */}
              <TouchableOpacity style={styles.actionRow} onPress={() => setShowPlaylists(true)}>
                <Ionicons name="add-circle-outline" size={22} color={Colors.textPrimary} />
                <Text style={styles.actionText}>Add to Playlist</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} style={styles.rowArrow} />
              </TouchableOpacity>

              {/* Song Details */}
              <TouchableOpacity style={styles.actionRow} onPress={() => setShowDetails(true)}>
                <Ionicons name="information-circle-outline" size={22} color={Colors.textPrimary} />
                <Text style={styles.actionText}>Song Details</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} style={styles.rowArrow} />
              </TouchableOpacity>

              {/* Delete / Remove */}
              <TouchableOpacity style={styles.actionRow} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color={Colors.error} />
                <Text style={[styles.actionText, { color: Colors.error }]}>
                  Remove from Library
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  blurContainer: {
    paddingTop: 12,
    paddingBottom: 36,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceHighlight,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  artist: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  duration: {
    ...Typography.labelSmall,
    color: Colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceHighlight,
    marginVertical: 12,
  },
  actionsList: {
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  actionText: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    marginLeft: 14,
    flex: 1,
  },
  rowArrow: {
    marginLeft: 'auto',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  backBtn: {
    padding: 4,
  },
  subTitle: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },
  playlistSection: {
    minHeight: 180,
  },
  playlistList: {
    maxHeight: 220,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight + '40',
  },
  playlistName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 24,
  },
  detailsSection: {
    minHeight: 200,
  },
  detailsList: {
    maxHeight: 260,
  },
  detailRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight + '30',
  },
  detailLabel: {
    ...Typography.labelSmall,
    color: Colors.textTertiary,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  detailValue: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
});
