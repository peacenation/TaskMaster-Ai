/// Build-time configuration, passed with --dart-define. Sign-in goes to
/// Supabase Auth directly (ADR-013); data goes to the web app's /api/v1.
///
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000   (Android emulator → host)
///   flutter run --dart-define=API_BASE_URL=http://localhost:3000  (iOS simulator)
///   flutter build appbundle --dart-define=API_BASE_URL=https://your-host \\
///     --dart-define=SUPABASE_URL=https://your-ref.supabase.co \\
///     --dart-define=SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
///
/// Local Supabase (`npm run supabase:start`) is at :54321 on the host:
/// 10.0.2.2 from the Android emulator, localhost from the iOS simulator.
abstract final class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://tasksmaster-ai.netlify.app',
  );
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');

  /// Public by design (it ships in every client); RLS and the server's own
  /// checks protect data, not this key.
  static const supabasePublishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
  );

  /// Google sign-in (optional; the button hides when unset). The **Web**
  /// OAuth client ID — the one entered in Supabase → Auth → Google — so the
  /// ID token Google issues is one Supabase accepts. Public, not a secret.
  static const googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
  );

  /// iOS only: the iOS OAuth client ID from Google Cloud. Public.
  static const googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
  );

  /// Crash reports (lib/state/crash_reports.dart); off when unset. A
  /// Sentry DSN is public by design — it can only submit events.
  static const sentryDsn = String.fromEnvironment('SENTRY_DSN');
}
