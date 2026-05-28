import 'package:latlong2/latlong.dart';

class RouteResult {
  final String? shelterId;
  final List<List<LatLng>> segments;
  final int totalDistanceM;
  final double estimatedTimeMin;
  final double totalRiskScore;

  const RouteResult({
    this.shelterId,
    required this.segments,
    required this.totalDistanceM,
    required this.estimatedTimeMin,
    required this.totalRiskScore,
  });

  bool get hasRoute => segments.isNotEmpty;

  factory RouteResult.fromJson(Map<String, dynamic> json) {
    final geoJson = json['route_geojson'] as Map<String, dynamic>?;
    final features = (geoJson?['features'] as List?) ?? [];

    final segments = <List<LatLng>>[];
    for (final feature in features) {
      final geometry =
          (feature as Map<String, dynamic>)['geometry'] as Map<String, dynamic>?;
      if (geometry?['type'] != 'LineString') continue;
      final seg = <LatLng>[];
      for (final coord in (geometry?['coordinates'] as List?) ?? []) {
        if (coord is List && coord.length >= 2) {
          seg.add(LatLng(
            (coord[1] as num).toDouble(),
            (coord[0] as num).toDouble(),
          ));
        }
      }
      if (seg.length >= 2) segments.add(seg);
    }

    return RouteResult(
      shelterId: (json['shelter'] as Map<String, dynamic>?)?['id']?.toString(),
      segments: segments,
      totalDistanceM: (json['total_distance_m'] as num?)?.toInt() ?? 0,
      estimatedTimeMin: (json['estimated_time_min'] as num?)?.toDouble() ?? 0,
      totalRiskScore: (json['total_risk_score'] as num?)?.toDouble() ?? 0,
    );
  }
}
