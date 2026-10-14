import 'package:flutter/widgets.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../auth/auth_gateway.dart';

enum SessionState { loading, signedOut, signedIn }

/// Who is signed in. Any 401 from the API (expired, revoked, signed out on
/// another device) lands here and returns the app to sign-in.
class Session extends ChangeNotifier {
  Session({required this.api, required this.auth});

  final TaskMasterApi api;
  final AuthGateway auth;

  SessionState state = SessionState.loading;
  Me? me;

  Future<void> restore() async {
    if (!auth.hasSession) return _signedOut();
    try {
      me = await api.me();
      state = SessionState.signedIn;
      notifyListeners();
    } on ApiException catch (e) {
      // Revoked or deleted: drop it. Unreachable: show sign-in but keep the
      // stored session so the next launch can resume without a password.
      if (e.unauthorized) await auth.signOut();
      _signedOut();
    }
  }

  Future<void> signIn(String email, String password) async {
    await auth.signIn(email.trim(), password);
    me = await api.me();
    state = SessionState.signedIn;
    notifyListeners();
  }

  Future<void> signOut() async {
    await auth.signOut();
    _signedOut();
  }

  /// Call from screens when a request fails; signs out on 401.
  Future<void> handle(Object error) async {
    if (error is ApiException && error.unauthorized) {
      await auth.signOut();
      _signedOut();
    }
  }

  void _signedOut() {
    me = null;
    state = SessionState.signedOut;
    notifyListeners();
  }
}

class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({
    super.key,
    required Session session,
    required super.child,
  }) : super(notifier: session);

  static Session of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;

  static Session read(BuildContext context) =>
      context.getInheritedWidgetOfExactType<SessionScope>()!.notifier!;
}
