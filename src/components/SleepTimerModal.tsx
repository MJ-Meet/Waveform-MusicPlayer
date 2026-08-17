import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { usePlayerStore } from '../store/playerStore';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface SleepTimerModalProps {
  visible: boolean;
  onClose: () => void;
}

const TIMER_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
  { label: '90 min', minutes: 90 },
];

export function SleepTimerModal({ visible, onClose }: SleepTimerModalProps) {
  const { sleepTimerEnd, setSleepTimer, accentColor } = usePlayerStore();
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (minutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(minutes);
  };

  const handleConfirm = () => {
    if (selected) {
      const endTime = Date.now() + selected * 60 * 1000;
      setSleepTimer(endTime);
    }
    onClose();
  };

  const handleCancel = () => {
    setSleepTimer(null);
    setSelected(null);
    onClose();
  };

  const remainingMinutes = sleepTimerEnd
    ? Math.ceil((sleepTimerEnd - Date.now()) / 60000)
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
          {/* Handle */}
          <View style={styles.handle} />

          <Text style={styles.title}>
            <Ionicons name="moon" size={18} color={accentColor} /> Sleep Timer
          </Text>

          {/* Active timer display */}
          {sleepTimerEnd && remainingMinutes && (
            <View style={[styles.activeTimer, { borderColor: accentColor + '40' }]}>
              <Ionicons name="time" size={16} color={accentColor} />
              <Text style={[styles.activeTimerText, { color: accentColor }]}>
                Stops in {remainingMinutes} min · fades last 30s
              </Text>
            </View>
          )}

          {/* Options grid */}
          <View style={styles.optionsGrid}>
            {TIMER_OPTIONS.map(({ label, minutes }) => (
              <TouchableOpacity
                key={minutes}
                style={[
                  styles.option,
                  selected === minutes && {
                    backgroundColor: accentColor + '30',
                    borderColor: accentColor,
                  },
                ]}
                onPress={() => handleSelect(minutes)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected === minutes && { color: accentColor },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {sleepTimerEnd && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel Timer</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: selected ? accentColor : Colors.surfaceHighlight },
              ]}
              onPress={handleConfirm}
              disabled={!selected}
            >
              <Text style={styles.confirmText}>
                {selected ? `Set ${selected} min timer` : 'Select duration'}
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    padding: 24,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceHighlight,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  activeTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: Colors.surfaceElevated,
    marginBottom: 16,
  },
  activeTimerText: {
    ...Typography.bodySmall,
    flex: 1,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  option: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surfaceElevated,
  },
  optionText: {
    ...Typography.titleSmall,
    color: Colors.textSecondary,
  },
  actions: {
    gap: 10,
  },
  cancelButton: {
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
  },
  cancelText: {
    ...Typography.titleSmall,
    color: Colors.error,
  },
  confirmButton: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmText: {
    ...Typography.titleMedium,
    color: Colors.textPrimary,
  },
});
