import 'dart:async';

import 'package:flutter/material.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'widgets.dart';

/// Opens Focus for [task], or a plain timer when there is none; true when
/// the task changed (started, completed or postponed), so the caller
/// reloads. [autostart] starts the timer at once (the widget's Start).
Future<bool> openFocus(
  BuildContext context,
  Task? task, {
  bool autostart = false,
}) async {
  final changed = await Navigator.of(context).push<bool>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => FocusScreen(task: task, autostart: autostart),
    ),
  );
  return changed == true;
}

/// Focus mode: one task, a timer, and nothing else (PRD §2.2 Execution).
/// Opening it marks the task in progress, like the web's Start focus.
/// Without a task it is just the timer.
class FocusScreen extends StatefulWidget {
  const FocusScreen({super.key, required this.task, this.autostart = false});
  final Task? task;
  final bool autostart;

  @override
  State<FocusScreen> createState() => _FocusScreenState();
}

class _FocusScreenState extends State<FocusScreen> {
  late int _minutes = (widget.task?.estimatedMinutes ?? 25).clamp(5, 120);

  /// When the running timer ends; null while stopped.
  DateTime? _endsAt;

  /// Time left while paused.
  Duration? _paused;
  Timer? _tick;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    final task = widget.task;
    if (task != null && task.status != TaskStatus.inProgress) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _markStarted(task));
    }
    if (widget.autostart) _start();
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _markStarted(Task task) async {
    final api = SessionScope.read(context).api;
    if (await runAction(
      context,
      () => api.setStatus(task.id, TaskStatus.inProgress),
    )) {
      _started = true;
    }
  }

  Duration get _remaining {
    if (_paused != null) return _paused!;
    if (_endsAt == null) return Duration(minutes: _minutes);
    final left = _endsAt!.difference(DateTime.now());
    return left.isNegative ? Duration.zero : left;
  }

  bool get _running => _endsAt != null && _paused == null;

  void _start() {
    setState(() {
      _endsAt = DateTime.now().add(_paused ?? Duration(minutes: _minutes));
      _paused = null;
    });
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (!mounted) return;
      setState(() {});
      if (_remaining == Duration.zero) _tick?.cancel();
    });
  }

  void _pause() {
    _tick?.cancel();
    setState(() => _paused = _remaining);
  }

  void _reset() {
    _tick?.cancel();
    setState(() {
      _endsAt = null;
      _paused = null;
    });
  }

  Future<void> _finish(Task task, TaskStatus status) async {
    final api = SessionScope.read(context).api;
    if (await runAction(context, () => api.setStatus(task.id, status))) {
      if (mounted) Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final left = _remaining;
    final mm = left.inMinutes.toString().padLeft(2, '0');
    final ss = (left.inSeconds % 60).toString().padLeft(2, '0');
    final timeUp = _endsAt != null && left == Duration.zero;
    final total = Duration(minutes: _minutes).inSeconds;
    final task = widget.task;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Close focus',
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(_started),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(Tm.s6, 0, Tm.s6, Tm.s8),
          children: [
            Text(
              'FOCUS',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: tm.aiText,
                fontWeight: FontWeight.w700,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: Tm.s2),
            Semantics(
              header: true,
              child: Text(
                task?.title ?? 'Time to make progress',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
            if (task?.project != null)
              Text(
                task!.project!.name,
                textAlign: TextAlign.center,
                style: TextStyle(color: tm.textMuted),
              ),
            const SizedBox(height: Tm.s8),
            Center(
              child: SizedBox.square(
                dimension: 240,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CircularProgressIndicator(
                      value: total == 0 ? 0 : left.inSeconds / total,
                      strokeWidth: 10,
                      backgroundColor: tm.sunken,
                      color: TmColors.caramel,
                    ),
                    Center(
                      child: Semantics(
                        label: 'Time remaining $mm minutes $ss seconds',
                        excludeSemantics: true,
                        child: Text(
                          '$mm:$ss',
                          style: const TextStyle(
                            fontSize: 56,
                            fontWeight: FontWeight.w700,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: Tm.s5),
            if (timeUp)
              Semantics(
                liveRegion: true,
                child: Text(
                  'Time is up. Take a breath, then decide what comes next.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: tm.textMuted),
                ),
              )
            else if (_endsAt == null)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    tooltip: 'Five minutes less',
                    onPressed: _minutes > 5
                        ? () => setState(() => _minutes -= 5)
                        : null,
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                  Text('$_minutes minutes'),
                  IconButton(
                    tooltip: 'Five minutes more',
                    onPressed: _minutes < 240
                        ? () => setState(() => _minutes += 5)
                        : null,
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ],
              ),
            const SizedBox(height: Tm.s4),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: timeUp ? null : (_running ? _pause : _start),
                    icon: Icon(_running ? Icons.pause : Icons.play_arrow),
                    label: Text(
                      _running
                          ? 'Pause'
                          : (_paused != null ? 'Resume' : 'Start timer'),
                    ),
                  ),
                ),
                if (_endsAt != null) ...[
                  const SizedBox(width: Tm.s2),
                  OutlinedButton(onPressed: _reset, child: const Text('Reset')),
                ],
              ],
            ),
            if (task != null) ...[
              const SizedBox(height: Tm.s6),
              OutlinedButton.icon(
                onPressed: () => _finish(task, TaskStatus.completed),
                icon: const Icon(Icons.check),
                label: const Text('Complete task'),
              ),
              const SizedBox(height: Tm.s2),
              TextButton(
                onPressed: () => _finish(task, TaskStatus.postponed),
                child: const Text('Postpone for now'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
