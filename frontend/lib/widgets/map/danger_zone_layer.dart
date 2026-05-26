import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/theme/app_colors.dart';
import '../../models/danger_zone.dart';

class DangerZoneLayer {
  DangerZoneLayer._();

  static List<Widget> build(List<DangerZone> zones) {
    final polygons = zones.expand((zone) {
      final color = zone.isCluster ? AppColors.dangerCluster : AppColors.danger;
      final borderColor =
          zone.isCluster ? AppColors.dangerClusterBorder : AppColors.danger;

      return zone.polygons
          .where((points) => points.length >= 3)
          .map((points) => Polygon(
                points: points,
                color: color.withOpacity(zone.isCluster ? 0.35 : 0.2),
                borderColor: borderColor,
                borderStrokeWidth: zone.isCluster ? 3 : 2,
              ));
    }).toList();

    final circles = zones
        .where((zone) => !zone.hasPolygon && zone.hasCircle)
        .map((zone) {
      final color = zone.isCluster ? AppColors.dangerCluster : AppColors.danger;
      final borderColor =
          zone.isCluster ? AppColors.dangerClusterBorder : AppColors.danger;

      return CircleMarker(
        point: LatLng(zone.lat, zone.lng),
        radius: zone.radius,
        useRadiusInMeter: true,
        color: color.withOpacity(zone.isCluster ? 0.35 : 0.2),
        borderColor: borderColor,
        borderStrokeWidth: zone.isCluster ? 3 : 2,
      );
    }).toList();

    return [
      if (polygons.isNotEmpty) PolygonLayer(polygons: polygons),
      if (circles.isNotEmpty) CircleLayer(circles: circles),
    ];
  }
}
