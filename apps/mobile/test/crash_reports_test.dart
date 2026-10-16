import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:taskmaster/state/crash_reports.dart';

void main() {
  test('crash reports are off without a valid DSN', () {
    expect(CrashReports.fromDsn('', release: 'x'), isNull);
    expect(
      CrashReports.fromDsn('https://o1.ingest.sentry.io/2', release: 'x'),
      isNull,
    );
    expect(CrashReports.fromDsn('nonsense', release: 'x'), isNull);
  });

  test('a crash report has the type and frames, never the message', () {
    final reports = CrashReports.fromDsn(
      'https://pubkey@o1.ingest.sentry.io/42',
      release: 'taskmaster-mobile@test',
    )!;
    final error = StateError('Task "Call my therapist" not found');
    final envelope = reports.envelopeFor(error, StackTrace.current);
    final lines = envelope.split('\n').map(jsonDecode).toList();
    expect(lines[1], {'type': 'event'});
    final exception = (lines[2]['exception']['values'] as List).single;
    expect(exception['type'], 'StateError');
    expect(exception.containsKey('value'), isFalse);
    expect((exception['stacktrace']['frames'] as List), isNotEmpty);
    expect(envelope, isNot(contains('therapist')));
  });
}
