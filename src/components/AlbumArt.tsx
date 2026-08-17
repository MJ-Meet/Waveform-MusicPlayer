import React from 'react';
import {
  View,
  StyleSheet,
  Image,
  ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface AlbumArtProps {
  uri: string | null | undefined;
  size?: number;
  borderRadius?: number;
  style?: ViewStyle;
  sharedTag?: string;
  showShadow?: boolean;
  accentColor?: string;
}

export function AlbumArt({
  uri,
  size = 200,
  borderRadius = 16,
  style,
  sharedTag,
  showShadow = true,
  accentColor = Colors.accent,
}: AlbumArtProps) {
  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
  };

  const shadowStyle: ViewStyle = showShadow
    ? {
        shadowColor: accentColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 12,
      }
    : {};

  const content = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      resizeMode="cover"
    />
  ) : (
    <View style={[styles.placeholder, { width: size, height: size }]}>
      <Ionicons name="musical-notes" size={size * 0.35} color={Colors.textTertiary} />
    </View>
  );

  if (sharedTag) {
    return (
      <Animated.View
        sharedTransitionTag={sharedTag}
        style={[containerStyle, shadowStyle, style]}
      >
        {content}
      </Animated.View>
    );
  }

  return (
    <View style={[containerStyle, shadowStyle, style]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
