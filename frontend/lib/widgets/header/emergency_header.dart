import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class EmergencyHeader extends StatelessWidget {
  const EmergencyHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: AppColors.emergencyRed,
        borderRadius: BorderRadius.circular(10),
      ),
      child: const Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.warning_amber_rounded,
                color: AppColors.textPrimary,
                size: 28,
              ),
              SizedBox(width: 10),
              Text(
                'CẢNH BÁO KHÔNG KÍCH!',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: 5),
          Text(
            'THÔNG BÁO TỰ ĐỘNG • KHU VỰC: SECTOR-7',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
