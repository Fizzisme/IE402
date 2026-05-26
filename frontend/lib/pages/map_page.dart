import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../core/theme/app_colors.dart';
import '../models/shelter.dart';
import '../models/danger_zone.dart';
import '../services/shelter_service.dart';
import '../services/danger_zone_service.dart';
import '../services/location_service.dart';
import '../services/socket_service.dart';
import '../widgets/map/user_marker.dart';
import '../widgets/map/shelter_marker.dart';
import '../widgets/map/danger_zone_layer.dart';
import '../widgets/map/route_polyline.dart';
import '../widgets/map_controls.dart';
import '../widgets/legend_item.dart';
import '../widgets/header/normal_header.dart';
import '../widgets/header/emergency_header.dart';
import '../widgets/bottom_card/normal_bottom_card.dart';
import '../widgets/bottom_card/emergency_bottom_card.dart';

class MapPage extends StatefulWidget {
  const MapPage({super.key});

  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> {
  final MapController _mapController = MapController();
  final _shelterService = ShelterService();
  final _dangerZoneService = DangerZoneService();
  final _locationService = LocationService();
  final _socketService = SocketService();

  LatLng _userLocation = const LatLng(10.8700, 106.8031);
  List<Shelter> _shelters = [];
  List<DangerZone> _dangerZones = [];
  bool _isLoading = true;
  bool _isEmergency = false;
  bool _showBottomCard = true;
  StreamSubscription<bool>? _emergencySub;

  @override
  void initState() {
    super.initState();
    _socketService.connect();
    _emergencySub = _socketService.onEmergencyChange.listen((isEmergency) {
      if (mounted) setState(() => _isEmergency = isEmergency);
    });
    _initLocationAndData();
  }

  Future<void> _initLocationAndData() async {
    await _determinePosition();
    await Future.wait([_fetchShelters(), _fetchDangerZones()]);
    await _checkDangerLocation();
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _determinePosition() async {
    final pos = await _locationService.getCurrentPosition();
    if (pos != null && mounted) {
      setState(() {
        _userLocation = pos;
        _mapController.move(pos, 15.0);
      });
    }
  }

  Future<void> _fetchShelters() async {
    try {
      final result = await _shelterService.fetchNearest(
        lat: _userLocation.latitude,
        lng: _userLocation.longitude,
      );
      if (mounted) setState(() => _shelters = result);
    } catch (e) {
      debugPrint('Shelter Error: $e');
    }
  }

  Future<void> _fetchDangerZones() async {
    try {
      final result = await _dangerZoneService.fetchAll();
      if (mounted) setState(() => _dangerZones = result);
    } catch (e) {
      debugPrint('Zone Error: $e');
    }
  }

  Future<void> _checkDangerLocation() async {
    try {
      final isDanger = await _dangerZoneService.checkLocation(
        lat: _userLocation.latitude,
        lng: _userLocation.longitude,
      );
      if (mounted) setState(() => _isEmergency = isDanger);
    } catch (e) {
      debugPrint('Check danger error: $e');
    }
  }

  @override
  void dispose() {
    _emergencySub?.cancel();
    _socketService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _userLocation,
                initialZoom: 15,
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                  subdomains: const ['a', 'b', 'c', 'd'],
                  userAgentPackageName: 'com.example.shelter',
                ),
                if (_isEmergency && _shelters.isNotEmpty)
                  RoutePolyline.build(
                    userLocation: _userLocation,
                    shelter: _shelters.first,
                  ),
                DangerZoneLayer.build(_dangerZones),
                MarkerLayer(
                  markers: [
                    UserMarker.build(_userLocation),
                    ..._shelters.map(ShelterMarker.build),
                  ],
                ),
              ],
            ),
            Positioned(
              top: 15, left: 20, right: 20,
              child: _isEmergency ? const EmergencyHeader() : const NormalHeader(),
            ),
            if (!_isEmergency)
              const Positioned(
                top: 70, left: 20,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    LegendItem(label: 'Hầm trú ẩn', color: Colors.green, isActive: true),
                    SizedBox(height: 8),
                    LegendItem(label: 'Vùng nguy hiểm', color: Colors.red, isActive: false),
                  ],
                ),
              ),
            Positioned(
              top: 70, right: 20,
              child: MapControls(
                onZoomIn: () => _mapController.move(
                  _mapController.camera.center, _mapController.camera.zoom + 1),
                onZoomOut: () => _mapController.move(
                  _mapController.camera.center, _mapController.camera.zoom - 1),
                onLocate: () => _mapController.move(_userLocation, 15),
              ),
            ),
            if (_showBottomCard)
                Positioned(
                  bottom: 0, left: 0, right: 0,
                  child: _isEmergency
                      ? const EmergencyBottomCard()
                      : NormalBottomCard(
                          shelters: _shelters,
                          isLoading: _isLoading,
                          userLocation: _userLocation,
                          onClose: () => setState(() => _showBottomCard = false),
                        ),
                ),
          ],
        ),
      ),
    );
  }
}
