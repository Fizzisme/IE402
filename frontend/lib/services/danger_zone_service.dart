import '../models/danger_zone.dart';
import 'api_client.dart';

class DangerZoneService {
  Future<List<DangerZone>> fetchAll() async {
    final res = await ApiClient.instance.get('/danger-zones');
    final list = (res.data['data'] as List?) ?? [];
    return list
        .map((e) => DangerZone.fromJson(e as Map<String, dynamic>))
        .toList();
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
      if (data != null) return data['isDanger'] ?? false;
    }
    return false;
  }
}
