import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

class LegendItem extends StatelessWidget {
  final String label;
  final Color color;
  final bool isActive;

  const LegendItem({
    super.key,
    required this.label,
    required this.color,
    required this.isActive,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.cardDark.withOpacity(0.9),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isActive ? AppColors.userMarker : AppColors.borderGray,
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.circle, color: color, size: 12),
          const SizedBox(width: 8),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
