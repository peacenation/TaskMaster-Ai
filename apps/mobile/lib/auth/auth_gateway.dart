import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// The person closed Google's account picker: not an error to show.
class SignInCancelled implements Exception {}

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

  /// Whether this build can offer "Continue with Google".
  bool get googleAvailable;

  /// Native Google sign-in: the phone's account picker, then the Google ID
  /// token is exchanged for a Supabase session (ADR-013).
  Future<void> signInWithGoogle();
  Future<void> signOut();
}

class SupabaseAuthGateway implements AuthGateway {
  SupabaseAuthGateway({
    this.googleWebClientId = '',
    this.googleIosClientId = '',
  });

  final String googleWebClientId;
  final String googleIosClientId;

  GoTrueClient get _auth => Supabase.instance.client.auth;

  // google_sign_in must be initialised exactly once per launch, so the nonce
  // is per launch: Google gets its SHA-256, Supabase the raw value, and a
  // token issued anywhere else can't be replayed into this app.
  Future<String>? _googleReady;

  Future<String> _initGoogle() async {
    final random = Random.secure();
    final rawNonce = base64Url.encode(
      List<int>.generate(32, (_) => random.nextInt(256)),
    );
    await GoogleSignIn.instance.initialize(
      serverClientId: googleWebClientId,
      clientId: googleIosClientId.isEmpty ? null : googleIosClientId,
      nonce: sha256.convert(utf8.encode(rawNonce)).toString(),
    );
    return rawNonce;
  }

  @override
  bool get googleAvailable => googleWebClientId.isNotEmpty;

  @override
  Future<void> signInWithGoogle() async {
    final String rawNonce;
    final String? idToken;
    try {
      rawNonce = await (_googleReady ??= _initGoogle());
      final account = await GoogleSignIn.instance.authenticate();
      idToken = account.authentication.idToken;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled ||
          e.code == GoogleSignInExceptionCode.interrupted) {
        throw SignInCancelled();
      }
      throw SignInException(switch (e.code) {
        GoogleSignInExceptionCode.clientConfigurationError ||
        GoogleSignInExceptionCode.providerConfigurationError =>
          'Google sign-in isn’t set up for this version of the app.',
        GoogleSignInExceptionCode.uiUnavailable =>
          'Google sign-in isn’t available on this device.',
        _ => 'Google sign-in didn’t finish. Try again.',
      });
    }
    if (idToken == null) {
      throw SignInException('Google didn’t return a sign-in token. Try again.');
    }
    try {
      await _auth.signInWithIdToken(
        provider: OAuthProvider.google,
        idToken: idToken,
        nonce: rawNonce,
      );
    } on AuthException {
      throw SignInException('Could not sign in with Google. Try again.');
    } on Exception {
      throw SignInException("Can't reach TaskMasterAi. Check your connection.");
    }
  }

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
      // Also forget the Google account choice, so the picker shows next time.
      if (_googleReady != null) await GoogleSignIn.instance.signOut();
    } on Exception {
      // Not signed in with Google on this launch; nothing to forget.
    }
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
