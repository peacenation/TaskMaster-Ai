import 'package:flutter/material.dart';

import 'state/session.dart';
import 'theme/app_theme.dart';
import 'ui/home_shell.dart';
import 'ui/sign_in_screen.dart';

class TaskMasterApp extends StatelessWidget {
  const TaskMasterApp({super.key, required this.session});
  final Session session;

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      session: session,
      child: MaterialApp(
        title: 'TaskMasterAi',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        home: ListenableBuilder(
          listenable: session,
          builder: (context, _) => switch (session.state) {
            SessionState.loading => const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            ),
            SessionState.signedOut => const SignInScreen(),
            SessionState.signedIn => const HomeShell(),
          },
        ),
      ),
    );
  }
}
