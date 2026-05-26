import '../models/danger_zone.dart';
import 'api_client.dart';

class DangerZoneService {
  Future<List<DangerZone>> fetchAll({
    String bbox = '106.6,10.7,107.0,11.0',
    int limit = 10,
  }) async {
    final res = await ApiClient.instance.get(
      '/danger-zones',
      queryParameters: {
        'bbox': bbox,
        'limit': limit,
      },
    );
    final list = _extractList(res.data);
    return list
        .map((e) => DangerZone.fromJson(e as Map<String, dynamic>))
        .where((zone) => zone.hasPolygon || zone.hasCircle)
        .toList();
  }

  List<dynamic> _extractList(dynamic data) {
    if (data is List) return data;

    if (data is Map<String, dynamic>) {
      if (data['type'] == 'FeatureCollection') {
        return (data['features'] as List?) ?? [];
      }
      return (data['data'] as List?) ?? [];
    }

    return [];
  }

  Future<bool> checkLocation({
    required double lat,
    required double lng,
  }) async {
    final res = await ApiClient.instance.get(
      '/danger-zones/check',
      queryParameters: {'lat': lat, 'lng': lng},
    );
    if (res.statusCode == 200) {
      final data = res.data['data'];
      if (data != null) return data['isDanger'] ?? data['inside'] ?? false;
    }
    return false;
  }
}
