import 'api_client.dart';

class RouteService {
  Future<void> calculate({
    required double startLat,
    required double startLng,
    required double endLat,
    required double endLng,
  }) async {
    await ApiClient.instance.post(
      '/route/calculate',
      data: {
        'start_lat': startLat,
        'start_lng': startLng,
        'end_lat': endLat,
        'end_lng': endLng,
      },
    );
  }
}
