import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useLibraryStore } from '../../src/store/libraryStore';
import { usePlayerStore } from '../../src/store/playerStore';
import { SongCard } from '../../src/components/SongCard';
import { Colors } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Track } from '../../src/types';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { searchResults, searchQuery, setSearchQuery } = useLibraryStore();
  const { playTrack, accentColor } = usePlayerStore();
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
    },
    [setSearchQuery]
  );

  const handleTrackPress = useCallback(
    (track: Track) => {
      playTrack(track, searchResults);
      usePlayerStore.getState().setIsPlaying(true);
      Keyboard.dismiss();
    },
    [searchResults, playTrack]
  );

  const handleClear = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Search</Text>
      </View>

      {/* Search Input */}
      <View
        style={[
          styles.searchContainer,
          isFocused && { borderColor: accentColor + '80' },
        ]}
      >
        <Ionicons
          name="search"
          size={18}
          color={isFocused ? accentColor : Colors.textTertiary}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: Colors.textPrimary }]}
          placeholder="Songs, artists, albums…"
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={handleSearch}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      {searchQuery.length >= 2 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <SongCard
              track={item}
              onPress={handleTrackPress}
              index={index}
              accentColor={accentColor}
            />
          )}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            searchResults.length > 0 ? (
              <Text style={styles.resultsCount}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Animated.View entering={FadeIn} style={styles.noResults}>
              <Text style={styles.noResultsIcon}>🔍</Text>
              <Text style={styles.noResultsTitle}>No results</Text>
              <Text style={styles.noResultsSubtitle}>
                Try searching for a different song, artist, or album
              </Text>
            </Animated.View>
          }
        />
      ) : (
        <Animated.View entering={FadeIn} style={styles.searchPrompt}>
          <Text style={styles.searchPromptIcon}>🎵</Text>
          <Text style={styles.searchPromptTitle}>Find your music</Text>
          <Text style={styles.searchPromptSubtitle}>
            Search across your entire local library
          </Text>

          {/* Quick filters */}
          <View style={styles.quickFilters}>
            <Text style={styles.quickFiltersTitle}>Browse by mood</Text>
            <View style={styles.quickFilterRow}>
              {(['🌙 Chill', '🎯 Focus', '💪 Workout'] as const).map((label) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.filterChip, { borderColor: accentColor + '40' }]}
                  onPress={() => handleSearch(label.split(' ')[1])}
                >
                  <Text style={[styles.filterChipText, { color: accentColor }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  screenTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: 10,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    height: '100%',
  },
  resultsList: {
    paddingBottom: 160,
  },
  resultsCount: {
    ...Typography.labelSmall,
    color: Colors.textTertiary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    textTransform: 'none',
    letterSpacing: 0,
  },
  noResults: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  noResultsIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noResultsTitle: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  noResultsSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  searchPrompt: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 32,
  },
  searchPromptIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  searchPromptTitle: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  searchPromptSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  quickFilters: {
    width: '100%',
  },
  quickFiltersTitle: {
    ...Typography.labelSmall,
    color: Colors.textTertiary,
    marginBottom: 12,
    textAlign: 'center',
  },
  quickFilterRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: Colors.surfaceElevated,
  },
  filterChipText: {
    ...Typography.labelLarge,
    textTransform: 'none',
    letterSpacing: 0,
  },
});
