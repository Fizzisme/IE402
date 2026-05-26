class Shelter {
  final String id;
  final String name;
  final double lat;
  final double lng;
  final int capacity;
  final int currentOccupancy;
  final double distanceM;
  final String? type;

  Shelter({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    required this.capacity,
    required this.currentOccupancy,
    required this.distanceM,
    this.type,
  });

  factory Shelter.fromJson(Map<String, dynamic> json) {
    return Shelter(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      lat: double.tryParse((json['lat'] ?? 0).toString()) ?? 0,
      lng: double.tryParse((json['lng'] ?? 0).toString()) ?? 0,
      capacity: int.tryParse((json['capacity'] ?? 0).toString()) ?? 0,
      currentOccupancy:
          int.tryParse((json['current_occupancy'] ?? 0).toString()) ?? 0,
      distanceM: double.tryParse((json['distance_m'] ?? 0).toString()) ?? 0,
      type: json['type'].toString(),
    );
  }
}
