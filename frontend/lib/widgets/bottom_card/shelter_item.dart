import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../models/shelter.dart';

class ShelterItem extends StatelessWidget {
  final Shelter shelter;

  const ShelterItem({super.key, required this.shelter});

  String _iconPath(String? type) {
      switch (type) {
        case 'bunker':           return 'lib/core/icons/bunker.png';
        case 'community_center': return 'lib/core/icons/community_center.png';
        case 'hospital':         return 'lib/core/icons/hospital.png';
        case 'school':           return 'lib/core/icons/school.png';
        default:                 return 'lib/core/icons/community_center.png';
      }
    }

  @override
  Widget build(BuildContext context) {
    final double distance = shelter.distanceM;
    final String displayDistance = distance >= 1000
        ? '${(distance / 1000).toStringAsFixed(1)} km'
        : '${distance.toStringAsFixed(0)} m';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.shelterItemBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.shelterItemBorder),
      ),
      child: Row(
        children: [
          Image.asset(
            _iconPath(shelter.type),
            width: 34,
            height: 34,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  shelter.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                // THAY ĐỔI: "Sức chứa: X • Còn trống: Y" → "Y/X chỗ trống"
                Text(
                  '${shelter.currentOccupancy}/${shelter.capacity} sức chứa',
                  style: const TextStyle(
                    color: AppColors.textTertiary,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                displayDistance,
                style: const TextStyle(
                  color: AppColors.shelterAccent,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              // THAY ĐỔI: bỏ số available lặp lại, thêm thời gian ước tính
              Text(
                '~${(distance / 80).round()} phút',
                style: const TextStyle(
                  color: AppColors.textTertiary,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}