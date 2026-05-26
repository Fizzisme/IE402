import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/theme/app_colors.dart';
import '../../models/shelter.dart';

class ShelterMarker {
  ShelterMarker._();

  static String _iconPath(String? type) {
      switch (type) {
        case 'bunker':           return 'lib/core/icons/bunker.png';
        case 'community_center': return 'lib/core/icons/community_center.png';
        case 'hospital':         return 'lib/core/icons/hospital.png';
        case 'school':           return 'lib/core/icons/school.png';
        default:                 return 'lib/core/icons/community_center.png';
      }
    }



  static Marker build(Shelter shelter) {
    return Marker(
      point: LatLng(shelter.lat, shelter.lng),
      width: 42,
      height: 42,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.shelterGreen,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.safeAccent),
        ),
        child: Center(
          child: Image.asset(
                             _iconPath(shelter.type),
                             width: 24,
                             height: 24,
                           ),
        ),
      ),
    );
  }
}
