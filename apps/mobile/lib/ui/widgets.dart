import 'package:flutter/material.dart';

import '../api/client.dart';
import '../state/appearance.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'goals_screen.dart';
import 'responsibilities_screen.dart';
import 'reviews_screen.dart';
import 'settings_screen.dart';

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
        onTap: () => showAccountMenu(context),
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

/// The account menu: the screens that don't need a tab of their own
/// (Goals, Responsibilities, Reviews, Settings) and Sign out.
Future<void> showAccountMenu(BuildContext context) {
  final session = SessionScope.read(context);
  final me = session.me;
  void open(Widget Function() screen) {
    Navigator.of(context).pop();
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen()));
  }

  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheet) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Tm.s2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    me?.name ?? '',
                    style: Theme.of(sheet).textTheme.titleMedium,
                  ),
                  Text(
                    me?.email ?? '',
                    style: Theme.of(sheet).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const SizedBox(height: Tm.s3),
            for (final (icon, label, screen)
                in <(IconData, String, Widget Function())>[
                  (Icons.flag_outlined, 'Goals', GoalsScreen.new),
                  (
                    Icons.repeat,
                    'Responsibilities',
                    ResponsibilitiesScreen.new,
                  ),
                  (
                    Icons.fact_check_outlined,
                    'Daily review',
                    ReviewsScreen.new,
                  ),
                  (
                    Icons.date_range_outlined,
                    'Weekly review',
                    () => const ReviewsScreen(weekly: true),
                  ),
                  (Icons.settings_outlined, 'Settings', SettingsScreen.new),
                ])
              ListTile(
                leading: Icon(icon),
                title: Text(label),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => open(screen),
              ),
            const Divider(),
            Padding(
              padding: const EdgeInsets.fromLTRB(Tm.s2, Tm.s2, Tm.s2, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Appearance',
                    style: Theme.of(sheet).textTheme.titleSmall,
                  ),
                  const SizedBox(height: Tm.s2),
                  const _AppearancePicker(),
                  const SizedBox(height: Tm.s4),
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
          ],
        ),
      ),
    ),
  );
}

class _AppearancePicker extends StatelessWidget {
  const _AppearancePicker();

  @override
  Widget build(BuildContext context) {
    final appearance = AppearanceScope.of(context);
    return SegmentedButton<ThemeMode>(
      showSelectedIcon: false,
      segments: const [
        ButtonSegment(value: ThemeMode.system, label: Text('System')),
        ButtonSegment(value: ThemeMode.light, label: Text('Light')),
        ButtonSegment(value: ThemeMode.dark, label: Text('Dark')),
      ],
      selected: {appearance.value},
      onSelectionChanged: (s) => appearance.choose(s.first),
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
    final tm = context.tm;
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    return FutureBuilder<T>(
      future: _future,
      builder: (context, snapshot) {
        // A refresh keeps the "data" key, so content only glides in when it
        // first arrives, not on every pull-to-refresh.
        final Widget child;
        if (snapshot.hasData) {
          child = RefreshIndicator(
            key: const ValueKey('data'),
            color: tm.action,
            backgroundColor: tm.card,
            onRefresh: reload,
            child: widget.builder(context, snapshot.data as T, reload),
          );
        } else if (snapshot.hasError) {
          final error = snapshot.error;
          child = Center(
            key: const ValueKey('error'),
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
        } else {
          child = const Center(
            key: ValueKey('loading'),
            child: CircularProgressIndicator(),
          );
        }
        return AnimatedSwitcher(
          duration: reduceMotion
              ? Duration.zero
              : const Duration(milliseconds: 380),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeIn,
          transitionBuilder: (child, animation) => FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween(
                begin: const Offset(0, 0.04),
                end: Offset.zero,
              ).animate(animation),
              child: child,
            ),
          ),
          child: child,
        );
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

/// Centred empty state: an icon, what's going on, and the next step.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Tm.s6, vertical: Tm.s8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: tm.accentSubtle,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: tm.aiText, size: 30),
          ),
          const SizedBox(height: Tm.s4),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: Tm.s2),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: tm.textMuted),
          ),
          if (action != null) ...[const SizedBox(height: Tm.s5), action!],
        ],
      ),
    );
  }
}

/// Sun over hills — the web hero's motif (apps/web: Today and the auth panel).
class HillsArt extends StatelessWidget {
  const HillsArt({super.key, this.width = 140, this.height = 76});
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: CustomPaint(size: Size(width, height), painter: _HillsPainter()),
  );
}

class _HillsPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final paint = Paint()..color = TmColors.caramel.withValues(alpha: 0.75);
    canvas.drawCircle(Offset(w * 0.68, h * 0.3), h * 0.16, paint);
    canvas.drawPath(
      Path()
        ..moveTo(0, h)
        ..cubicTo(w * 0.18, h * 0.42, w * 0.38, h * 0.36, w * 0.55, h * 0.62)
        ..cubicTo(w * 0.72, h * 0.4, w * 0.9, h * 0.44, w, h * 0.5)
        ..lineTo(w, h)
        ..close(),
      Paint()..color = TmColors.caramel.withValues(alpha: 0.28),
    );
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.15, h)
        ..cubicTo(w * 0.4, h * 0.7, w * 0.62, h * 0.74, w * 0.75, h * 0.82)
        ..cubicTo(w * 0.86, h * 0.68, w * 0.95, h * 0.7, w, h * 0.74)
        ..lineTo(w, h)
        ..close(),
      Paint()..color = TmColors.caramel.withValues(alpha: 0.38),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Quick Add: into the Inbox, or straight into [projectId] (or towards
/// [goalId]) as a to-do. True when added.
Future<bool> showQuickAdd(
  BuildContext context, {
  String? projectId,
  String? projectName,
  String? goalId,
  String? goalTitle,
}) async {
  final destination = projectName ?? goalTitle;
  final title = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _QuickAddSheet(destination: destination),
  );
  if (title == null || !context.mounted) return false;
  final api = SessionScope.read(context).api;
  var queued = false;
  final ok = await runAction(context, () async {
    final task = await api.quickAdd(
      title,
      projectId: projectId,
      goalId: goalId,
    );
    queued = task.id.startsWith('pending-');
  });
  if (ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          queued
              ? 'Saved on this phone — it’ll sync when you’re back online'
              : destination == null
              ? 'Added to your Inbox'
              : 'Added to $destination',
        ),
      ),
    );
  }
  return ok;
}

class _QuickAddSheet extends StatefulWidget {
  const _QuickAddSheet({this.destination});
  final String? destination;

  @override
  State<_QuickAddSheet> createState() => _QuickAddSheetState();
}

class _QuickAddSheetState extends State<_QuickAddSheet> {
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _submit() {
    final title = _text.text.trim();
    if (title.isNotEmpty) Navigator.of(context).pop(title);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        Tm.s4,
        0,
        Tm.s4,
        MediaQuery.viewInsetsOf(context).bottom + Tm.s4,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Quick Add', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: Tm.s3),
          TextField(
            controller: _text,
            autofocus: true,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            decoration: const InputDecoration(
              labelText: 'Task',
              hintText: 'Send Sarah the figures',
            ),
          ),
          const SizedBox(height: Tm.s2),
          Text(
            widget.destination == null
                ? 'Lands in your Inbox to organise later.'
                : 'Goes straight into ${widget.destination}.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: Tm.s4),
          FilledButton.icon(
            onPressed: _submit,
            icon: const Icon(Icons.add),
            label: const Text('Add task'),
          ),
        ],
      ),
    );
  }
}
