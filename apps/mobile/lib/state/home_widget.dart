import 'package:home_widget/home_widget.dart';

import '../api/models.dart';

/// Keeps the Android home-screen widget (NextActionWidget.kt) showing the
/// current Next Best Action and today's progress. Only titles the user
/// already sees on their own phone; cleared on sign-out.
abstract interface class HomeScreenWidget {
  Future<void> show(Today today);
  Future<void> clear();
}

class NoHomeScreenWidget implements HomeScreenWidget {
  const NoHomeScreenWidget();

  @override
  Future<void> show(Today today) async {}

  @override
  Future<void> clear() async {}
}

/// What the widget shows for [today]; pure, so it can be tested.
Map<String, String?> widgetData(Today today) {
  final rec = today.recommendation;
  final stats = today.stats;
  final done = stats?.completedToday ?? 0;
  final total = done + today.plan.length;
  return {
    'kicker': rec == null
        ? 'TODAY'
        : rec.overridden
        ? 'YOUR CHOICE'
        : 'NEXT BEST ACTION',
    'next_title': !today.onboarded
        ? 'Plan your day with a Brain Dump'
        : (rec?.task.title ?? 'Nothing active — capture something new'),
    'next_detail': rec?.task.project?.name,
    'progress': !today.onboarded || total == 0
        ? null
        : '$done of $total done today',
  };
}

class AndroidHomeScreenWidget implements HomeScreenWidget {
  static const _provider = 'NextActionWidget';

  Future<void> _write(Map<String, String?> data) async {
    try {
      for (final MapEntry(:key, :value) in data.entries) {
        await HomeWidget.saveWidgetData<String>(key, value);
      }
      await HomeWidget.updateWidget(androidName: _provider);
    } on Object {
      // No widget on the home screen, or not Android: nothing to update.
    }
  }

  @override
  Future<void> show(Today today) => _write(widgetData(today));

  @override
  Future<void> clear() => _write({
    'kicker': 'TASKMASTERAI',
    'next_title': 'Sign in to see what to do next',
    'next_detail': null,
    'progress': null,
  });
}
