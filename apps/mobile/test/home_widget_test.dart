import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:taskmaster/api/models.dart';
import 'package:taskmaster/state/home_widget.dart';

import 'app_test.dart' show pumpApp;
import 'fakes.dart';

void main() {
  final now = DateTime.utc(2050).toLocal();

  test(
    'Today’s tasks: the recommendation first, then the plan, with times',
    () {
      final data = widgetData(Today.fromJson(todayJson()), now);
      expect(data['t0_title'], 'Finalise project proposal');
      expect(data['t0_id'], 't1');
      expect(data['t1_title'], 'Review website designs');
      expect(data['t2_title'], isNull);
      expect(data['progress_label'], '2 of 4 complete');
      expect(data['done'], '2');
      expect(data['total'], '4');
    },
  );

  test(
    'Up next: the next block or meeting on the clock; Focus: the next task',
    () {
      final data = widgetData(Today.fromJson(todayJson()), now);
      // The 2099 block at 11:00 UTC comes before the 13:00 UTC meeting.
      expect(data['up_title'], 'Review website designs');
      expect(data['up_detail'], endsWith('•  Website redesign'));
      expect(data['up_id'], 't2');
      expect(data['focus_time'], '60:00');
      expect(data['focus_caption'], 'Finalise project proposal');
      expect(data['focus_task_id'], 't1');
    },
  );

  test('before the first Brain Dump, every widget invites one', () {
    final fresh = widgetData(
      Today.fromJson({'onboarded': false, 'greeting': 'Hi', 'firstName': 'Jo'}),
      now,
    );
    expect(fresh['t0_title'], isNull);
    expect(fresh['empty_message'], 'Plan your day with a Brain Dump');
    expect(fresh['up_title'], 'Plan your day with a Brain Dump');
    expect(fresh['focus_task_id'], isNull);
    expect(fresh['focus_time'], '25:00');
  });

  testWidgets('widget buttons open Focus on the task, and Brain Dump', (
    tester,
  ) async {
    final widget = FakeHomeWidget();
    final (api, _, _) = await pumpApp(
      tester,
      signedIn: true,
      homeWidget: widget,
    );
    expect(widget.shown, isNotEmpty);

    widget.tap('taskmaster://focus?task=t1');
    await tester.pumpAndSettle();
    expect(find.text('FOCUS'), findsOneWidget);
    expect(api.statusCalls.last, ('t1', TaskStatus.inProgress));
    await tester.tap(find.byTooltip('Close focus'));
    await tester.pumpAndSettle();

    // With nothing planned, the Focus widget still opens Focus: a plain
    // timer, already running when Start was tapped.
    widget.tap('taskmaster://focus?start=1');
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    expect(find.text('FOCUS'), findsOneWidget);
    expect(find.text('Time to make progress'), findsOneWidget);
    expect(find.text('Pause'), findsOneWidget);
    expect(find.text('Complete task'), findsNothing);
    await tester.tap(find.byTooltip('Close focus'));
    await tester.pump(const Duration(seconds: 1));

    widget.tap('taskmaster://capture');
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Brain Dump'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();

    widget.tap('taskmaster://task?id=t1');
    await tester.pumpAndSettle();
    expect(find.text('TO DO'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();

    widget.tap('taskmaster://tasks');
    await tester.pumpAndSettle();
    expect(find.text('My Tasks'), findsOneWidget);
  });

  testWidgets('launching from the widget goes straight to Focus', (
    tester,
  ) async {
    final widget = FakeHomeWidget()
      ..launchedWith = Uri.parse('taskmaster://focus?task=t1');
    await pumpApp(tester, signedIn: true, homeWidget: widget);
    await tester.pumpAndSettle();
    expect(find.text('FOCUS'), findsOneWidget);
  });
}
