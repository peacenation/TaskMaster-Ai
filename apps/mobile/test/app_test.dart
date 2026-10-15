import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:taskmaster/api/models.dart';
import 'package:taskmaster/app.dart';
import 'package:taskmaster/state/dictation.dart';
import 'package:taskmaster/state/reminders.dart';
import 'package:taskmaster/state/session.dart';
import 'package:taskmaster/ui/today_screen.dart';
import 'package:taskmaster/ui/widgets.dart';

import 'fakes.dart';

/// Today's vertical list (the tab pager is a scrollable too).
final todayList = find
    .descendant(of: find.byType(TodayScreen), matching: find.byType(Scrollable))
    .first;

Future<(FakeApi, FakeAuth, Session)> pumpApp(
  WidgetTester tester, {
  bool signedIn = false,
  FakeApi? api,
  FakeAuth? auth,
  Reminders reminders = const NoReminders(),
  Dictation? dictation,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final fake = api ?? FakeApi();
  final gateway = auth ?? FakeAuth(signedIn: signedIn);
  final session = Session(
    api: fake,
    auth: gateway,
    reminders: reminders,
    dictation: dictation,
  );
  await tester.pumpWidget(TaskMasterApp(session: session));
  await session.restore();
  await tester.pumpAndSettle();
  return (fake, gateway, session);
}

void main() {
  testWidgets('signing in opens Today', (tester) async {
    final (_, auth, _) = await pumpApp(tester);
    expect(find.text('Welcome back'), findsOneWidget);

    await tester.tap(find.text('Sign in'));
    await tester.pump();
    expect(find.text('Enter your email address'), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Email'),
      'jerry@example.com',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Password'),
      'correct horse battery',
    );
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    expect(auth.signedIn, isTrue);
    expect(find.text('Good morning, Jerry'), findsOneWidget);
  });

  testWidgets('Google button is hidden until a client ID is configured', (
    tester,
  ) async {
    await pumpApp(tester);
    expect(find.text('Continue with Google'), findsNothing);
  });

  testWidgets('Continue with Google signs in; cancelling stays quiet', (
    tester,
  ) async {
    final auth = FakeAuth()
      ..google = true
      ..cancelGoogle = true;
    await pumpApp(tester, auth: auth);
    await tester.tap(find.text('Continue with Google'));
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.textContaining('Try again'), findsNothing);

    auth.cancelGoogle = false;
    await tester.tap(find.text('Continue with Google'));
    await tester.pumpAndSettle();
    expect(auth.googleCalls, 2);
    expect(find.text('Good morning, Jerry'), findsOneWidget);
  });

  testWidgets('a wrong password explains itself', (tester) async {
    await pumpApp(tester, auth: FakeAuth()..rejectPassword = true);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Email'),
      'jerry@example.com',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Password'),
      'nope',
    );
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    expect(find.textContaining('don’t match an account'), findsOneWidget);
  });

  testWidgets('Today shows the Next Best Action, stats and priorities', (
    tester,
  ) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    expect(find.text('What to do next'), findsOneWidget);
    expect(find.text('NEXT BEST ACTION'), findsOneWidget);
    expect(find.text('Start focus'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Today’s priorities'),
      300,
      scrollable: todayList,
    );
    expect(find.text('Due today'), findsOneWidget);
    expect(find.text('What’s realistic'), findsOneWidget);
    expect(find.text('Review website designs'), findsWidgets);
    await tester.scrollUntilVisible(
      find.text('Next block'),
      300,
      scrollable: todayList,
    );
    expect(find.text('Next block'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('What to do next'),
      -300,
      scrollable: todayList,
    );

    await tester.tap(find.widgetWithText(OutlinedButton, 'Complete'));
    await tester.pumpAndSettle();
    expect(api.statusCalls, [('t1', TaskStatus.completed)]);
  });

  testWidgets('an expired session returns to sign-in', (tester) async {
    final (_, auth, _) = await pumpApp(
      tester,
      signedIn: true,
      api: FakeApi()..expired = true,
    );
    expect(find.text('Welcome back'), findsOneWidget);
    expect(auth.signedIn, isFalse);
  });

  testWidgets('Tasks: switch views, complete, and Quick Add', (tester) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await tester.tap(find.text('Tasks'));
    await tester.pumpAndSettle();
    expect(find.text('My Tasks'), findsOneWidget);
    expect(find.text('Update launch checklist'), findsNothing);

    await tester.tap(find.text('All'));
    await tester.pumpAndSettle();
    expect(find.text('Update launch checklist'), findsOneWidget);

    await tester.tap(find.byTooltip('Complete Update launch checklist'));
    await tester.pumpAndSettle();
    expect(api.statusCalls.last, ('t3', TaskStatus.completed));

    await tester.tap(find.byTooltip('Add task'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Task'),
      'Call the plumber',
    );
    await tester.tap(
      find.descendant(
        of: find.byType(BottomSheet),
        matching: find.widgetWithText(FilledButton, 'Add task'),
      ),
    );
    await tester.pumpAndSettle();
    expect(api.added, [('Call the plumber', null)]);
    expect(find.text('Added to your Inbox'), findsOneWidget);
  });

  testWidgets('Projects and the AI timeline render', (tester) async {
    await pumpApp(tester, signedIn: true);
    await tester.tap(find.text('Projects'));
    await tester.pumpAndSettle();
    expect(find.text('Website redesign'), findsOneWidget);
    expect(find.text('67%'), findsOneWidget);

    await tester.tap(find.text('AI'));
    await tester.pumpAndSettle();
    expect(find.text('Today’s timeline'), findsOneWidget);
  });

  testWidgets('dark theme builds', (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await pumpApp(tester, signedIn: true);
    expect(find.text('What to do next'), findsOneWidget);
  });

  testWidgets('first run: Plan my day → Brain Dump → review → Today', (
    tester,
  ) async {
    final (api, _, _) = await pumpApp(
      tester,
      signedIn: true,
      api: FakeApi(onboarded: false),
    );
    expect(find.text('Good morning, Jerry'), findsOneWidget);
    expect(find.text('Let’s plan your day'), findsOneWidget);

    await tester.tap(find.text('Plan my day'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Brain Dump'),
      'Finish the report, book the dentist, call Mum',
    );
    await tester.pump();
    await tester.tap(find.text('Organise it'));
    await tester.pumpAndSettle();
    expect(find.text('Review before you save'), findsOneWidget);
    expect(find.textContaining('built-in rules'), findsOneWidget);

    await tester.tap(find.byTooltip('Remove Call Mum'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Book the dentist'),
      'Book the dentist for Friday',
    );
    await tester.pump();
    await tester.tap(find.text('Save 2 items'));
    await tester.pumpAndSettle();

    expect(api.committed, [
      ['Finish the report', 'Book the dentist for Friday'],
    ]);
    expect(find.text('What to do next'), findsOneWidget);
  });

  testWidgets('Today: daily progress and View all → Tasks', (tester) async {
    await pumpApp(tester, signedIn: true);
    // 2 completed today, 2 still planned.
    await tester.scrollUntilVisible(
      find.text('Daily progress'),
      200,
      scrollable: todayList,
    );
    expect(find.text('50%'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('View all'),
      200,
      scrollable: todayList,
    );
    await tester.tap(find.text('View all'));
    await tester.pumpAndSettle();
    expect(find.text('My Tasks'), findsOneWidget);
  });

  testWidgets('Tasks: search and the … menu', (tester) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await tester.tap(find.text('Tasks'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('All'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Search tasks and projects'),
      'launch',
    );
    await tester.pumpAndSettle();
    expect(find.text('Update launch checklist'), findsOneWidget);
    expect(find.text('Finalise project proposal'), findsNothing);

    await tester.tap(find.byTooltip('More for Update launch checklist'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Postpone'));
    await tester.pumpAndSettle();
    expect(api.statusCalls.last, ('t3', TaskStatus.postponed));

    await tester.enterText(
      find.widgetWithText(TextField, 'Search tasks and projects'),
      'zzz',
    );
    await tester.pumpAndSettle();
    expect(find.text('No matches'), findsOneWidget);
  });

  testWidgets('Projects: open a project, add a task to it', (tester) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await tester.tap(find.text('Projects'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Website redesign'));
    await tester.pumpAndSettle();
    expect(find.text('In progress'), findsOneWidget);
    expect(find.text('To do'), findsOneWidget);
    expect(find.text('8 of 12 tasks complete'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Add task'));
    await tester.pumpAndSettle();
    expect(find.text('Goes straight into Website redesign.'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, 'Task'),
      'Draft slides',
    );
    await tester.tap(
      find.descendant(
        of: find.byType(BottomSheet),
        matching: find.widgetWithText(FilledButton, 'Add task'),
      ),
    );
    await tester.pumpAndSettle();
    expect(api.added, [('Draft slides', 'p1')]);
  });

  testWidgets('AI Planner: ask, see the timeline, apply task blocks only', (
    tester,
  ) async {
    final (api, _, _) = await pumpApp(tester, signedIn: true);
    await tester.tap(find.text('AI'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Plan my day around a 2pm meeting'));
    await tester.pumpAndSettle();

    expect(api.planRequests, ['Plan my day around a 2pm meeting']);
    expect(find.textContaining('your meeting at 14:00'), findsOneWidget);
    expect(find.text('Your planned timeline'), findsOneWidget);
    expect(find.text('Team meeting'), findsOneWidget);

    await tester.ensureVisible(find.text('Apply plan'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Apply plan'));
    await tester.pumpAndSettle();
    expect(api.applied, [
      ['t1'],
    ]);
    expect(find.text('Applied to Today'), findsOneWidget);
  });

  testWidgets('AI Planner before onboarding offers a Brain Dump', (
    tester,
  ) async {
    await pumpApp(tester, signedIn: true, api: FakeApi(onboarded: false));
    await tester.tap(find.text('AI'));
    await tester.pumpAndSettle();
    expect(find.text('Nothing to plan yet'), findsOneWidget);
    expect(find.text('Start a Brain Dump'), findsOneWidget);
  });

  testWidgets('Appearance: choose Dark from the account sheet', (tester) async {
    await pumpApp(tester, signedIn: true);
    await tester.tap(find.byType(AccountAvatar).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dark'));
    await tester.pumpAndSettle();
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.dark);
  });

  testWidgets('launch: the intro plays, then the right first screen', (
    tester,
  ) async {
    final session = Session(api: FakeApi(), auth: FakeAuth());
    await tester.pumpWidget(TaskMasterApp(session: session));
    await session.restore();
    await tester.pump();
    expect(find.text('Clarity. Momentum. Done.'), findsOneWidget);
    expect(find.text('Welcome back'), findsNothing);

    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('swipe left and right between tabs', (tester) async {
    await pumpApp(tester, signedIn: true);
    expect(find.text('What to do next'), findsOneWidget);

    await tester.fling(find.byType(PageView), const Offset(-250, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.text('My Tasks'), findsOneWidget);
    final nav = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(nav.selectedIndex, 1);

    await tester.fling(find.byType(PageView), const Offset(250, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.text('What to do next'), findsOneWidget);
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      0,
    );
  });
}
