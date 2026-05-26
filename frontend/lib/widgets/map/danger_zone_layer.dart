import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/theme/app_colors.dart';
import '../../models/danger_zone.dart';

class DangerZoneLayer {
  DangerZoneLayer._();

  static CircleLayer build(List<DangerZone> zones) {
    return CircleLayer(
      circles: zones.map((z) {
        return CircleMarker(
          point: LatLng(z.lat, z.lng),
          radius: z.radius == 0 ? 500 : z.radius,
          useRadiusInMeter: true,
          color: AppColors.dangerFill.withOpacity(0.2),
          borderColor: AppColors.danger,
          borderStrokeWidth: 2,
        );
      }).toList(),
    );
  }
}
