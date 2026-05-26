import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

class MapControls extends StatelessWidget {
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final VoidCallback onLocate;
  final VoidCallback onToggleMapTheme;
  final bool isDarkMap;

  const MapControls({
    super.key,
    required this.onZoomIn,
    required this.onZoomOut,
    required this.onLocate,
    required this.onToggleMapTheme,
    required this.isDarkMap,
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
        const SizedBox(height: 8),
        GestureDetector(
          onTap: onToggleMapTheme,
          child: Tooltip(
            message: isDarkMap ? 'Đổi sang bản đồ sáng' : 'Đổi sang bản đồ tối',
            child: _button(isDarkMap ? Icons.light_mode : Icons.dark_mode),
          ),
        ),
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