import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Thrown when signing in fails, with a message fit to show the person.
class SignInException implements Exception {
  SignInException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Sign-in, as the rest of the app needs it. Supabase Auth in the app
/// (ADR-013); a fake in widget tests.
abstract interface class AuthGateway {
  bool get hasSession;

  /// The current access token for `Authorization: Bearer` (refreshed by the
  /// SDK before it expires), or null when signed out.
  String? get accessToken;

  Future<void> signIn(String email, String password);
  Future<void> signOut();
}

class SupabaseAuthGateway implements AuthGateway {
  GoTrueClient get _auth => Supabase.instance.client.auth;

  @override
  bool get hasSession => _auth.currentSession != null;

  @override
  String? get accessToken => _auth.currentSession?.accessToken;

  @override
  Future<void> signIn(String email, String password) async {
    try {
      await _auth.signInWithPassword(email: email, password: password);
    } on AuthException catch (e) {
      throw SignInException(switch (e.code) {
        'invalid_credentials' =>
          'That email and password don’t match an account.',
        'email_not_confirmed' =>
          'Confirm your email first — check your inbox for the link.',
        'over_request_rate_limit' =>
          'Too many attempts. Wait a minute and try again.',
        _ => 'Could not sign in. Try again.',
      });
    } on Exception {
      throw SignInException("Can't reach TaskMasterAi. Check your connection.");
    }
  }

  @override
  Future<void> signOut() async {
    try {
      // This device only, like the web's Sign out.
      await _auth.signOut(scope: SignOutScope.local);
    } on Exception {
      // Signing out locally still matters if the server can't be reached.
    }
  }
}

/// Keeps the Supabase session in the platform keychain/keystore rather than
/// plain shared preferences.
class SecureSessionStorage extends LocalStorage {
  const SecureSessionStorage();
  static const _key = 'supabase_session';
  static const _storage = FlutterSecureStorage();

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasAccessToken() async =>
      (await _storage.read(key: _key)) != null;

  @override
  Future<String?> accessToken() => _storage.read(key: _key);

  @override
  Future<void> removePersistedSession() => _storage.delete(key: _key);

  @override
  Future<void> persistSession(String persistSessionString) =>
      _storage.write(key: _key, value: persistSessionString);
}
