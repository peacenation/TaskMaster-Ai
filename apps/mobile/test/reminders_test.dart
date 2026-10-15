import 'package:flutter_test/flutter_test.dart';
import 'package:taskmaster/api/models.dart';
import 'package:taskmaster/state/reminders.dart';

import 'app_test.dart' show pumpApp;
import 'fakes.dart';

void main() {
  test('reminders: five minutes before each block and meeting still ahead', () {
    final today = Today.fromJson(todayJson());
    // The fixture's first block (09:00 UTC, 2026) is past; the second
    // block and the meeting are in 2099.
    final reminders = plannedReminders(today, DateTime.utc(2050));
    expect(reminders.map((r) => r.title), [
      'Up next: Review website designs',
      'Design review',
    ]);
    expect(reminders.first.at, DateTime.utc(2099, 10, 12, 10, 55).toLocal());
    expect(reminders.first.body, startsWith('Starts at '));
    expect(reminders.first.body, endsWith('30 min · Website redesign'));
    expect(reminders.last.body, startsWith('In your calendar at '));
  });

  test(
    'reminders: nothing for what has already started, or all-day events',
    () {
      final today = Today.fromJson(todayJson());
      expect(plannedReminders(today, DateTime.utc(2100)), isEmpty);
    },
  );

  testWidgets('reminders follow Today and the Settings switch', (tester) async {
    final reminders = RecordingReminders();
    final (_, _, session) = await pumpApp(
      tester,
      signedIn: true,
      reminders: reminders,
    );
    expect(reminders.synced, [true]);
    await session.savePreferences({'notifications': 'off'});
    expect(reminders.cleared, 1);
    await session.signOut();
    expect(reminders.cleared, 2);
  });
}
