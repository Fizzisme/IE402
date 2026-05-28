import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../app.dart';
import '../core/theme/app_colors.dart';
import '../models/shelter.dart';
import '../models/danger_zone.dart';
import '../models/route_result.dart';
import '../services/shelter_service.dart';
import '../services/danger_zone_service.dart';
import '../services/location_service.dart';
import '../services/route_service.dart';
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

class MapPage extends StatefulWidget {
  const MapPage({super.key});

  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> {
  static const String _lightTileUrl =
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  static const String _darkTileUrl =
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  final MapController _mapController = MapController();
  final _shelterService = ShelterService();
  final _dangerZoneService = DangerZoneService();
  final _locationService = LocationService();
  final _routeService = RouteService();
  final _socketService = SocketService();

  LatLng _userLocation = const LatLng(10.8700, 106.8031);
  List<Shelter> _shelters = [];
  List<DangerZone> _dangerZones = [];
  RouteResult? _routeResult;
  Shelter? _selectedShelter;
  LatLng? _lastRouteCalcLocation;
  bool _isLoading = true;
  bool _isEmergency = false;
  bool _isDarkMap = false;
  bool _showBottomCard = true;
  StreamSubscription<bool>? _emergencySub;
  StreamSubscription<LatLng>? _locationSub;
  StreamSubscription<MapEvent>? _mapMoveSub;
  StreamSubscription<DangerZoneAlert>? _dangerZoneAlertSub;
  Timer? _refreshTimer;
  Timer? _dangerZoneDebounce;
  CancelToken? _dangerZoneCancelToken;
  CancelToken? _shelterCancelToken;
  CancelToken? _checkDangerCancelToken;

  String get _tileUrlTemplate => _isDarkMap ? _darkTileUrl : _lightTileUrl;

  @override
  void initState() {
    super.initState();
    _socketService.connect();
    _emergencySub = _socketService.onEmergencyChange.listen((isEmergency) {
      if (!mounted) return;
      final wasEmergency = _isEmergency;
      setState(() => _isEmergency = isEmergency);
      if (isEmergency && !wasEmergency) {
        _calculateRoute();
        _fetchDangerZones();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Cảnh báo: Bạn đang ở vùng nguy hiểm!'),
          backgroundColor: Colors.red[700],
          duration: const Duration(seconds: 6),
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
        ));
      } else if (!isEmergency && wasEmergency) {
        _fetchDangerZones();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Bạn đã ra khỏi vùng nguy hiểm.'),
          backgroundColor: Colors.green[700],
          duration: const Duration(seconds: 4),
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
        ));
      }
    });
    _dangerZoneAlertSub = _socketService.onDangerZoneAlert.listen((alert) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(alert.message),
          backgroundColor: Colors.red[700],
          duration: const Duration(seconds: 6),
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
        ),
      );
      // Cập nhật lại danger zones và route khi có zone mới
      _fetchDangerZones();
      _checkDangerLocation();
    });
  }

  Future<void> _initLocationAndData() async {
    final totalSw = Stopwatch()..start();

    // Phase 1: fetch ngay với default location, không chờ GPS
    await Future.wait([_fetchShelters(), _fetchDangerZones(), _checkDangerLocation()]);
    if (!mounted) return;
    debugPrint('[PERF] parallel fetch done: ${totalSw.elapsedMilliseconds}ms');

    _calculateRoute();
    _setupViewportFetching();
    _startLocationTracking();
    _startDataRefresh();
    setState(() => _isLoading = false);
    debugPrint('[PERF] app visible: ${totalSw.elapsedMilliseconds}ms');

    // Phase 2: GPS đến sau — update map + refetch danger + route
    await _determinePosition();
    debugPrint('[PERF] gps ready: ${totalSw.elapsedMilliseconds}ms');
    if (!mounted) return;
    // _mapController.move trong _determinePosition tự trigger viewport fetch (shelters + danger zones)
    _checkDangerLocation();
    _calculateRoute();
  }

  Future<void> _determinePosition() async {
    final pos = await _locationService.getCurrentPosition();
    if (pos != null && mounted) {
      setState(() => _userLocation = pos);
      _mapController.move(pos, 15.0);
      _socketService.updateLocation(pos.latitude, pos.longitude);
    }
  }

  void _startLocationTracking() {
    _locationSub?.cancel();
    _locationSub = _locationService.getPositionStream().listen(
      (pos) {
        if (!mounted) return;
        setState(() => _userLocation = pos);
        _maybeRecalculateRoute(pos);
        _socketService.updateLocation(pos.latitude, pos.longitude);
      },
      onError: (error) => debugPrint('Location stream error: $error'),
    );
  }

  void _maybeRecalculateRoute(LatLng newPos) {
    if (_lastRouteCalcLocation == null) return;
    final moved = const Distance().as(LengthUnit.Meter, _lastRouteCalcLocation!, newPos);
    if (moved > 50) _calculateRoute();
  }

  void _setupViewportFetching() {
    _mapMoveSub?.cancel();
    _mapMoveSub = _mapController.mapEventStream
        .where((e) => e is MapEventMoveEnd)
        .listen((_) {
          _dangerZoneDebounce?.cancel();
          _dangerZoneDebounce = Timer(
            const Duration(milliseconds: 600),
            () {
              _fetchDangerZones();
              _fetchShelters();
            },
          );
        });
  }

  void _startDataRefresh() {
    _refreshTimer?.cancel();

    _refreshTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) async {
        if (!mounted) return;

        await Future.wait([
          _fetchShelters(),
          _checkDangerLocation(),
        ]);
      },
    );
  }

  Future<void> _fetchShelters() async {
    final zoom = _mapController.camera.zoom;

    _shelterCancelToken?.cancel('viewport changed');
    _shelterCancelToken = CancelToken();

    try {
      final sw = Stopwatch()..start();
      final result = await _shelterService.fetchNearest(
        lat: _userLocation.latitude,
        lng: _userLocation.longitude,
        limit: _limitForShelters(zoom),
        cancelToken: _shelterCancelToken,
      );
      debugPrint('[PERF] fetchShelters: ${sw.elapsedMilliseconds}ms (${result.length} items)');
      if (mounted) {
        result.sort((a, b) => a.distanceM.compareTo(b.distanceM));
        setState(() => _shelters = result);
      }
    } on DioException catch (e) {
      if (e.type != DioExceptionType.cancel) debugPrint('Shelter Error: $e');
    } catch (e) {
      debugPrint('Shelter Error: $e');
    }
  }

  static int _limitForShelters(double zoom) {
    if (zoom >= 13) return 20;
    if (zoom >= 10) return 10;
    if (zoom >= 5)  return 5;
    return 3;
  }

  Future<void> _fetchDangerZones() async {
    final zoom = _mapController.camera.zoom;
    final limit = _limitForZoom(zoom);

    if (limit == 0) {
      if (mounted) setState(() => _dangerZones = []);
      return;
    }

    _dangerZoneCancelToken?.cancel('viewport changed');
    _dangerZoneCancelToken = CancelToken();

    try {
      final sw = Stopwatch()..start();
      final bounds = _mapController.camera.visibleBounds;
      final result = await _dangerZoneService.fetchByBounds(
        minLat: bounds.south,
        minLng: bounds.west,
        maxLat: bounds.north,
        maxLng: bounds.east,
        limit: limit,
        cancelToken: _dangerZoneCancelToken,
      );
      debugPrint('[PERF] fetchDangerZones: ${sw.elapsedMilliseconds}ms (${result.length} items)');

      final minRadius = _minRadiusForZoom(zoom);
      final visible = minRadius > 0
          ? result.where((z) => z.hasPolygon || z.radius >= minRadius).toList()
          : result;

      if (mounted) setState(() => _dangerZones = visible);
    } on DioException catch (e) {
      if (e.type != DioExceptionType.cancel) debugPrint('Zone Error: $e');
    } catch (e) {
      debugPrint('Zone Error: $e');
    }
  }

  static int _limitForZoom(double zoom) {
    if (zoom >= 13) return 50;
    if (zoom >= 11) return 25;
    if (zoom >= 8)  return 10;
    if (zoom >= 5)  return 5;
    return 0;
  }

  static double _minRadiusForZoom(double zoom) {
    if (zoom >= 13) return 0;
    if (zoom >= 11) return 100;
    if (zoom >= 8)  return 1000;
    if (zoom >= 5)  return 5000;
    return double.infinity;
  }

  Future<void> _checkDangerLocation() async {
    _checkDangerCancelToken?.cancel('new check');
    _checkDangerCancelToken = CancelToken();
    try {
      final sw = Stopwatch()..start();
      final isDanger = await _dangerZoneService.checkLocation(
        lat: _userLocation.latitude,
        lng: _userLocation.longitude,
        cancelToken: _checkDangerCancelToken,
      );
      debugPrint('[PERF] checkDangerLocation: ${sw.elapsedMilliseconds}ms');
      if (!mounted) return;
      final wasEmergency = _isEmergency;
      setState(() => _isEmergency = isDanger);
      if (isDanger && !wasEmergency) {
        _calculateRoute();
      }
    } on DioException catch (e) {
      if (e.type != DioExceptionType.cancel) debugPrint('Check danger error: $e');
    } catch (e) {
      debugPrint('Check danger error: $e');
    }
  }

  void _selectShelter(Shelter shelter) {
    setState(() {
      _selectedShelter = shelter;
      _routeResult = null;
    });
    _calculateRoute();
  }

  Future<void> _calculateRoute() async {
    _lastRouteCalcLocation = _userLocation;
    try {
      final sw = Stopwatch()..start();
      final result = await _routeService.calculate(
        startLat: _userLocation.latitude,
        startLng: _userLocation.longitude,
        shelterId: _selectedShelter?.id,
      );
      debugPrint('[PERF] calculateRoute: ${sw.elapsedMilliseconds}ms (${result.segments.length} segments, ${result.totalDistanceM}m)');
      if (!mounted) return;
      Shelter? matched;
      if (result.shelterId != null) {
        for (final s in _shelters) {
          if (s.id == result.shelterId) { matched = s; break; }
        }
      }
      setState(() {
        _routeResult = result;
        _selectedShelter = matched ?? (_shelters.isNotEmpty ? _shelters.first : null);
      });
    } catch (e) {
      debugPrint('Route Error: $e');
    }
  }

  @override
  void dispose() {
    _mapMoveSub?.cancel();
    _dangerZoneDebounce?.cancel();
    _dangerZoneCancelToken?.cancel();
    _shelterCancelToken?.cancel();
    _checkDangerCancelToken?.cancel();
    _emergencySub?.cancel();
    _dangerZoneAlertSub?.cancel();
    _locationSub?.cancel();
    _refreshTimer?.cancel();
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
                onMapReady: _initLocationAndData,
              ),
              children: [
                TileLayer(
                  key: ValueKey(_isDarkMap ? 'dark-map' : 'light-map'),
                  urlTemplate: _tileUrlTemplate,
                  subdomains: const ['a', 'b', 'c', 'd'],
                  userAgentPackageName: 'com.example.shelter',
                ),
                if (_routeResult != null && _routeResult!.hasRoute)
                  RoutePolyline.build(_routeResult!.segments),
                ...DangerZoneLayer.build(_dangerZones),
                MarkerLayer(
                  markers: [
                    UserMarker.build(_userLocation),
                    ..._shelters.map(ShelterMarker.build),
                  ],
                ),
              ],
            ),
            Positioned(
              top: 15,
              left: 20,
              right: 20,
              child:
                  _isEmergency ? const EmergencyHeader() : const NormalHeader(),
            ),
            if (!_isEmergency)
              const Positioned(
                top: 70,
                left: 20,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    LegendItem(
                      label: 'Hầm trú ẩn',
                      color: AppColors.shelterGreen,
                      isActive: true,
                    ),
                    SizedBox(height: 8),
                    LegendItem(
                      label: 'Vùng nguy hiểm',
                      color: AppColors.danger,
                      isActive: false,
                    ),
                    SizedBox(height: 8),
                    LegendItem(
                      label: 'Cluster hủy diệt',
                      color: AppColors.dangerCluster,
                      isActive: false,
                    ),
                  ],
                ),
              ),
            Positioned(
              top: 70,
              right: 20,
              child: MapControls(
                onZoomIn: () => _mapController.move(
                  _mapController.camera.center,
                  _mapController.camera.zoom + 1,
                ),
                onZoomOut: () => _mapController.move(
                  _mapController.camera.center,
                  _mapController.camera.zoom - 1,
                ),
                onLocate: () => _mapController.move(_userLocation, 15),
                isDarkMap: _isDarkMap,
                onToggleMapTheme: () {
                  setState(() => _isDarkMap = !_isDarkMap);
                  ShelterApp.of(context).toggleTheme();
                },
              ),
            ),
            if (_showBottomCard)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: NormalBottomCard(
                  shelters: _shelters,
                  isLoading: _isLoading,
                  userLocation: _userLocation,
                  routeResult: _routeResult,
                  selectedShelter: _selectedShelter,
                  onShelterTap: _selectShelter,
                  onClose: () => setState(() => _showBottomCard = false),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
