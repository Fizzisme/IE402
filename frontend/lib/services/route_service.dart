import '../models/route_result.dart';
import 'api_client.dart';

class RouteService {
  Future<RouteResult> calculate({
    required double startLat,
    required double startLng,
    String? shelterId,
  }) async {
    final res = await ApiClient.instance.post(
      '/route/calculate',
      data: {
        'start_lat': startLat,
        'start_lng': startLng,
        'shelter_id': shelterId,
      },
    );
    return RouteResult.fromJson(res.data['data'] as Map<String, dynamic>);
  }
}
