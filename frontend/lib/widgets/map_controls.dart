import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

class MapControls extends StatelessWidget {
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final VoidCallback onLocate;

  const MapControls({
    super.key,
    required this.onZoomIn,
    required this.onZoomOut,
    required this.onLocate,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GestureDetector(onTap: onZoomIn, child: _button(Icons.add)),
        const SizedBox(height: 8),
        GestureDetector(onTap: onZoomOut, child: _button(Icons.remove)),
        const SizedBox(height: 8),
        GestureDetector(onTap: onLocate, child: _button(Icons.my_location)),
      ],
    );
  }

  Widget _button(IconData icon) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppColors.cardDark.withOpacity(0.9),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.borderGray),
      ),
      child: Icon(icon, color: AppColors.textPrimary, size: 20),
    );
  }
}
