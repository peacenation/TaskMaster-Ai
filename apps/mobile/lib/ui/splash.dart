import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The in-app intro that follows the native launch screen (same background,
/// same mark, same position), so the hand-off is seamless. The T settles in,
/// the check draws itself, then the wordmark and tagline rise. [onDone]
/// fires when the animation ends; the app waits for that *and* the session
/// before showing the first screen.
class SplashIntro extends StatefulWidget {
  const SplashIntro({super.key, this.onDone});
  final VoidCallback? onDone;

  static const duration = Duration(milliseconds: 1400);

  @override
  State<SplashIntro> createState() => _SplashIntroState();
}

class _SplashIntroState extends State<SplashIntro>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: SplashIntro.duration,
  );

  @override
  void initState() {
    super.initState();
    _c.addStatusListener((status) {
      if (status == AnimationStatus.completed) widget.onDone?.call();
    });
    // Reduced motion: skip straight to the final frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (MediaQuery.of(context).disableAnimations) {
        _c.value = 1;
        widget.onDone?.call();
      } else {
        _c.forward();
      }
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Animation<double> _interval(
    double begin,
    double end, [
    Curve curve = Curves.easeOutCubic,
  ]) => CurvedAnimation(
    parent: _c,
    curve: Interval(begin, end, curve: curve),
  );

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final mark = _interval(0, 0.45, Curves.easeOutBack);
    final check = _interval(0.3, 0.7);
    final words = _interval(0.55, 1);
    return Scaffold(
      backgroundColor: tm.page,
      body: Semantics(
        label: 'TaskMasterAi',
        child: Center(
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) => Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Opacity(
                  opacity: mark.value.clamp(0, 1),
                  child: Transform.scale(
                    scale: 0.8 + 0.2 * mark.value,
                    child: CustomPaint(
                      size: const Size(160, 129),
                      painter: _MarkPainter(check: check.value),
                    ),
                  ),
                ),
                const SizedBox(height: Tm.s6),
                Opacity(
                  opacity: words.value,
                  child: Transform.translate(
                    offset: Offset(0, 12 * (1 - words.value)),
                    child: Column(
                      children: [
                        Text.rich(
                          TextSpan(
                            text: 'TaskMaster',
                            children: [
                              TextSpan(
                                text: 'Ai',
                                style: TextStyle(color: tm.aiText),
                              ),
                            ],
                          ),
                          style: TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.6,
                            color: tm.textPrimary,
                          ),
                        ),
                        const SizedBox(height: Tm.s1),
                        Text(
                          'Clarity. Momentum. Done.',
                          style: TextStyle(color: tm.textMuted, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The mark from assets/branding (a T whose stem ends in a check), with
/// the check drawn progressively ([check] 0→1).
class _MarkPainter extends CustomPainter {
  _MarkPainter({required this.check});
  final double check;

  @override
  void paint(Canvas canvas, Size size) {
    // Same geometry as LogoMark (32-unit box), cropped to the mark's bounds.
    const minX = 2.0, minY = 4.0, w = 29.8, h = 24.0;
    final scale = math.min(size.width / w, size.height / h);
    canvas.translate(-minX * scale, -minY * scale);
    canvas.scale(scale);
    const r = Radius.circular(3.5);
    canvas.drawRRect(
      RRect.fromLTRBR(2, 4, 24, 11, r),
      Paint()..color = TmColors.caramel,
    );
    canvas.drawRRect(
      RRect.fromLTRBR(9, 8, 16, 28, r),
      Paint()..color = const Color(0xFFA8703F),
    );
    if (check <= 0) return;
    final full = Path()
      ..moveTo(17, 18.5)
      ..lineTo(20.5, 22)
      ..lineTo(30, 11);
    final metric = full.computeMetrics().first;
    canvas.drawPath(
      metric.extractPath(0, metric.length * check),
      Paint()
        ..color = TmColors.caramel
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_MarkPainter old) => old.check != check;
}
