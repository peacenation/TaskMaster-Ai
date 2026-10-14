import 'package:flutter/material.dart';

import '../api/client.dart';
import '../state/session.dart';
import '../theme/tokens.dart';

/// Brand mark: a "T" whose stem finishes in a check — same shape as the
/// web's LogoMark (apps/web/components/shell/icons.tsx).
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 30});
  final double size;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size.square(size), painter: _LogoPainter());
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 32);
    const r = Radius.circular(3.5);
    canvas.drawRRect(
      RRect.fromLTRBR(2, 4, 24, 11, r),
      Paint()..color = TmColors.caramel,
    );
    canvas.drawRRect(
      RRect.fromLTRBR(9, 8, 16, 28, r),
      Paint()..color = const Color(0xFFA8703F),
    );
    canvas.drawPath(
      Path()
        ..moveTo(17, 18.5)
        ..lineTo(20.5, 22)
        ..lineTo(30, 11),
      Paint()
        ..color = TmColors.caramel
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class BrandWordmark extends StatelessWidget {
  const BrandWordmark({super.key});

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Semantics(
      label: 'TaskMasterAi',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const LogoMark(),
          const SizedBox(width: Tm.s2),
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
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.4,
              color: tm.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Initials in a sage circle; tapping opens the account sheet.
class AccountAvatar extends StatelessWidget {
  const AccountAvatar({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final me = session.me;
    return Semantics(
      button: true,
      label: 'Account',
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => showModalBottomSheet<void>(
          context: context,
          showDragHandle: true,
          builder: (sheet) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Tm.s6, 0, Tm.s6, Tm.s6),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    me?.name ?? '',
                    style: Theme.of(sheet).textTheme.titleMedium,
                  ),
                  Text(
                    me?.email ?? '',
                    style: Theme.of(sheet).textTheme.bodySmall,
                  ),
                  const SizedBox(height: Tm.s6),
                  OutlinedButton(
                    onPressed: () {
                      Navigator.of(sheet).pop();
                      session.signOut();
                    },
                    child: const Text('Sign out'),
                  ),
                ],
              ),
            ),
          ),
        ),
        child: CircleAvatar(
          radius: 22,
          backgroundColor: TmColors.sage,
          foregroundColor: Colors.white,
          child: Text(
            me?.initials ?? '',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ),
    );
  }
}

enum TileTone { sage, caramel, walnut }

class IconTile extends StatelessWidget {
  const IconTile(this.icon, {super.key, this.tone = TileTone.caramel});
  final IconData icon;
  final TileTone tone;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final (bg, fg) = switch (tone) {
      TileTone.sage => (tm.calmSubtle, tm.success),
      TileTone.caramel => (tm.accentSubtle, tm.aiText),
      TileTone.walnut => (tm.sunken, tm.action),
    };
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(Tm.radiusMd),
      ),
      child: Icon(icon, color: fg, size: 22),
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
  });

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s4, Tm.s4, Tm.s3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ),
                ?trailing,
              ],
            ),
            const SizedBox(height: Tm.s2),
            child,
          ],
        ),
      ),
    );
  }
}

/// The user's own priority (1–5), shown as High / Medium / Low.
class PriorityBadge extends StatelessWidget {
  const PriorityBadge(this.priority, {super.key});
  final int priority;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final (label, bg, fg) = priority >= 4
        ? ('High', tm.dangerSubtle, tm.danger)
        : priority == 3
        ? ('Medium', tm.aiBadge, tm.aiText)
        : ('Low', tm.calmSubtle, tm.success);
    return Semantics(
      label: 'Your priority: $label',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: Tm.s2, vertical: 2),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: fg,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

/// A round "complete" control — a real action, unlike the web's plan-order
/// numbers. 48dp target around a 26dp ring.
class CompleteCircle extends StatelessWidget {
  const CompleteCircle({super.key, required this.title, required this.onDone});
  final String title;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Complete $title',
      onPressed: onDone,
      icon: Icon(
        Icons.radio_button_unchecked,
        color: context.tm.borderStrong,
        size: 26,
      ),
    );
  }
}

class ProgressBar extends StatelessWidget {
  const ProgressBar(this.value, {super.key, this.color});
  final double value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: LinearProgressIndicator(
        value: value.clamp(0, 1),
        minHeight: 8,
        backgroundColor: context.tm.sunken,
        color: color ?? TmColors.caramel,
      ),
    );
  }
}

/// Loads [load], with a spinner, pull-to-refresh, and an error state with
/// retry. A 401 signs the user out via [Session.handle].
class Loader<T> extends StatefulWidget {
  const Loader({super.key, required this.load, required this.builder});

  final Future<T> Function() load;
  final Widget Function(
    BuildContext context,
    T data,
    Future<void> Function() reload,
  )
  builder;

  @override
  State<Loader<T>> createState() => LoaderState<T>();
}

class LoaderState<T> extends State<Loader<T>> {
  late Future<T> _future = _run();

  Future<T> _run() async {
    try {
      return await widget.load();
    } catch (e) {
      if (mounted) await SessionScope.read(context).handle(e);
      rethrow;
    }
  }

  Future<void> reload() async {
    final next = _run();
    setState(() {
      _future = next;
    });
    try {
      await next;
    } catch (_) {
      // Shown by the FutureBuilder below.
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          return RefreshIndicator(
            onRefresh: reload,
            child: widget.builder(context, snapshot.data as T, reload),
          );
        }
        if (snapshot.hasError) {
          final error = snapshot.error;
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(Tm.s6),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    error is ApiException
                        ? error.message
                        : 'Something went wrong.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: Tm.s4),
                  OutlinedButton(onPressed: reload, child: const Text('Retry')),
                ],
              ),
            ),
          );
        }
        return const Center(child: CircularProgressIndicator());
      },
    );
  }
}

/// Runs a mutation, showing failures as a snackbar (401 signs out).
Future<bool> runAction(
  BuildContext context,
  Future<void> Function() action,
) async {
  final messenger = ScaffoldMessenger.of(context);
  final session = SessionScope.read(context);
  try {
    await action();
    return true;
  } catch (e) {
    await session.handle(e);
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          e is ApiException ? e.message : 'Could not save. Try again.',
        ),
      ),
    );
    return false;
  }
}

String formatMinutes(int minutes) {
  if (minutes < 60) return '$minutes min';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  return m == 0 ? '$h h' : '$h h $m min';
}
