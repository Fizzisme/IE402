import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

class LocationService {
  static const LocationSettings _locationSettings = LocationSettings(
    accuracy: LocationAccuracy.high,
    distanceFilter: 5,
  );

  Future<bool> _ensureLocationPermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<LatLng?> getCurrentPosition() async {
    try {
      final hasPermission = await _ensureLocationPermission();
      if (!hasPermission) return null;

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: _locationSettings, // ✅ thêm dấu gạch dưới
      );

      return LatLng(pos.latitude, pos.longitude);
    } catch (e) { // ✅ thêm tên biến e
      return null;
    }
  }

  Stream<LatLng> getPositionStream() async* {
    final hasPermission = await _ensureLocationPermission();
    if (!hasPermission) return;

    yield* Geolocator.getPositionStream(
      locationSettings: _locationSettings,
    ).map((pos) => LatLng(pos.latitude, pos.longitude));
  }
}