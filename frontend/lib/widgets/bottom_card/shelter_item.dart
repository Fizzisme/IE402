import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../models/shelter.dart';

class ShelterItem extends StatelessWidget {
  final Shelter shelter;
  final bool isSelected;
  final double? routeDistanceM;
  final double? routeTimeMin;
  final VoidCallback? onTap;

  const ShelterItem({
    super.key,
    required this.shelter,
    this.isSelected = false,
    this.routeDistanceM,
    this.routeTimeMin,
    this.onTap,
  });

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
    final colors = AppColors.of(context);

    if (!isSelected) {
      return GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: colors.shelterItemBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.shelterItemBorder),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  shelter.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${shelter.currentOccupancy}/${shelter.capacity} sức chứa',
                style: TextStyle(
                  color: colors.textTertiary,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Selected — full card
    final String displayDistance = routeDistanceM == null
        ? '...'
        : routeDistanceM! >= 1000
            ? '${(routeDistanceM! / 1000).toStringAsFixed(1)} km'
            : '${routeDistanceM!.toStringAsFixed(0)} m';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.shelterItemBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colors.shelterAccent, width: 1.5),
        ),
        child: Row(
          children: [
            Image.asset(_iconPath(shelter.type), width: 34, height: 34),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    shelter.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${shelter.currentOccupancy}/${shelter.capacity} sức chứa',
                    style: TextStyle(
                      color: colors.textTertiary,
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
                  style: TextStyle(
                    color: colors.shelterAccent,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (routeTimeMin != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    '~${routeTimeMin!.round()} phút',
                    style: TextStyle(
                      color: colors.textTertiary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
