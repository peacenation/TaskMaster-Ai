import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:taskmaster/api/models.dart';
import 'package:taskmaster/app.dart';
import 'package:taskmaster/state/session.dart';

import 'fakes.dart';

Future<(FakeApi, FakeAuth, Session)> pumpApp(
  WidgetTester tester, {
  bool signedIn = false,
  FakeApi? api,
  FakeAuth? auth,
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final fake = api ?? FakeApi();
  final gateway = auth ?? FakeAuth(signedIn: signedIn);
  final session = Session(api: fake, auth: gateway);
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
    expect(find.text('Due today'), findsOneWidget);
    expect(find.text('Today’s priorities'), findsOneWidget);
    expect(find.text('Review website designs'), findsWidgets);
    await tester.scrollUntilVisible(find.text('Next block'), 300);
    expect(find.text('Next block'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('What to do next'), -300);

    await tester.tap(find.widgetWithText(FilledButton, 'Complete'));
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
    await tester.tap(find.widgetWithText(FilledButton, 'Add task'));
    await tester.pumpAndSettle();
    expect(api.added, ['Call the plumber']);
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
    expect(find.text('Your planned timeline'), findsOneWidget);
  });

  testWidgets('dark theme builds', (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await pumpApp(tester, signedIn: true);
    expect(find.text('What to do next'), findsOneWidget);
  });
}
