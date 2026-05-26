import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../../core/theme/app_colors.dart';
import '../../models/shelter.dart';
import 'shelter_item.dart';

class NormalBottomCard extends StatelessWidget {
  final List<Shelter> shelters;
  final bool isLoading;
  final LatLng userLocation;
  final VoidCallback? onClose;

  const NormalBottomCard({
    super.key,
    required this.shelters,
    required this.isLoading,
    required this.userLocation,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bottomSheetBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
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
              color: AppColors.dragHandle,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'HẦM TRÚ ẨN GẦN NHẤT',
                  style: TextStyle(
                    color: AppColors.textTertiary,
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
                      color: AppColors.iconBoxBg,
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: const Icon(
                      Icons.close,
                      size: 14,
                      color: AppColors.textTertiary,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 0.5, color: AppColors.divider),

          // Content
          if (isLoading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(
                color: AppColors.shelterAccent,
                strokeWidth: 2,
              ),
            )
          else if (shelters.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Không tìm thấy hầm trú ẩn gần đây',
                style: TextStyle(color: AppColors.textTertiary, fontSize: 13),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: shelters.length,
              itemBuilder: (_, i) => ShelterItem(shelter: shelters[i]),
            ),

          const SizedBox(height: 8),
        ],
      ),
    );
  }
}