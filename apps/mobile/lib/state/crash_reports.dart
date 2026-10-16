import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:stack_trace/stack_trace.dart';

/// Crash reports to Sentry, when built with SENTRY_DSN. Like the server
/// (apps/web/lib/observability), only the error's type and where in the
/// app's code it happened are sent — never its message, which can hold a
/// task title or an API response.
class CrashReports {
  CrashReports._(this._endpoint, this._key, this._release);

  /// Null when the DSN is missing or malformed: reporting is off.
  static CrashReports? fromDsn(String dsn, {required String release}) {
    final uri = Uri.tryParse(dsn);
    if (uri == null || uri.userInfo.isEmpty) return null;
    final project = uri.pathSegments.isEmpty ? '' : uri.pathSegments.last;
    if (int.tryParse(project) == null) return null;
    final endpoint = uri.replace(userInfo: '', path: '/api/$project/envelope/');
    return CrashReports._(endpoint, uri.userInfo.split(':').first, release);
  }

  final Uri _endpoint;
  final String _key;
  final String _release;
  final _random = Random.secure();
  int _sentThisRun = 0;

  /// One crash loop shouldn't flood the project.
  static const _maxPerRun = 20;

  String _eventId() => List.generate(
    16,
    (_) => _random.nextInt(256),
  ).map((b) => b.toRadixString(16).padLeft(2, '0')).join();

  /// The envelope Sentry ingests: header, item header, event.
  String envelopeFor(Object error, StackTrace? stack, {DateTime? now}) {
    final at = (now ?? DateTime.now()).toUtc().toIso8601String();
    final id = _eventId();
    final frames = stack == null
        ? const <Map<String, Object?>>[]
        : [
            for (final f in Trace.from(stack).frames.reversed)
              {
                'function': f.member,
                'module': f.library,
                'lineno': f.line,
                'colno': f.column,
                'in_app': f.package == 'taskmaster',
              },
          ];
    final event = {
      'event_id': id,
      'timestamp': at,
      'platform': 'dart',
      'level': 'fatal',
      'logger': 'taskmaster.mobile',
      'release': _release,
      'exception': {
        'values': [
          {
            'type': error.runtimeType.toString(),
            // Deliberately no 'value' (the message).
            'stacktrace': {'frames': frames},
          },
        ],
      },
    };
    return [
      jsonEncode({'event_id': id, 'sent_at': at}),
      jsonEncode({'type': 'event'}),
      jsonEncode(event),
    ].join('\n');
  }

  Future<void> report(Object error, StackTrace? stack) async {
    if (_sentThisRun >= _maxPerRun) return;
    _sentThisRun++;
    try {
      await http
          .post(
            _endpoint,
            headers: {
              'content-type': 'application/x-sentry-envelope',
              'x-sentry-auth':
                  'Sentry sentry_version=7, sentry_key=$_key, sentry_client=taskmaster-mobile/1.0',
            },
            body: envelopeFor(error, stack),
          )
          .timeout(const Duration(seconds: 5));
    } on Object {
      // Best effort: never let reporting crash the app it's reporting on.
    }
  }
}
