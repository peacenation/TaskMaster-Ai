import 'package:flutter_test/flutter_test.dart';
import 'package:taskmaster/api/models.dart';

import 'fakes.dart';

void main() {
  test('parses the /api/v1/today contract', () {
    final today = Today.fromJson(todayJson());
    expect(today.onboarded, isTrue);
    expect(today.firstName, 'Jerry');
    expect(today.stats!.dueToday, 4);
    expect(today.recommendation!.task.title, 'Finalise project proposal');
    expect(today.recommendation!.overridden, isFalse);
    expect(today.plan, hasLength(2));
    expect(today.plan.first.task.project!.name, 'Website redesign');
    expect(
      today.plan.first.scheduledStart!.isUtc,
      isFalse,
    ); // shown in local time
    expect(today.projects.single.fraction, closeTo(8 / 12, 1e-9));
  });

  test('a not-yet-onboarded user has no plan', () {
    final today = Today.fromJson({'onboarded': false});
    expect(today.onboarded, isFalse);
    expect(today.plan, isEmpty);
  });

  test('status round-trips to the wire format', () {
    expect(statusToWire(TaskStatus.inProgress), 'in_progress');
    expect(statusToWire(TaskStatus.completed), 'completed');
    expect(
      Task.fromJson({...task('x', 'X'), 'status': 'in_progress'}).status,
      TaskStatus.inProgress,
    );
  });

  test('initials come from the first two names', () {
    final me = Me(
      id: '1',
      name: ' Jerry  Mbawa ',
      email: 'e',
      timeZone: 'UTC',
      onboarded: true,
    );
    expect(me.initials, 'JM');
  });
}
