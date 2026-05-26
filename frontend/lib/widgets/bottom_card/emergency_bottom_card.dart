import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class EmergencyBottomCard extends StatelessWidget {
  const EmergencyBottomCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              color: AppColors.emergencyRed.withOpacity(0.2),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.emergencyRed),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'THỜI GIAN ƯỚC TÍNH',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '2:55',
                  style: TextStyle(
                    color: AppColors.warning,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
