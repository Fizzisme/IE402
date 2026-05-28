import 'package:dio/dio.dart';
import '../models/danger_zone.dart';
import 'api_client.dart';

class DangerZoneService {
  Future<List<DangerZone>> fetchAll({
    String bbox = '106.6,10.7,107.0,11.0',
    int limit = 10,
    CancelToken? cancelToken,
  }) async {
    final res = await ApiClient.instance.get(
      '/danger-zones',
      queryParameters: {'bbox': bbox, 'limit': limit},
      cancelToken: cancelToken,
    );
    final list = _extractList(res.data);
    return list
        .whereType<Map>()
        .map((e) => DangerZone.fromJson(Map<String, dynamic>.from(e)))
        .where((zone) => zone.hasPolygon || zone.hasCircle)
        .toList();
  }

  Future<List<DangerZone>> fetchByBounds({
    required double minLat,
    required double minLng,
    required double maxLat,
    required double maxLng,
    int limit = 10,
    CancelToken? cancelToken,
  }) {
    return fetchAll(
      bbox: '$minLng,$minLat,$maxLng,$maxLat',
      limit: limit,
      cancelToken: cancelToken,
    );
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
    CancelToken? cancelToken,
  }) async {
    final res = await ApiClient.instance.get(
      '/danger-zones/check',
      queryParameters: {'lat': lat, 'lng': lng},
      cancelToken: cancelToken,
    );
    if (res.statusCode == 200) {
      final data = res.data['data'];
      if (data != null) return data['isDanger'] ?? data['inside'] ?? false;
    }
    return false;
  }
}