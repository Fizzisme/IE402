import '../models/shelter.dart';
import 'api_client.dart';

class ShelterService {
  Future<List<Shelter>> fetchNearest({
    required double lat,
    required double lng,
  }) async {
    final res = await ApiClient.instance.get(
      '/shelters/nearest',
      queryParameters: {'lat': lat, 'lng': lng},
    );
    final list = (res.data['data'] as List?) ?? [];
    return list
        .map((e) => Shelter.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
