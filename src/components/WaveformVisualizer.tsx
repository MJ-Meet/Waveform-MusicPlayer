import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors } from '../theme/colors';

interface WaveformVisualizerProps {
  isPlaying: boolean;
  accentColor?: string;
  barCount?: number;
  height?: number;
  style?: any;
}

const NUM_BARS = 24;
const BAR_WIDTH = 3;
const BAR_GAP = 2;

function AnimatedBar({
  index,
  isPlaying,
  accentColor,
  maxHeight,
}: {
  index: number;
  isPlaying: boolean;
  accentColor: string;
  maxHeight: number;
}) {
  const animValue = useSharedValue(0);
  const minHeight = 3;

  useEffect(() => {
    if (isPlaying) {
      const delay = index * 40;
      const duration = 400 + Math.floor(Math.random() * 400);

      animValue.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, {
            duration,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true
        )
      );
    } else {
      cancelAnimation(animValue);
      animValue.value = withTiming(0.1, { duration: 400 });
    }
  }, [isPlaying]);

  const animStyle = useAnimatedStyle(() => {
    const height = interpolate(
      animValue.value,
      [0, 1],
      [minHeight, maxHeight * (0.3 + (index % 3) * 0.15 + 0.2)]
    );
    const opacity = interpolate(animValue.value, [0, 1], [0.4, 1]);

    return {
      height,
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        animStyle,
        {
          backgroundColor: accentColor,
          width: BAR_WIDTH,
          borderRadius: BAR_WIDTH / 2,
          marginHorizontal: BAR_GAP / 2,
        },
      ]}
    />
  );
}

export function WaveformVisualizer({
  isPlaying,
  accentColor = Colors.accent,
  barCount = NUM_BARS,
  height = 32,
  style,
}: WaveformVisualizerProps) {
  return (
    <View style={[styles.container, { height }, style]}>
      {Array.from({ length: barCount }, (_, i) => (
        <AnimatedBar
          key={i}
          index={i}
          isPlaying={isPlaying}
          accentColor={accentColor}
          maxHeight={height}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bar: {
    // Dynamic styles applied above
  },
});
