import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  PanResponder,
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
  activeCheckinShelterId: string | null;
  isCheckinLoading: boolean;
  isLoggedIn: boolean;
  isAtShelter: boolean;
  hasArrived: boolean;
  remainingDistanceM: number;
  onCheckin: (shelter: Shelter) => void;
  onCheckout: () => void;
}

const PEEK_HEIGHT = 40;

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

// riskPercent = mức nguy hiểm cao nhất tuyến đi qua (0–100), tính ở backend.
const riskColor = (pct: number): string =>
  pct < 20 ? '#16A34A' : pct < 50 ? '#F59E0B' : '#EF4444';

const riskLabel = (pct: number): string =>
  pct < 20 ? 'Thấp' : pct < 50 ? 'Trung bình' : 'Cao';

export function BottomCard({
  selectedShelter,
  shelters,
  routeResult,
  isEmergency,
  isRouteLoading,
  onSelectShelter,
  activeCheckinShelterId,
  isCheckinLoading,
  isLoggedIn,
  isAtShelter,
  hasArrived,
  remainingDistanceM,
  onCheckin,
  onCheckout,
}: BottomCardProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const fullHeightRef = useRef(0);
  const isExpandedRef = useRef(true);
  const dragStartRef = useRef(0);

  // collapseAmount reads fullHeightRef at call-time so it's always fresh
  const collapseAmount = () => Math.max(0, fullHeightRef.current - PEEK_HEIGHT);

  const snapTo = (expand: boolean) => {
    isExpandedRef.current = expand;
    Animated.spring(translateY, {
      toValue: expand ? 0 : collapseAmount(),
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 5,
      onPanResponderGrant: () => {
        // Freeze current animated value, then use offset so dy starts from 0
        translateY.stopAnimation((v) => {
          dragStartRef.current = v;
          translateY.setOffset(v);
          translateY.setValue(0);
        });
      },
      onPanResponderMove: (_, { dy }) => {
        const base = dragStartRef.current;
        const maxDown = collapseAmount() - base; // can't go below collapsed
        const maxUp = -base;                     // can't go above expanded (translateY < 0)
        translateY.setValue(Math.max(maxUp, Math.min(maxDown, dy)));
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        translateY.flattenOffset();
        const finalVal = dragStartRef.current + dy;
        // Fast swipe up OR past upper 55% → expand; otherwise collapse
        const expand = vy < -0.5 || finalVal < collapseAmount() * 0.55;
        snapTo(expand);
      },
    }),
  ).current;

  const onLayout = (e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height;
    if (h > PEEK_HEIGHT) fullHeightRef.current = h;
  };

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
      onLayout={onLayout}
    >
      {/* Handle — drag or tap to toggle */}
      <TouchableOpacity
        style={styles.handleArea}
        onPress={() => snapTo(!isExpandedRef.current)}
        activeOpacity={1}
        {...panResponder.panHandlers}
      >
        <View style={styles.handlePill} />
      </TouchableOpacity>

      {isEmergency && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>⚠️ CẢNH BÁO: Bạn ở trong vùng nguy hiểm!</Text>
        </View>
      )}

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
            ) : hasArrived ? (
              <View style={styles.arrivedBox}>
                <Text style={styles.arrivedText}>✓ Bạn đã đến nơi trú ẩn</Text>
              </View>
            ) : routeResult ? (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Khoảng cách còn lại:</Text>
                  <Text style={styles.infoValue}>
                    {formatDistance(remainingDistanceM || routeResult.totalDistanceM)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Thời gian:</Text>
                  <Text style={styles.infoValue}>
                    {formatTime(
                      routeResult.totalDistanceM > 0
                        ? routeResult.estimatedTimeMin *
                            ((remainingDistanceM || routeResult.totalDistanceM) /
                              routeResult.totalDistanceM)
                        : routeResult.estimatedTimeMin,
                    )}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {(() => {
            const isCheckedInHere = activeCheckinShelterId === selectedShelter.id;
            const checkedInElsewhere =
              !!activeCheckinShelterId && !isCheckedInHere;
            const isFull =
              selectedShelter.capacity > 0 &&
              selectedShelter.currentOccupancy >= selectedShelter.capacity;

            if (isCheckedInHere) {
              return (
                <TouchableOpacity
                  style={[styles.checkinBtn, styles.checkoutBtn]}
                  onPress={onCheckout}
                  disabled={isCheckinLoading}
                  activeOpacity={0.8}
                >
                  {isCheckinLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.checkinBtnText}>Check-out</Text>
                  )}
                </TouchableOpacity>
              );
            }

            // Chưa đăng nhập: nút vẫn hiện, bấm vào sẽ nhắc đăng nhập
            if (!isLoggedIn) {
              return (
                <TouchableOpacity
                  style={styles.checkinBtn}
                  onPress={() => onCheckin(selectedShelter)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.checkinBtnText}>Đăng nhập để check-in</Text>
                </TouchableOpacity>
              );
            }

            const disabled =
              isCheckinLoading || checkedInElsewhere || isFull || !isAtShelter;
            const label = checkedInElsewhere
              ? 'Đang check-in ở nơi khác'
              : isFull
                ? 'Đã đầy chỗ'
                : !isAtShelter
                  ? 'Hãy đến nơi trú ẩn để check-in'
                  : 'Check-in tại đây';
            return (
              <TouchableOpacity
                style={[styles.checkinBtn, disabled && styles.checkinBtnDisabled]}
                onPress={() => onCheckin(selectedShelter)}
                disabled={disabled}
                activeOpacity={0.8}
              >
                {isCheckinLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.checkinBtnText}>{label}</Text>
                )}
              </TouchableOpacity>
            );
          })()}
        </View>
      )}

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
                  style={[styles.shelterItem, isSelected && styles.shelterItemSelected]}
                  onPress={() => onSelectShelter(shelter)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.shelterItemName,
                      isSelected && styles.shelterItemNameSelected,
                    ]}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 },
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: -16,
  },
  handlePill: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
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
  checkinBtn: {
    marginTop: 12,
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  checkinBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  checkoutBtn: {
    backgroundColor: '#DC2626',
  },
  checkinBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  arrivedBox: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivedText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16A34A',
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
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
