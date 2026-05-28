import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/theme/app_colors.dart';

class RoutePolyline {
  RoutePolyline._();

  static PolylineLayer build(List<List<LatLng>> segments) {
    return PolylineLayer(
      polylines: segments
          .map((seg) => Polyline(
                points: seg,
                color: AppColors.userMarker,
                strokeWidth: 4,
                borderColor: AppColors.userMarkerBorder,
                borderStrokeWidth: 1.5,
              ))
          .toList(),
    );
  }
}
