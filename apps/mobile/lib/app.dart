import 'package:flutter/material.dart';

import 'state/appearance.dart';
import 'state/session.dart';
import 'theme/app_theme.dart';
import 'ui/home_shell.dart';
import 'ui/sign_in_screen.dart';
import 'ui/splash.dart';

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
            home: _Launch(session: session),
          ),
        ),
      ),
    );
  }
}

/// The intro plays while the session is restored; the first screen fades in
/// once both are done, so a fast restore never cuts the animation short and
/// a slow one never shows a bare spinner.
class _Launch extends StatefulWidget {
  const _Launch({required this.session});
  final Session session;

  @override
  State<_Launch> createState() => _LaunchState();
}

class _LaunchState extends State<_Launch> {
  bool _introDone = false;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.session,
      builder: (context, _) {
        final ready =
            _introDone && widget.session.state != SessionState.loading;
        return AnimatedSwitcher(
          duration: const Duration(milliseconds: 350),
          child: !ready
              ? SplashIntro(
                  key: const ValueKey('intro'),
                  onDone: () => setState(() => _introDone = true),
                )
              : switch (widget.session.state) {
                  SessionState.signedIn => const HomeShell(),
                  _ => const SignInScreen(),
                },
        );
      },
    );
  }
}
