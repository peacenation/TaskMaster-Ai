import 'package:flutter/material.dart';

/// TaskMasterAi design tokens — the Dart mirror of the semantic tokens in
/// apps/web/app/globals.css. Keep the two in step: a colour changed on one
/// side should change on the other (contrast notes in docs/DESIGN_SYSTEM.md).
///
/// Brand: Espresso #35251F, Walnut #70503E, Caramel #C28B58, Ivory #F7F3EC,
/// Sage #84957A. Caramel and Sage are fills only — too light for text on
/// Ivory — so text uses the darker steps.
@immutable
class TmColors extends ThemeExtension<TmColors> {
  const TmColors({
    required this.page,
    required this.card,
    required this.sunken,
    required this.border,
    required this.borderStrong,
    required this.textPrimary,
    required this.textMuted,
    required this.textSubtle,
    required this.action,
    required this.onAction,
    required this.accent,
    required this.accentSubtle,
    required this.calm,
    required this.calmSubtle,
    required this.aiBg,
    required this.aiBadge,
    required this.aiText,
    required this.success,
    required this.danger,
    required this.dangerSubtle,
    required this.heroGradient,
  });

  final Color page;
  final Color card;
  final Color sunken;
  final Color border;
  final Color borderStrong;
  final Color textPrimary;
  final Color textMuted;
  final Color textSubtle;
  final Color action;
  final Color onAction;
  final Color accent;
  final Color accentSubtle;
  final Color calm;
  final Color calmSubtle;
  final Color aiBg;
  final Color aiBadge;
  final Color aiText;
  final Color success;
  final Color danger;
  final Color dangerSubtle;
  final List<Color> heroGradient;

  static const espresso = Color(0xFF35251F);
  static const caramel = Color(0xFFC28B58);
  static const sage = Color(0xFF84957A);

  static const light = TmColors(
    page: Color(0xFFF7F3EC),
    card: Color(0xFFFFFDFA),
    sunken: Color(0xFFF1EADF),
    border: Color(0xFFE8DFD2),
    borderStrong: Color(0xFFA8895F),
    textPrimary: espresso,
    textMuted: Color(0xFF5E4B40),
    textSubtle: Color(0xFF7A6556),
    action: Color(0xFF70503E),
    onAction: Color(0xFFF7F3EC),
    accent: caramel,
    accentSubtle: Color(0xFFF6E7D8),
    calm: sage,
    calmSubtle: Color(0xFFEAEEE5),
    aiBg: Color(0xFFF6E7D8),
    aiBadge: Color(0xFFEED5BB),
    aiText: Color(0xFF7A4A24),
    success: Color(0xFF56664D),
    danger: Color(0xFFA23B2A),
    dangerSubtle: Color(0xFFF7E7E1),
    heroGradient: [Color(0xFFF8EBDD), Color(0xFFF3DCC4), Color(0xFFECD0B4)],
  );

  static const dark = TmColors(
    page: Color(0xFF1A120E),
    card: Color(0xFF251A15),
    sunken: Color(0xFF1F1611),
    border: Color(0xFF4A392E), // visible card edges on the dark page
    borderStrong: Color(0xFF8A7256),
    textPrimary: Color(0xFFF3EBE1),
    textMuted: Color(0xFFCDBDAD),
    textSubtle: Color(0xFFA8937F),
    action: Color(0xFFD29A66),
    onAction: Color(0xFF1A120E),
    accent: caramel,
    accentSubtle: Color(0xFF33231A),
    calm: sage,
    calmSubtle: Color(0xFF232A1F),
    aiBg: Color(0xFF33231A),
    aiBadge: Color(0xFF47301F),
    aiText: Color(0xFFEDBE92),
    success: Color(0xFFA9BC9C),
    danger: Color(0xFFE07A63),
    dangerSubtle: Color(0xFF3A1F18),
    heroGradient: [Color(0xFF2C1F17), Color(0xFF392719), Color(0xFF43301F)],
  );

  @override
  TmColors copyWith() => this;

  @override
  TmColors lerp(TmColors? other, double t) => t < 0.5 ? this : (other ?? this);
}

/// Spacing and shape — same scale as the web (--space-*, --radius-*).
abstract final class Tm {
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s5 = 20.0;
  static const s6 = 24.0;
  static const s8 = 32.0;
  static const radiusSm = 8.0;
  static const radiusMd = 12.0;
  static const radiusLg = 18.0;
}

extension TmContext on BuildContext {
  TmColors get tm => Theme.of(this).extension<TmColors>()!;
}
