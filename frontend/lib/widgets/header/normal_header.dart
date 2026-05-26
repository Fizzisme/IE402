import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class NormalHeader extends StatelessWidget {
  const NormalHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        RichText(
          text: const TextSpan(
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            children: [
              TextSpan(
                text: 'SAFE',
                style: TextStyle(color: AppColors.userMarker),
              ),
              TextSpan(
                text: 'ROUTE',
                style: TextStyle(color: AppColors.textPrimary),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.safeTagBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.safe),
          ),
          child: const Row(
            children: [
              Icon(Icons.circle, color: AppColors.safeAccent, size: 10),
              SizedBox(width: 6),
              Text(
                'AN TOÀN',
                style: TextStyle(
                  color: AppColors.safeAccent,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
