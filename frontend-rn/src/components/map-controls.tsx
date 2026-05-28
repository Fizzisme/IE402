import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onMyLocation: () => void;
}

export function MapControls({ onZoomIn, onZoomOut, onMyLocation }: MapControlsProps) {
  return (
    <View style={styles.container}>
      {/* Zoom controls */}
      <View style={styles.zoomGroup}>
        <TouchableOpacity style={styles.btn} onPress={onZoomIn} activeOpacity={0.7}>
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.btn} onPress={onZoomOut} activeOpacity={0.7}>
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>
      </View>

      {/* My location */}
      <TouchableOpacity style={[styles.btn, styles.locationBtn]} onPress={onMyLocation} activeOpacity={0.7}>
        <Text style={styles.locationIcon}>◎</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    bottom: 16,
    gap: 8,
    alignItems: 'center',
  },
  zoomGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  btn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  btnText: {
    fontSize: 22,
    color: '#374151',
    lineHeight: 26,
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  locationBtn: {
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  locationIcon: {
    fontSize: 20,
    color: '#3B82F6',
  },
});
