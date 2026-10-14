import 'package:flutter/material.dart';

import 'state/appearance.dart';
import 'state/session.dart';
import 'theme/app_theme.dart';
import 'ui/home_shell.dart';
import 'ui/sign_in_screen.dart';

class TaskMasterApp extends StatelessWidget {
  TaskMasterApp({super.key, required this.session, Appearance? appearance})
    : appearance = appearance ?? Appearance();

  final Session session;
  final Appearance appearance;

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      session: session,
      child: AppearanceScope(
        appearance: appearance,
        child: ValueListenableBuilder<ThemeMode>(
          valueListenable: appearance,
          builder: (context, mode, _) => MaterialApp(
            title: 'TaskMasterAi',
            debugShowCheckedModeBanner: false,
            theme: buildTheme(Brightness.light),
            darkTheme: buildTheme(Brightness.dark),
            themeMode: mode,
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
        ),
      ),
    );
  }
}
