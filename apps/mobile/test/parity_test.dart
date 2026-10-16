import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:taskmaster/api/models.dart';
import 'package:taskmaster/ui/goals_screen.dart';
import 'package:taskmaster/ui/settings_screen.dart';
import 'package:taskmaster/ui/task_screen.dart';
import 'package:taskmaster/ui/widgets.dart';

import 'app_test.dart' show pumpApp, todayList;
import 'fakes.dart';

// Everything the web does, on the phone: task detail and breakdown, Focus,
// Today's decisions, Inbox triage, goals, responsibilities, reviews and
// Settings (including account deletion).

Future<void> openAccountMenu(WidgetTester tester) async {
  await tester.tap(find.byType(AccountAvatar).first);
  await tester.pumpAndSettle();
}

/// The Settings screen's list.
final settingsList = find
    .descendant(
      of: find.byType(SettingsScreen),
      matching: find.byType(Scrollable),
    )
    .first;

/// The task screen's list (screens behind it are scrollables too).
final taskList = find
    .descendant(of: find.byType(TaskScreen), matching: find.byType(Scrollable))
    .first;

Future<void> goToTab(WidgetTester tester, String label) async {
  await tester.tap(find.text(label).last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('task screen: open from Tasks, break it down, edit it', (
    tester,
  ) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await goToTab(tester, 'Tasks');
    await tester.tap(find.text('Finalise project proposal'));
    await tester.pumpAndSettle();

    expect(find.text('TO DO'), findsOneWidget);
    expect(find.text('Get promoted'), findsOneWidget);
    expect(find.text('Send to Sam for sign-off'), findsOneWidget);

    // Suggested steps: rename one, then save.
    await tester.scrollUntilVisible(
      find.text('Save steps'),
      200,
      scrollable: taskList,
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Step 2'),
      'Write the first draft',
    );
    await tester.tap(find.text('Save steps'));
    await tester.pumpAndSettle();
    expect(api.brokenDown.single, [
      'Gather what you need for the proposal',
      'Write the first draft',
    ]);
    await tester.scrollUntilVisible(
      find.text('Steps'),
      -200,
      scrollable: taskList,
    );
    expect(find.text('Write the first draft'), findsOneWidget);

    // Edit: rename and save.
    await tester.scrollUntilVisible(
      find.text('Edit'),
      200,
      scrollable: taskList,
    );
    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Title'),
      'Finalise the Q4 proposal',
    );
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();
    expect(
      api.updates.single,
      containsPair('title', 'Finalise the Q4 proposal'),
    );
    expect(api.updates.single, containsPair('project', 'Website redesign'));
    expect(api.updates.single, containsPair('goal', 'Get promoted'));
  });

  testWidgets('task screen: delete asks first', (tester) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await goToTab(tester, 'Tasks');
    await tester.tap(find.text('Finalise project proposal'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Delete'),
      200,
      scrollable: taskList,
    );
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    expect(find.text('Delete this task?'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Delete'));
    await tester.pumpAndSettle();
    expect(api.calls, contains('delete t1'));
    expect(find.text('My Tasks'), findsOneWidget);
  });

  testWidgets('Focus: starts the task, runs a timer, completes it', (
    tester,
  ) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await tester.tap(find.text('Start focus'));
    await tester.pumpAndSettle();
    expect(find.text('FOCUS'), findsOneWidget);
    expect(api.statusCalls, [('t1', TaskStatus.inProgress)]);
    expect(find.text('60:00'), findsOneWidget);

    await tester.tap(find.text('Start timer'));
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Pause'), findsOneWidget);
    await tester.tap(find.text('Pause'));
    await tester.pump();
    expect(find.text('Resume'), findsOneWidget);

    await tester.tap(find.text('Complete task'));
    await tester.pumpAndSettle();
    expect(api.statusCalls.last, ('t1', TaskStatus.completed));
    expect(find.text('What to do next'), findsOneWidget);
  });

  testWidgets('Today: recover missed work, Reality Check, slipping task', (
    tester,
  ) async {
    final (api, _, _) = await pumpApp(
      tester,
      signedIn: true,
      api: FakeApi(decisions: true),
    );
    expect(find.text('1 planned block was missed'), findsOneWidget);
    await tester.tap(find.text('Drop').first);
    await tester.pump();
    await tester.tap(find.text('Save decisions'));
    await tester.pumpAndSettle();
    expect(api.recovered.single, {'r1': RecoveryChoice.drop});
    expect(find.text('1 planned block was missed'), findsNothing);

    // Reality Check: postponing asks first.
    expect(find.text('Something needs to move'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Postpone').first);
    await tester.pumpAndSettle();
    expect(find.text('Postpone “Finalise project proposal”?'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Postpone').last);
    await tester.pumpAndSettle();
    expect(api.statusCalls, [('t1', TaskStatus.postponed)]);

    await tester.scrollUntilVisible(
      find.text('A task has moved three times'),
      200,
      scrollable: todayList,
    );
    expect(find.text('Update launch checklist'), findsWidgets);
  });

  testWidgets('Today: adjust my day and choose a different next task', (
    tester,
  ) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await tester.scrollUntilVisible(
      find.text('Adjust my day'),
      200,
      scrollable: todayList,
    );
    await tester.tap(find.text('Adjust my day'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('30m'));
    await tester.tap(find.text('Low'));
    await tester.tap(find.text('Rebuild today’s plan'));
    await tester.pumpAndSettle();
    expect(api.calls, contains('rebuild 240 30 low'));

    await tester.scrollUntilVisible(
      find.text('Choose a different task'),
      -200,
      scrollable: todayList,
    );
    await tester.tap(find.text('Choose a different task'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Review website designs').last);
    await tester.pumpAndSettle();
    expect(api.calls, contains('next t2'));
  });

  testWidgets('Inbox: organise captured items into a project', (tester) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await goToTab(tester, 'Tasks');
    // Every view fits on a phone without scrolling sideways.
    expect(tester.getRect(find.text('Waiting')).right, lessThanOrEqualTo(390));
    await tester.tap(find.text('Inbox'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Organise Inbox'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(CheckboxListTile, 'Water plants'));
    await tester.enterText(
      find.widgetWithText(TextField, 'Project (optional)'),
      'Home',
    );
    await tester.tap(find.text('Move 1 item to my list'));
    await tester.pumpAndSettle();
    expect(api.organised.single.$1, ['i1']);
    expect(api.organised.single.$2, 'Home');
    expect(find.text('1 item moved to Home'), findsOneWidget);
  });

  testWidgets('Goals: progress, a nudge, add a goal and a step', (
    tester,
  ) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await goToTab(tester, 'Projects');
    await tester.tap(find.text('Goals').first);
    await tester.pumpAndSettle();
    expect(find.text('Get promoted'), findsOneWidget);
    expect(find.text('By 31 Mar 2027 · 1 of 2 done'), findsOneWidget);
    expect(
      find.text('Nothing is moving this goal yet. Add one small next step.'),
      findsOneWidget,
    );

    await tester.tap(find.text('New goal'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Goal'), 'Run a 10k');
    await tester.tap(find.text('Save goal'));
    await tester.pumpAndSettle();
    expect(api.goalsCreated, ['Run a 10k']);
    final goalsList = find
        .descendant(
          of: find.byType(GoalsView),
          matching: find.byType(Scrollable),
        )
        .first;
    await tester.scrollUntilVisible(
      find.text('Run a 10k'),
      300,
      scrollable: goalsList,
    );
    expect(find.text('Run a 10k'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Add a step towards this').first,
      -300,
      scrollable: goalsList,
    );

    await tester.tap(find.text('Add a step towards this').first);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'Update my CV');
    await tester.tap(find.text('Add task'));
    await tester.pumpAndSettle();
    expect(api.added.single, ('Update my CV', 'g1'));
  });

  testWidgets('menu: responsibilities and reviews', (tester) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await openAccountMenu(tester);
    await tester.tap(find.text('Responsibilities'));
    await tester.pumpAndSettle();
    expect(find.text('Go to the gym'), findsOneWidget);
    expect(find.text('3 times weekly'), findsOneWidget);
    await tester.tap(find.text('Stop'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Stop').last);
    await tester.pumpAndSettle();
    expect(api.calls, contains('stop rr1'));
    expect(find.text('Stopped'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();

    await openAccountMenu(tester);
    await tester.tap(find.text('Daily review'));
    await tester.pumpAndSettle();
    expect(
      find.text('1 completed · 0 changed · 1 carried forward'),
      findsOneWidget,
    );
    await tester.tap(find.text('This week'));
    await tester.pumpAndSettle();
    expect(find.text('Update launch checklist moved 3 times.'), findsOneWidget);
    expect(find.text('Moved 3 times'), findsOneWidget);
  });

  testWidgets('Settings: save a preference; delete needs DELETE and password', (
    tester,
  ) async {
    final (api, _, session) = await pumpApp(tester, signedIn: true);
    await openAccountMenu(tester);
    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Scheduled'));
    await tester.pumpAndSettle();
    expect(api.updates.single, {'planMode': 'scheduled'});
    expect(session.me!.preferences.planMode, 'scheduled');

    await tester.scrollUntilVisible(
      find.text('Delete account…'),
      200,
      scrollable: settingsList,
    );
    await tester.ensureVisible(find.text('Delete account…'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete account…'));
    await tester.pumpAndSettle();
    final delete = find.widgetWithText(
      FilledButton,
      'Permanently delete account',
    );
    expect(tester.widget<FilledButton>(delete).onPressed, isNull);
    await tester.enterText(
      find.widgetWithText(TextField, 'Type DELETE'),
      'DELETE',
    );
    await tester.enterText(find.widgetWithText(TextField, 'Password'), 'nope');
    await tester.pump();
    await tester.tap(delete);
    await tester.pumpAndSettle();
    expect(find.textContaining('Check your password'), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextField, 'Password'),
      'correct horse',
    );
    await tester.pump();
    await tester.tap(delete);
    await tester.pumpAndSettle();
    expect(api.deletedWith, 'correct horse');
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('Settings: a Google-only account confirms with Google', (
    tester,
  ) async {
    final fake = FakeApi()..hasPassword = false;
    final auth = FakeAuth(signedIn: true)..google = true;
    final (api, _, _) = await pumpApp(tester, api: fake, auth: auth);
    await openAccountMenu(tester);
    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Delete account…'),
      200,
      scrollable: settingsList,
    );
    await tester.ensureVisible(find.text('Delete account…'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete account…'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextField, 'Password'), findsNothing);
    await tester.enterText(
      find.widgetWithText(TextField, 'Type DELETE'),
      'DELETE',
    );
    await tester.pump();
    await tester.tap(find.text('Confirm with Google and delete'));
    await tester.pumpAndSettle();
    expect(auth.googleCalls, 1);
    expect(api.deletedWith, 'google');
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('calendar: Today shows meetings; connect one in Settings', (
    tester,
  ) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await tester.scrollUntilVisible(
      find.text('Today’s calendar'),
      200,
      scrollable: todayList,
    );
    expect(find.text('Company holiday'), findsOneWidget);
    expect(find.text('Design review'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.textContaining('1 h of meetings taken out'),
      200,
      scrollable: todayList,
    );

    await tester.scrollUntilVisible(
      find.byType(AccountAvatar),
      -400,
      scrollable: todayList,
    );
    await openAccountMenu(tester);
    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Connect a calendar'),
      200,
      scrollable: settingsList,
    );
    await tester.ensureVisible(find.text('Connect a calendar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Connect a calendar'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'iCal address'),
      'http://example.com/cal.ics',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Connect calendar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('https:// or webcal://'), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextField, 'iCal address'),
      'https://calendar.google.com/calendar/ical/me/private-x/basic.ics',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Connect calendar'));
    await tester.pumpAndSettle();
    expect(api.connectedCalendars, ['Google Calendar']);
    expect(
      find.text('Calendar connected — 12 upcoming events.'),
      findsOneWidget,
    );
    await tester.ensureVisible(find.text('Google Calendar'));
    expect(find.text('Google Calendar'), findsOneWidget);
    await tester.tap(find.text('Disconnect'));
    await tester.pumpAndSettle();
    expect(api.connectedCalendars, isEmpty);
  });

  testWidgets(
    'waiting on: mark a task, see it in Waiting, follow up on Today',
    (tester) async {
      final (api, _, _) = await pumpApp(
        tester,
        signedIn: true,
        api: FakeApi(decisions: true),
      );
      // Today: a follow-up is due.
      await tester.scrollUntilVisible(
        find.text('Contract from the landlord'),
        200,
        scrollable: todayList,
      );
      expect(find.text('Waiting on Letting agent'), findsOneWidget);
      await tester.ensureVisible(find.text('It’s arrived'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('It’s arrived'));
      await tester.pumpAndSettle();
      expect(api.updates.last, {'id': 'w2', 'waitingOn': null});

      // Mark a task as waiting from its screen.
      await goToTab(tester, 'Tasks');
      await tester.tap(find.text('Finalise project proposal'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Waiting on someone…'),
        200,
        scrollable: taskList,
      );
      await tester.tap(find.text('Waiting on someone…'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextField, 'Who or what'),
        'Sam',
      );
      await tester.tap(find.text('A week'));
      await tester.tap(find.text('Mark as waiting'));
      await tester.pumpAndSettle();
      final saved = api.updates.last;
      expect(saved['waitingOn'], 'Sam');
      final followUp = DateTime.parse(saved['followUpAt']! as String);
      expect(
        followUp.difference(DateTime.now()).inDays,
        inInclusiveRange(6, 7),
      );
      await tester.pageBack();
      await tester.pumpAndSettle();

      // The Waiting view lists what others owe you.
      await tester.tap(find.text('Waiting'));
      await tester.pumpAndSettle();
      expect(find.text('Get sign-off on the budget'), findsOneWidget);
      expect(find.text('Waiting on Sam'), findsOneWidget);
    },
  );

  testWidgets('Brain Dump: dictate after what was typed, then stop', (
    tester,
  ) async {
    final dictation = FakeDictation();
    await pumpApp(
      tester,
      signedIn: true,
      api: FakeApi(onboarded: false),
      dictation: dictation,
    );
    await tester.tap(find.text('Plan my day'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Call Mum.');
    await tester.tap(find.text('Dictate'));
    await tester.pump();
    expect(find.textContaining('Listening'), findsOneWidget);
    dictation.say('Book the dentist');
    await tester.pump();
    dictation.say('Book the dentist and renew the car insurance');
    await tester.pump();
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      'Call Mum. Book the dentist and renew the car insurance',
    );
    await tester.tap(find.text('Stop dictating'));
    await tester.pump();
    expect(dictation.listening, isFalse);
    expect(find.text('Dictate'), findsOneWidget);
  });

  testWidgets('Brain Dump: no Dictate button where speech isn’t available', (
    tester,
  ) async {
    await pumpApp(tester, signedIn: true, api: FakeApi(onboarded: false));
    await tester.tap(find.text('Plan my day'));
    await tester.pumpAndSettle();
    expect(find.text('Dictate'), findsNothing);
  });

  testWidgets('Goals: suggest next steps, edit, add to the list', (
    tester,
  ) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await goToTab(tester, 'Projects');
    await tester.tap(find.text('Goals').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Suggest next steps').first);
    await tester.pumpAndSettle();
    expect(find.text('Start small and build the habit.'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, 'Step 2'),
      'Book a trial lesson',
    );
    await tester.tap(find.byTooltip('Remove step 3'));
    await tester.pump();
    await tester.tap(find.text('Add these to my list'));
    await tester.pumpAndSettle();
    expect(api.savedSteps.single, ['Choose a course', 'Book a trial lesson']);
    expect(find.text('Added 2 steps to your list'), findsOneWidget);
  });
}
