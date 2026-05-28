import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import type { DangerZoneAlert } from '@/services/socket.service';

interface DangerAlertProps {
  alert: DangerZoneAlert | null;
  onDismiss: () => void;
}

export function DangerAlert({ alert, onDismiss }: DangerAlertProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(5000),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        onDismiss();
      });
    }
  }, [alert, fadeAnim, onDismiss]);

  if (!visible || !alert) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={styles.alert}
        onPress={() => {
          setVisible(false);
          onDismiss();
        }}
        activeOpacity={0.9}
      >
        <View style={styles.content}>
          <Text style={styles.icon}>⚠️</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{alert.zoneName}</Text>
            <Text style={styles.message} numberOfLines={2}>
              {alert.message}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  alert: {
    backgroundColor: '#7F1D1D',
    borderRadius: 8,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  icon: {
    fontSize: 20,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FEE2E2',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: '#FECACA',
    lineHeight: 16,
  },
});
