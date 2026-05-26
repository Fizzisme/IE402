import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/theme/app_colors.dart';

class UserMarker {
  UserMarker._();

  static Marker build(LatLng point) {
    return Marker(
      point: point,
      width: 20,
      height: 20,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.userMarker,
          shape: BoxShape.circle,
          border: Border.all(
            color: AppColors.userMarkerBorder.withOpacity(0.5),
            width: 4,
          ),
        ),
      ),
    );
  }
}
