import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:taskmaster/api/client.dart';
import 'package:taskmaster/api/models.dart';
import 'package:taskmaster/api/offline.dart';

import 'app_test.dart' show pumpApp;
import 'fakes.dart';

/// A server that can be switched off, recording what reached it.
class Server {
  bool up = true;
  final posted = <String>[];

  late final client = MockClient((request) async {
    if (!up) throw const SocketExceptionLike();
    if (request.method == 'POST' && request.url.path == '/api/v1/tasks') {
      final title = (jsonDecode(request.body) as Map)['title'] as String;
      posted.add(title);
      return http.Response(jsonEncode({'task': task('t-$title', title)}), 201);
    }
    if (request.url.path == '/api/v1/tasks') {
      return http.Response(
        jsonEncode({
          'view': 'all',
          'tasks': [task('t1', 'Finalise project proposal')],
        }),
        200,
      );
    }
    return http.Response('{}', 404);
  });
}

class SocketExceptionLike implements Exception {
  const SocketExceptionLike();
}

void main() {
  late Server server;
  late MemoryOfflineStore store;
  late HttpTaskMasterApi api;
  var clock = DateTime(2026, 10, 16, 14, 2);

  setUp(() {
    server = Server();
    store = MemoryOfflineStore();
    api = HttpTaskMasterApi(
      baseUrl: Uri.parse('https://example.test'),
      timeZone: 'Europe/London',
      accessToken: () => 'token',
      client: server.client,
      offline: store,
      now: () => clock,
    );
  });

  test('offline: shows the last good copy and says when it was from', () async {
    expect(
      (await api.tasks(TaskView.all)).single.title,
      'Finalise project proposal',
    );
    expect(api.connection.offline, isFalse);

    server.up = false;
    clock = DateTime(2026, 10, 16, 18);
    final cached = await api.tasks(TaskView.all);
    expect(cached.single.title, 'Finalise project proposal');
    expect(api.connection.offline, isTrue);
    expect(api.connection.showingDataFrom, DateTime(2026, 10, 16, 14, 2));

    // Something never loaded before still fails clearly.
    expect(() => api.tasks(TaskView.inbox), throwsA(isA<ApiException>()));
  });

  test(
    'offline: Quick Add is queued, then synced in order once back',
    () async {
      server.up = false;
      final a = await api.quickAdd('Buy stamps');
      await api.quickAdd('Call the bank');
      expect(a.id, startsWith('pending-'));
      expect(api.connection.pending, 2);
      expect(server.posted, isEmpty);

      server.up = true;
      await api.tasks(TaskView.all); // any successful request flushes
      await api.flushQueue();
      expect(server.posted, ['Buy stamps', 'Call the bank']);
      expect(api.connection.pending, 0);
      expect(api.connection.offline, isFalse);
    },
  );

  test('sign-out forgets cached data and the queue', () async {
    await api.tasks(TaskView.all);
    server.up = false;
    await api.quickAdd('Private thought');
    await api.clearOfflineData();
    expect(store.values, isEmpty);
    expect(api.connection.pending, 0);
    expect(() => api.tasks(TaskView.all), throwsA(isA<ApiException>()));
  });

  testWidgets('the offline banner says what you’re seeing', (tester) async {
    final fake = FakeApi();
    final (_, _, session) = await pumpApp(tester, signedIn: true, api: fake);
    expect(find.textContaining('offline'), findsNothing);
    fake.connection
      ..markOffline(DateTime(2026, 10, 16, 14, 2))
      ..setPending(1);
    await tester.pump();
    expect(
      find.text(
        'You’re offline — showing what you had at 14:02. 1 capture waiting to sync.',
      ),
      findsOneWidget,
    );
    await session.signOut();
    await tester.pumpAndSettle();
    expect(fake.offlineCleared, 1);
    expect(find.byType(Scaffold), findsWidgets);
  });
}
