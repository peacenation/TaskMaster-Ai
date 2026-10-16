import 'package:home_widget/home_widget.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';

/// Keeps the Android home-screen widget (NextActionWidget.kt) showing the
/// current Next Best Action, today's progress and what's up next, and
/// reports when its buttons open the app. Only what the user already sees
/// on their own phone; cleared on sign-out.
abstract interface class HomeScreenWidget {
  Future<void> show(Today today);
  Future<void> clear();

  /// The taskmaster:// link that launched the app, if the widget did.
  Future<Uri?> initialLaunch();

  /// Widget taps while the app is running.
  Stream<Uri?> get launches;
}

class NoHomeScreenWidget implements HomeScreenWidget {
  const NoHomeScreenWidget();

  @override
  Future<void> show(Today today) async {}

  @override
  Future<void> clear() async {}

  @override
  Future<Uri?> initialLaunch() async => null;

  @override
  Stream<Uri?> get launches => const Stream.empty();
}

/// What the three widgets show for [today] at [now]; pure, so it can be
/// tested. Keys are read by NextActionWidget.kt (Today's tasks, Up next,
/// Focus).
Map<String, String?> widgetData(Today today, DateTime now) {
  final rec = today.recommendation;
  final done = today.stats?.completedToday ?? 0;
  final total = done + today.plan.length;
  final time = DateFormat.Hm();

  // Today's tasks: the plan in order, the recommendation first.
  final ordered = [
    if (rec != null) rec.task,
    for (final item in today.plan)
      if (item.task.id != rec?.task.id) item.task,
  ];
  final startOf = {
    for (final item in today.plan)
      if (item.scheduledStart != null) item.task.id: item.scheduledStart!,
  };
  String timeFor(Task task) {
    final start = startOf[task.id];
    if (start != null) return time.format(start);
    final due = task.dueAt;
    if (due != null &&
        due.year == now.year &&
        due.month == now.month &&
        due.day == now.day) {
      return time.format(due);
    }
    return '';
  }

  // Up next: the next thing on the clock — a planned block or a meeting.
  final upcoming = <(DateTime, String, String?, String?)>[
    for (final item in today.plan)
      if (item.scheduledStart != null && item.scheduledStart!.isAfter(now))
        (
          item.scheduledStart!,
          item.task.title,
          item.task.project?.name,
          item.task.id,
        ),
    for (final event in today.events)
      if (!event.allDay && event.startsAt.isAfter(now))
        (event.startsAt, event.title, 'Calendar', null),
  ]..sort((a, b) => a.$1.compareTo(b.$1));
  final next = upcoming.isEmpty ? null : upcoming.first;
  final upFallback = ordered.isEmpty ? null : ordered.first;

  final focusMinutes = (rec?.task.estimatedMinutes ?? 25).clamp(5, 120);

  return {
    'date_label': DateFormat('EEE, d MMM').format(now),
    for (var i = 0; i < 3; i++) ...{
      't${i}_title': i < ordered.length ? ordered[i].title : null,
      't${i}_time': i < ordered.length ? timeFor(ordered[i]) : null,
      't${i}_id': i < ordered.length ? ordered[i].id : null,
    },
    'empty_message': !today.onboarded
        ? 'Plan your day with a Brain Dump'
        : 'Nothing planned — tap + to capture something',
    'done': today.onboarded ? '$done' : null,
    'total': today.onboarded ? '$total' : null,
    'progress_label': today.onboarded && total > 0
        ? '$done of $total complete'
        : null,
    'up_title':
        next?.$2 ??
        upFallback?.title ??
        (today.onboarded
            ? 'Nothing planned — tap + to capture'
            : 'Plan your day with a Brain Dump'),
    'up_detail': next != null
        ? [time.format(next.$1), ?next.$3].join('  •  ')
        : upFallback?.project?.name,
    'up_id': next != null ? next.$4 : upFallback?.id,
    'focus_time': '${focusMinutes.toString().padLeft(2, '0')}:00',
    'focus_caption': rec?.task.title ?? 'Time to make progress.',
    'focus_task_id': rec?.task.id,
  };
}

class AndroidHomeScreenWidget implements HomeScreenWidget {
  /// Today's tasks (4×3), Up next (4×2) and Focus (2×2). Fully qualified:
  /// the Kotlin package differs from the application id (….twa).
  static const _providers = [
    'app.vercel.taskmaster_ai_omega.taskmaster.NextActionWidget',
    'app.vercel.taskmaster_ai_omega.taskmaster.UpNextWidget',
    'app.vercel.taskmaster_ai_omega.taskmaster.FocusWidget',
  ];

  Future<void> _write(Map<String, String?> data) async {
    try {
      for (final MapEntry(:key, :value) in data.entries) {
        await HomeWidget.saveWidgetData<String>(key, value);
      }
      for (final provider in _providers) {
        await HomeWidget.updateWidget(qualifiedAndroidName: provider);
      }
    } on Object {
      // No widget on the home screen, or not Android: nothing to update.
    }
  }

  @override
  Future<void> show(Today today) => _write(widgetData(today, DateTime.now()));

  @override
  Future<void> clear() => _write({
    'date_label': null,
    for (var i = 0; i < 3; i++) ...{
      't${i}_title': null,
      't${i}_time': null,
      't${i}_id': null,
    },
    'empty_message': 'Sign in to see your day',
    'done': null,
    'total': null,
    'progress_label': null,
    'up_title': 'Sign in to see what’s next',
    'up_detail': null,
    'up_id': null,
    'focus_time': '25:00',
    'focus_caption': 'Time to make progress.',
    'focus_task_id': null,
  });

  @override
  Future<Uri?> initialLaunch() async {
    try {
      return await HomeWidget.initiallyLaunchedFromHomeWidget();
    } on Object {
      return null;
    }
  }

  @override
  Stream<Uri?> get launches => HomeWidget.widgetClicked;
}
