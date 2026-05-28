import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../models/route_result.dart';

class EmergencyBottomCard extends StatelessWidget {
  final RouteResult? routeResult;

  const EmergencyBottomCard({super.key, this.routeResult});

  String _formatTime(double minutes) {
    if (minutes <= 0) return '...';
    final m = minutes.floor();
    final s = ((minutes - m) * 60).round();
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  String _formatDistance(int meters) {
    if (meters <= 0) return '...';
    return meters >= 1000
        ? '${(meters / 1000).toStringAsFixed(1)} km'
        : '$meters m';
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final isLoading = routeResult == null;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
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
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'THỜI GIAN ƯỚC TÍNH',
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isLoading ? '...' : _formatDistance(routeResult!.totalDistanceM),
                      style: TextStyle(
                        color: colors.textTertiary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                Text(
                  isLoading ? '...' : _formatTime(routeResult!.estimatedTimeMin),
                  style: const TextStyle(
                    color: AppColors.warning,
                    fontSize: 28,
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
