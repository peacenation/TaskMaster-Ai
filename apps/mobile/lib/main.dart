import 'package:flutter/material.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

import 'api/client.dart';
import 'app.dart';
import 'auth/auth_gateway.dart';
import 'config.dart';
import 'state/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
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
  final auth = SupabaseAuthGateway();
  final api = HttpTaskMasterApi(
    baseUrl: Uri.parse(AppConfig.apiBaseUrl),
    timeZone: timeZone,
    accessToken: () => auth.accessToken,
  );
  final session = Session(api: api, auth: auth);
  runApp(TaskMasterApp(session: session));
  await session.restore();
}
