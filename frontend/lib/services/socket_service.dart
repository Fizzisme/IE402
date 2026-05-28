import 'dart:async';
// ignore: library_prefixes
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/constants/api_config.dart';

class DangerZoneAlert {
  final String zoneId;
  final String zoneName;
  final int dangerLevel;
  final String eventType;
  final String message;

  DangerZoneAlert.fromJson(Map<String, dynamic> json)
      : zoneId = json['zoneId']?.toString() ?? '',
        zoneName = json['zoneName']?.toString() ?? 'Vùng nguy hiểm',
        dangerLevel = (json['dangerLevel'] as num?)?.toInt() ?? 1,
        eventType = json['eventType']?.toString() ?? '',
        message = json['message']?.toString() ?? 'Cảnh báo vùng nguy hiểm!';
}

class SocketService {
  IO.Socket? _socket;
  final _emergencyController = StreamController<bool>.broadcast();
  final _dangerZoneAlertController =
      StreamController<DangerZoneAlert>.broadcast();

  Stream<bool> get onEmergencyChange => _emergencyController.stream;
  Stream<DangerZoneAlert> get onDangerZoneAlert =>
      _dangerZoneAlertController.stream;

  void connect() {
    _socket = IO.io(ApiConfig.socketUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'reconnection': true,
      'reconnectionDelay': 5000,
      'reconnectionAttempts': 3,
    })
      ..on('air_raid_alert', (_) => _emergencyController.add(true))
      ..on('safe_alert', (_) => _emergencyController.add(false))
      ..on('entered_danger_zone', (_) => _emergencyController.add(true))
      ..on('exited_danger_zone', (_) => _emergencyController.add(false))
      ..on('danger_zone_alert', (data) {
        try {
          _dangerZoneAlertController.add(
            DangerZoneAlert.fromJson(Map<String, dynamic>.from(data as Map)),
          );
        } catch (_) {}
      })
      ..connect();
  }

  void updateLocation(double lat, double lng) {
    _socket?.emit('register_location', {'lat': lat, 'lng': lng});
  }

  void dispose() {
    _socket?.dispose();
    _emergencyController.close();
    _dangerZoneAlertController.close();
  }
}
