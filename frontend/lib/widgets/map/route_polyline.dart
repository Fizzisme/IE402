import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/theme/app_colors.dart';
import '../../models/shelter.dart';

class RoutePolyline {
  RoutePolyline._();

  static PolylineLayer build({
    required LatLng userLocation,
    required Shelter shelter,
  }) {
    return PolylineLayer(
      polylines: [
        Polyline(
          points: [userLocation, LatLng(shelter.lat, shelter.lng)],
          color: AppColors.userMarker,
          strokeWidth: 4,
        ),
      ],
    );
  }
}
