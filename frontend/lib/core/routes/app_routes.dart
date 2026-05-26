import 'package:flutter/material.dart';
import '../../pages/map_page.dart';

class AppRoutes {
  AppRoutes._();
  static const String map = '/';
}

final Map<String, WidgetBuilder> appRoutes = {
  AppRoutes.map: (_) => const MapPage(),
};
