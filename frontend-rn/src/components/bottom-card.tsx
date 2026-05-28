import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { Shelter } from '@/types/shelter';
import type { RouteResult } from '@/types/route-result';

interface BottomCardProps {
  selectedShelter: Shelter | null;
  shelters: Shelter[];
  routeResult: RouteResult | null;
  isEmergency: boolean;
  isRouteLoading: boolean;
  onSelectShelter: (shelter: Shelter) => void;
}

const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

const formatTime = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h${m > 0 ? m + 'm' : ''}`;
};

export function BottomCard({
  selectedShelter,
  shelters,
  routeResult,
  isEmergency,
  isRouteLoading,
  onSelectShelter,
}: BottomCardProps) {
  const availableCapacity = selectedShelter
    ? selectedShelter.capacity - selectedShelter.currentOccupancy
    : 0;

  return (
    <View style={styles.container}>
      {/* Emergency indicator */}
      {isEmergency && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>⚠️ CẢNH BÁO: Bạn ở trong vùng nguy hiểm!</Text>
        </View>
      )}

      {/* Selected shelter card */}
      {selectedShelter && (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeader}>
            <View style={styles.selectedTitleContainer}>
              <Text style={styles.shelterName} numberOfLines={1}>
                {selectedShelter.name}
              </Text>
              <Text style={styles.capacity}>
                {selectedShelter.currentOccupancy}/{selectedShelter.capacity} chỗ
              </Text>
            </View>
          </View>

          <View style={styles.routeBody}>
            {isRouteLoading ? (
              <View style={styles.loadingRoute}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.loadingText}>Tính toán tuyến đường...</Text>
              </View>
            ) : routeResult ? (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Khoảng cách:</Text>
                  <Text style={styles.infoValue}>
                    {formatDistance(routeResult.totalDistanceM)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Thời gian:</Text>
                  <Text style={styles.infoValue}>
                    {formatTime(routeResult.estimatedTimeMin)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mức rủi ro:</Text>
                  <Text style={styles.riskScore}>{routeResult.totalRiskScore.toFixed(1)}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      )}

      {/* Nearby shelters list */}
      {shelters.length > 0 && (
        <View style={styles.shelterListContainer}>
          <Text style={styles.listTitle}>
            Các nơi trú ẩn gần khác ({shelters.length})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.shelterScroll}
            contentContainerStyle={styles.shelterScrollContent}
          >
            {shelters.map((shelter) => {
              const isSelected = selectedShelter?.id === shelter.id;
              return (
                <TouchableOpacity
                  key={shelter.id}
                  style={[
                    styles.shelterItem,
                    isSelected && styles.shelterItemSelected,
                  ]}
                  onPress={() => onSelectShelter(shelter)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.shelterItemName, isSelected && styles.shelterItemNameSelected]}
                    numberOfLines={2}
                  >
                    {shelter.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {shelters.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Không có nơi trú ẩn gần bạn</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 },
  },
  emergencyBanner: {
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  emergencyText: {
    color: '#7F1D1D',
    fontSize: 13,
    fontWeight: '600',
  },
  selectedCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 12,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  selectedTitleContainer: {
    flex: 1,
  },
  shelterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 4,
  },
  capacity: {
    fontSize: 12,
    color: '#0369A1',
  },
  routeBody: {
    minHeight: 84,
    gap: 8,
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  riskScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  loadingRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  shelterListContainer: {
    gap: 8,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  shelterScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  shelterScrollContent: {
    gap: 8,
  },
  shelterItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shelterItemSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  shelterItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  shelterItemNameSelected: {
    color: '#0369A1',
  },
  shelterItemDistance: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 3,
  },
  shelterItemDistanceSelected: {
    fontSize: 11,
    color: '#0369A1',
    marginBottom: 3,
  },
  shelterItemLoader: {
    marginBottom: 3,
    alignSelf: 'flex-start',
  },
  shelterItemCapacity: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  shelterItemCapacitySelected: {
    color: '#059669',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
