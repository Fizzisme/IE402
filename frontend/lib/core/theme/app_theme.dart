import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get light => ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: AppColors.light.background,
        cardColor: AppColors.light.card,
        dividerColor: AppColors.light.divider,
        colorScheme: ColorScheme.light(
          primary: AppColors.light.accent,
          surface: AppColors.light.card,
        ),
      );

  static ThemeData get dark => ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppColors.dark.background,
        cardColor: AppColors.dark.card,
        dividerColor: AppColors.dark.divider,
        colorScheme: ColorScheme.dark(
          primary: AppColors.dark.accent,
          surface: AppColors.dark.card,
        ),
      );
}