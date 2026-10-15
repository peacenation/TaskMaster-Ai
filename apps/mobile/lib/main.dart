import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

import 'api/client.dart';
import 'app.dart';
import 'auth/auth_gateway.dart';
import 'config.dart';
import 'state/appearance.dart';
import 'state/reminders.dart';
import 'state/session.dart';

Future<void> main() async {
  // Keep the native launch screen up until Flutter's first frame (the
  // matching SplashIntro), not a blank frame in between.
  final binding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: binding);
  if (AppConfig.supabaseUrl.isEmpty ||
      AppConfig.supabasePublishableKey.isEmpty) {
    throw StateError(
      'Build with --dart-define=SUPABASE_URL=… and SUPABASE_PUBLISHABLE_KEY=… (lib/config.dart).',
    );
  }
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabasePublishableKey,
    authOptions: const FlutterAuthClientOptions(
      localStorage: SecureSessionStorage(),
    ),
  );
  String timeZone;
  try {
    timeZone = (await FlutterTimezone.getLocalTimezone()).identifier;
  } on Exception {
    timeZone = 'UTC';
  }
  final auth = SupabaseAuthGateway(
    googleWebClientId: AppConfig.googleWebClientId,
    googleIosClientId: AppConfig.googleIosClientId,
  );
  final api = HttpTaskMasterApi(
    baseUrl: Uri.parse(AppConfig.apiBaseUrl),
    timeZone: timeZone,
    accessToken: () => auth.accessToken,
  );
  final session = Session(
    api: api,
    auth: auth,
    reminders: LocalReminders(timeZone: timeZone),
  );
  final appearance = Appearance(SecureAppearanceStore());
  await appearance.load();
  runApp(TaskMasterApp(session: session, appearance: appearance));
  FlutterNativeSplash.remove();
  await session.restore();
}
