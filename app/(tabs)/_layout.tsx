import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '../../src/components/MiniPlayer';
import { usePlayerStore } from '../../src/store/playerStore';
import { Colors } from '../../src/theme/colors';

function TabBarBackground() {
  return (
    <BlurView
      intensity={90}
      tint="dark"
      style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,10,0.85)' }]}
    />
  );
}

export default function TabLayout() {
  const { currentTrack, accentColor } = usePlayerStore();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: accentColor,
          tabBarInactiveTintColor: Colors.tabBarInactive,
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
            backgroundColor: 'transparent',
            borderTopWidth: 1,
            borderTopColor: Colors.tabBarBorder,
            elevation: 0,
          },
          tabBarBackground: () => <TabBarBackground />,
          tabBarLabelStyle: {
            fontFamily: 'Outfit-Medium',
            fontSize: 11,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="library" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="playlists"
          options={{
            title: 'Playlists',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="now-playing"
          options={{
            title: 'Now Playing',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="musical-note" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Mini player floats above tab bar */}
      {currentTrack && <MiniPlayer />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
