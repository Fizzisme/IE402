import 'package:flutter/material.dart';
import 'core/routes/app_routes.dart';
import 'core/theme/app_theme.dart';

class ShelterApp extends StatefulWidget {
  const ShelterApp({super.key});

  static _ShelterAppState of(BuildContext context) =>
      context.findAncestorStateOfType<_ShelterAppState>()!;

  @override
  State<ShelterApp> createState() => _ShelterAppState();
}

class _ShelterAppState extends State<ShelterApp> {
  ThemeMode _themeMode = ThemeMode.light; // mặc định light

  void toggleTheme() {
    setState(() {
      _themeMode =
          _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    });
  }

  bool get isDark => _themeMode == ThemeMode.dark;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Shelter',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      initialRoute: AppRoutes.map,
      routes: appRoutes,
    );
  }
}