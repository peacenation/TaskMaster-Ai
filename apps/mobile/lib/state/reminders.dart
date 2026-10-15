import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../api/models.dart';

/// Reminders on the phone, scheduled on the device from Today's plan — no
/// push server involved. Each time Today loads they're replaced, so they
/// always match the latest plan. Honours Settings › Important reminders.
abstract interface class Reminders {
  /// Replace scheduled reminders with ones for [today].
  Future<void> sync(Today today, {required bool enabled});

  /// Remove every scheduled reminder (signed out, or turned off).
  Future<void> clear();
}

/// For tests and platforms without notifications.
class NoReminders implements Reminders {
  const NoReminders();

  @override
  Future<void> sync(Today today, {required bool enabled}) async {}

  @override
  Future<void> clear() async {}
}

/// What to remind about, worked out without touching the plugin so it can
/// be tested: a nudge before each planned block, and before each meeting.
List<({int id, DateTime at, String title, String body})> plannedReminders(
  Today today,
  DateTime now,
) {
  const lead = Duration(minutes: 5);
  final reminders = <({int id, DateTime at, String title, String body})>[];
  for (final (i, item) in today.plan.indexed) {
    final start = item.scheduledStart;
    if (start == null) continue;
    final at = start.subtract(lead);
    if (!at.isAfter(now)) continue;
    reminders.add((
      id: 100 + i,
      at: at,
      title: 'Up next: ${item.task.title}',
      body:
          'Starts at ${_hhmm(start)} · ${item.minutes} min'
          '${item.task.project == null ? '' : ' · ${item.task.project!.name}'}',
    ));
  }
  for (final (i, event) in today.events.indexed) {
    if (event.allDay) continue;
    final at = event.startsAt.subtract(lead);
    if (!at.isAfter(now)) continue;
    reminders.add((
      id: 200 + i,
      at: at,
      title: event.title,
      body: 'In your calendar at ${_hhmm(event.startsAt)}',
    ));
  }
  return reminders;
}

String _hhmm(DateTime t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

class LocalReminders implements Reminders {
  LocalReminders({required this.timeZone});

  /// The device's IANA time zone (main.dart reads it at launch).
  final String timeZone;

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;
  bool _asked = false;

  static const _morningId = 1;

  static const _details = NotificationDetails(
    android: AndroidNotificationDetails(
      'plan',
      'Plan reminders',
      channelDescription: 'Your next block, meetings, and a morning nudge',
      icon: 'ic_stat_notify',
      importance: Importance.defaultImportance,
      priority: Priority.defaultPriority,
    ),
    iOS: DarwinNotificationDetails(),
  );

  Future<void> _init() async {
    if (_ready) return;
    tz_data.initializeTimeZones();
    try {
      tz.setLocalLocation(tz.getLocation(timeZone));
    } on Object {
      tz.setLocalLocation(tz.UTC);
    }
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('ic_stat_notify'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );
    _ready = true;
  }

  /// Ask once per launch, only when reminders are on.
  Future<bool> _permission() async {
    if (_asked) return true;
    _asked = true;
    final android = _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    final ios = _plugin
        .resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin
        >();
    final granted =
        await android?.requestNotificationsPermission() ??
        await ios?.requestPermissions(alert: true, sound: true) ??
        true;
    return granted;
  }

  @override
  Future<void> sync(Today today, {required bool enabled}) async {
    try {
      await _init();
      await _plugin.cancelAll();
      if (!enabled || !today.onboarded || !await _permission()) return;
      final now = DateTime.now();
      for (final r in plannedReminders(today, now)) {
        await _plugin.zonedSchedule(
          id: r.id,
          scheduledDate: tz.TZDateTime.from(r.at, tz.local),
          notificationDetails: _details,
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          title: r.title,
          body: r.body,
        );
      }
      // Every morning at 08:00: a nudge to look at the day.
      final local = tz.TZDateTime.now(tz.local);
      var morning = tz.TZDateTime(
        tz.local,
        local.year,
        local.month,
        local.day,
        8,
      );
      if (!morning.isAfter(local)) {
        morning = morning.add(const Duration(days: 1));
      }
      await _plugin.zonedSchedule(
        id: _morningId,
        scheduledDate: morning,
        notificationDetails: _details,
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        matchDateTimeComponents: DateTimeComponents.time,
        title: 'Plan your day',
        body: 'Open TaskMasterAi to see what matters most today.',
      );
    } on Object {
      // Reminders are a convenience: never let them break Today.
    }
  }

  @override
  Future<void> clear() async {
    try {
      await _init();
      await _plugin.cancelAll();
    } on Object {
      // Nothing scheduled, or notifications unavailable.
    }
  }
}
