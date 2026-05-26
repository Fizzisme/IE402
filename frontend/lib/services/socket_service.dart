import 'dart:async';
// ignore: library_prefixes
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/constants/api_config.dart';

class SocketService {
  late IO.Socket _socket;
  final _emergencyController = StreamController<bool>.broadcast();

  Stream<bool> get onEmergencyChange => _emergencyController.stream;

  void connect() {
    _socket = IO.io(ApiConfig.socketUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
    });
    _socket.connect();

    _socket.onConnect((_) {});
    _socket.on('air_raid_alert', (_) => _emergencyController.add(true));
    _socket.on('safe_alert', (_) => _emergencyController.add(false));
    _socket.onDisconnect((_) {});
  }

  void dispose() {
    _socket.dispose();
    _emergencyController.close();
  }
}
