import 'package:flutter/material.dart';

class AppColorScheme {
  final Color background;
  final Color card;
  final Color accent;
  final Color divider;
  final Color dragHandle;
  final Color iconBoxBg;
  final Color bottomSheetBg;
  final Color shelterItemBg;
  final Color shelterItemBorder;
  final Color shelterAccent;
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color shelterGreen;
  final Color safeTagBg;
  final Color emergencyRed;
  final Color cardColor;
  final Color borderGray;
  final Color safe;

  const AppColorScheme({
    required this.background,
    required this.card,
    required this.accent,
    required this.divider,
    required this.dragHandle,
    required this.iconBoxBg,
    required this.bottomSheetBg,
    required this.shelterItemBg,
    required this.shelterItemBorder,
    required this.shelterAccent,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.shelterGreen,
    required this.safeTagBg,
    required this.emergencyRed,
    required this.cardColor,
    required this.borderGray,
    required this.safe,
  });
}

class AppColors {
  AppColors._();

  // ── Light ──────────────────────────────────────────
  static const AppColorScheme light = AppColorScheme(
    background:        Color(0xFFF5F7FA),
    card:              Color(0xFFFFFFFF),
    accent:            Color(0xFF047857),
    divider:           Color(0xFFE5E7EB),
    dragHandle:        Color(0xFFD1D5DB),
    iconBoxBg:         Color(0xFFD1FAE5),
    bottomSheetBg:     Color(0xFFFFFFFF),
    shelterItemBg:     Color(0xFFECFDF5),
    shelterItemBorder: Color(0xFFBBF7D0),
    shelterAccent:     Color(0xFF047857),
    textPrimary:       Color(0xFF111827),
    textSecondary:     Color(0xFF374151),
    textTertiary:      Color(0xFF6B7280),
    shelterGreen:      Color(0xFF047857),
    safeTagBg:         Color(0xFFD1FAE5),
    emergencyRed:      Color(0xFF991B1B),
    cardColor:         Color(0xFFFFFFFF),
    borderGray:        Color(0xFFD1D5DB),
    safe:              Color(0xFF047857),
  );

  // ── Dark ───────────────────────────────────────────
  static const AppColorScheme dark = AppColorScheme(
    background:        Color(0xFF0A1118),
    card:              Color(0xFF111827),
    accent:            Color(0xFF67F0C3),
    divider:           Color(0xFF2D3147),
    dragHandle:        Color(0xFF444444),
    iconBoxBg:         Color(0xFF1A2E26),
    bottomSheetBg:     Color(0xFF1E2130),
    shelterItemBg:     Color(0xFF203647),
    shelterItemBorder: Color(0xFF31506A),
    shelterAccent:     Color(0xFF67F0C3),
    textPrimary:       Colors.white,
    textSecondary:     Colors.white70,
    textTertiary:      Colors.white60,
    shelterGreen:      Color(0xFF047857),
    safeTagBg:         Color(0xFF064E3B),
    emergencyRed:      Color(0xFF991B1B),
    cardColor:         Color(0xFF111827),
    borderGray:        Color(0xFF374151),
    safe:              Colors.green,
  );

  // ── Helper lấy scheme theo context ─────────────────
  static AppColorScheme of(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }

  // ── Static alias giữ tương thích với code cũ ───────
  // (trỏ về dark vì code cũ toàn dùng màu dark)
  static const Color backgroundDark    = Color(0xFF0A1118);
  static const Color cardDark          = Color(0xFF111827);
  static const Color borderGray        = Color(0xFF374151);
  static const Color shelterGreen      = Color(0xFF047857);
  static const Color safeTagBg         = Color(0xFF064E3B);
  static const Color emergencyRed      = Color(0xFF991B1B);
  static const Color shelterItemBg     = Color(0xFF203647);
  static const Color shelterItemBorder = Color(0xFF31506A);
  static const Color shelterAccent     = Color(0xFF67F0C3);
  static const Color bottomSheetBg     = Color(0xFF1E2130);
  static const Color iconBoxBg         = Color(0xFF1A2E26);
  static const Color divider           = Color(0xFF2D3147);
  static const Color dragHandle        = Color(0xFF444444);
  static const Color textPrimary       = Colors.white;
  static const Color textSecondary     = Colors.white70;
  static const Color textTertiary      = Colors.white60;
  static const Color safe              = Colors.green;

  // ── Màu không đổi theo theme ───────────────────────
  static const Color userMarker        = Colors.orange;
  static const Color userMarkerAccent  = Colors.orangeAccent;
  static const Color userMarkerBorder  = Colors.orangeAccent;
  static const Color dangerFill        = Colors.red;
  static const Color safeAccent        = Colors.greenAccent;
  static const Color danger            = Colors.red;
  static const Color warning           = Colors.redAccent;
  static const Color textOnAccent      = Colors.black;
  static const Color dangerCluster       = Color(0xFFFF6600);
  static const Color dangerClusterBorder = Color(0xFFCC4400);
}