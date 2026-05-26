import 'dart:typed_data';

import 'package:latlong2/latlong.dart';

class DangerZone {
  final String id;
  final String name;
  final int dangerLevel;
  final String eventType;
  final String description;
  final String dataSource;
  final double lat;
  final double lng;
  final double radius;
  final List<List<LatLng>>? _polygons;

  DangerZone({
    required this.id,
    required this.name,
    required this.dangerLevel,
    required this.eventType,
    required this.description,
    required this.dataSource,
    required this.lat,
    required this.lng,
    required this.radius,
    List<List<LatLng>>? polygons,
  }) : _polygons = polygons;

  List<List<LatLng>> get polygons {
    return _polygons ?? const <List<LatLng>>[];
  }

  bool get isCluster {
    return dataSource == 'acled_cluster' || name.startsWith('[CLUSTER]');
  }

  bool get hasPolygon => polygons.any((points) => points.length >= 3);

  bool get hasCircle => lat != 0 && lng != 0 && radius > 0;

  factory DangerZone.fromJson(Map<String, dynamic> json) {
    final properties = _propertiesOf(json);
    final geometry = json['geojson'] ?? json['geometry'];
    final geomHex = json['geom']?.toString();

    final polygons = <List<LatLng>>[
      ..._parseGeoJsonGeometry(geometry),
      if (geomHex != null) ..._parseWkbGeometry(geomHex),
    ];

    return DangerZone(
      id: properties['id']?.toString() ?? '',
      name: properties['name']?.toString() ?? '',
      dangerLevel:
          int.tryParse((properties['danger_level'] ?? 1).toString()) ?? 1,
      eventType: properties['event_type']?.toString() ?? '',
      description: properties['description']?.toString() ?? '',
      dataSource: properties['data_source']?.toString() ?? '',
      lat: double.tryParse((properties['lat'] ?? 0).toString()) ?? 0,
      lng: double.tryParse((properties['lng'] ?? 0).toString()) ?? 0,
      radius: double.tryParse((properties['radius'] ?? 0).toString()) ?? 0,
      polygons: polygons,
    );
  }

  static Map<String, dynamic> _propertiesOf(Map<String, dynamic> json) {
    final properties = json['properties'];
    if (properties is Map<String, dynamic>) {
      return {
        ...json,
        ...properties,
      };
    }
    return json;
  }

  static List<List<LatLng>> _parseGeoJsonGeometry(dynamic geometry) {
    if (geometry is! Map<String, dynamic>) return [];

    final type = geometry['type']?.toString();
    final coordinates = geometry['coordinates'];

    if (type == 'Polygon' && coordinates is List && coordinates.isNotEmpty) {
      return [_parseRing(coordinates.first)];
    }

    if (type == 'MultiPolygon' && coordinates is List) {
      return coordinates
          .whereType<List>()
          .where((polygon) => polygon.isNotEmpty)
          .map((polygon) => _parseRing(polygon.first))
          .where((ring) => ring.length >= 3)
          .toList();
    }

    return [];
  }

  static List<LatLng> _parseRing(dynamic ring) {
    if (ring is! List) return [];

    return ring
        .whereType<List>()
        .where((point) => point.length >= 2)
        .map((point) {
          final lng = double.tryParse(point[0].toString()) ?? 0;
          final lat = double.tryParse(point[1].toString()) ?? 0;
          return LatLng(lat, lng);
        })
        .where((point) => point.latitude != 0 || point.longitude != 0)
        .toList();
  }

  static List<List<LatLng>> _parseWkbGeometry(String hex) {
    try {
      return _WkbReader(hex).readGeometry();
    } catch (_) {
      return [];
    }
  }
}

class _WkbReader {
  final ByteData _data;
  int _offset = 0;

  _WkbReader(String hex) : _data = ByteData.sublistView(_hexToBytes(hex));

  List<List<LatLng>> readGeometry() {
    final endian = _readEndian();
    final rawType = _readUint32(endian);
    final hasSrid = (rawType & 0x20000000) != 0;
    final hasZ = (rawType & 0x80000000) != 0;
    final hasM = (rawType & 0x40000000) != 0;
    final typeWithFlagsRemoved = rawType & 0x0fffffff;
    final type = typeWithFlagsRemoved > 1000
        ? typeWithFlagsRemoved % 1000
        : typeWithFlagsRemoved;

    if (hasSrid) _offset += 4;

    if (type == 3) {
      final polygon = _readPolygon(endian, hasZ: hasZ, hasM: hasM);
      return polygon.isEmpty ? [] : [polygon];
    }

    if (type == 6) {
      final polygonCount = _readUint32(endian);
      final polygons = <List<LatLng>>[];
      for (var i = 0; i < polygonCount; i++) {
        polygons.addAll(readGeometry());
      }
      return polygons;
    }

    return [];
  }

  Endian _readEndian() {
    final byteOrder = _data.getUint8(_offset);
    _offset += 1;
    return byteOrder == 1 ? Endian.little : Endian.big;
  }

  int _readUint32(Endian endian) {
    final value = _data.getUint32(_offset, endian);
    _offset += 4;
    return value;
  }

  double _readDouble(Endian endian) {
    final value = _data.getFloat64(_offset, endian);
    _offset += 8;
    return value;
  }

  List<LatLng> _readPolygon(
    Endian endian, {
    required bool hasZ,
    required bool hasM,
  }) {
    final ringCount = _readUint32(endian);
    if (ringCount == 0) return [];

    final outerRing = _readRing(endian, hasZ: hasZ, hasM: hasM);

    for (var i = 1; i < ringCount; i++) {
      _readRing(endian, hasZ: hasZ, hasM: hasM);
    }

    return outerRing;
  }

  List<LatLng> _readRing(
    Endian endian, {
    required bool hasZ,
    required bool hasM,
  }) {
    final pointCount = _readUint32(endian);
    final points = <LatLng>[];

    for (var i = 0; i < pointCount; i++) {
      final lng = _readDouble(endian);
      final lat = _readDouble(endian);
      if (hasZ) _readDouble(endian);
      if (hasM) _readDouble(endian);
      points.add(LatLng(lat, lng));
    }

    return points;
  }

  static Uint8List _hexToBytes(String hex) {
    final cleanHex = hex.replaceAll(RegExp(r'\s+'), '');
    final bytes = Uint8List(cleanHex.length ~/ 2);

    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = int.parse(cleanHex.substring(i * 2, i * 2 + 2), radix: 16);
    }

    return bytes;
  }
}
