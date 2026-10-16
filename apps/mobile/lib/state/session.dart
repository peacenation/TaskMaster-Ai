import 'package:flutter/widgets.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../auth/auth_gateway.dart';
import 'dictation.dart';
import 'home_widget.dart';
import 'reminders.dart';

enum SessionState { loading, signedOut, signedIn }

/// Who is signed in. Any 401 from the API (expired, revoked, signed out on
/// another device) lands here and returns the app to sign-in.
class Session extends ChangeNotifier {
  Session({
    required this.api,
    required this.auth,
    this.reminders = const NoReminders(),
    this.dictation,
    this.homeWidget = const NoHomeScreenWidget(),
  });

  final TaskMasterApi api;
  final AuthGateway auth;
  final Reminders reminders;

  /// Speech-to-text for Brain Dump; null where it isn't available.
  final Dictation? dictation;

  /// The Android home-screen widget.
  final HomeScreenWidget homeWidget;

  bool get remindersOn => me?.preferences.notifications != 'off';

  /// Today, with this device's reminders rescheduled to match it.
  Future<Today> loadToday() async {
    final today = await api.today();
    // Not awaited: reminders and the widget never hold up Today.
    reminders.sync(today, enabled: remindersOn);
    homeWidget.show(today);
    return today;
  }

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
    if (!remindersOn) await reminders.clear();
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
    reminders.clear();
    homeWidget.clear();
    // Cached data and the offline queue belong to the account signing out.
    api.clearOfflineData();
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
