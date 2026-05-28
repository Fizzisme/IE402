import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../../core/theme/app_colors.dart';
import '../../models/shelter.dart';
import '../../models/route_result.dart';
import 'shelter_item.dart';

class NormalBottomCard extends StatelessWidget {
  final List<Shelter> shelters;
  final bool isLoading;
  final LatLng userLocation;
  final RouteResult? routeResult;
  final Shelter? selectedShelter;
  final void Function(Shelter)? onShelterTap;
  final VoidCallback? onClose;

  const NormalBottomCard({
    super.key,
    required this.shelters,
    required this.isLoading,
    required this.userLocation,
    this.routeResult,
    this.selectedShelter,
    this.onShelterTap,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.bottomSheetBg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 36,
            height: 3,
            margin: const EdgeInsets.only(top: 10),
            decoration: BoxDecoration(
              color: colors.dragHandle,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'HẦM TRÚ ẨN GẦN NHẤT',
                  style: TextStyle(
                    color: colors.textTertiary,
                    fontSize: 10,
                    letterSpacing: 0.5,
                  ),
                ),
                GestureDetector(
                  onTap: onClose,
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      color: colors.iconBoxBg,
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: Icon(
                      Icons.close,
                      size: 14,
                      color: colors.textTertiary,
                    ),
                  ),
                ),
              ],
            ),
          ),

          Divider(height: 0.5, color: colors.divider),

          // Content
          if (isLoading)
            Padding(
              padding: const EdgeInsets.all(24),
              child: CircularProgressIndicator(
                color: colors.shelterAccent,
                strokeWidth: 2,
              ),
            )
          else if (shelters.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Không tìm thấy hầm trú ẩn gần đây',
                style: TextStyle(color: colors.textTertiary, fontSize: 13),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: shelters.length,
              itemBuilder: (_, i) {
                final isSelected = selectedShelter?.id == shelters[i].id;
                return ShelterItem(
                  shelter: shelters[i],
                  isSelected: isSelected,
                  routeDistanceM: isSelected ? routeResult?.totalDistanceM.toDouble() : null,
                  routeTimeMin: isSelected ? routeResult?.estimatedTimeMin : null,
                  onTap: () => onShelterTap?.call(shelters[i]),
                );
              },
            ),

          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
