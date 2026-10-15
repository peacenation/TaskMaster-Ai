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

  Future<void> signInWithGoogle() async {
    await auth.signInWithGoogle();
    me = await api.me();
    state = SessionState.signedIn;
    notifyListeners();
  }

  Future<void> signOut() async {
    await auth.signOut();
    _signedOut();
  }

  /// Save preferences and keep [me] current.
  Future<void> savePreferences(Map<String, Object?> changes) async {
    me = await api.updatePreferences(changes);
    notifyListeners();
  }

  /// Permanently delete the account, then return to sign-in. Google-only
  /// accounts confirm with Google first (the server wants a fresh sign-in).
  Future<void> deleteAccount({String? password}) async {
    if (me?.hasPassword == false) await auth.signInWithGoogle();
    await api.deleteAccount(password: password);
    try {
      await auth.signOut();
    } on Object {
      // The login is already gone; there's nothing left to sign out of.
    }
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
