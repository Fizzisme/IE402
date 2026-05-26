class DangerZone {
  final String id;
  final double lat;
  final double lng;
  final double radius;

  DangerZone({
    required this.id,
    required this.lat,
    required this.lng,
    required this.radius,
  });

  factory DangerZone.fromJson(Map<String, dynamic> json) {
    return DangerZone(
      id: json['id']?.toString() ?? '',
      lat: double.tryParse((json['lat'] ?? 0).toString()) ?? 0,
      lng: double.tryParse((json['lng'] ?? 0).toString()) ?? 0,
      radius: double.tryParse((json['radius'] ?? 0).toString()) ?? 0,
    );
  }
}
