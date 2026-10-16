import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

import 'models.dart';
import 'offline.dart';

/// Thrown for any non-2xx response. [status] 401 means the session is gone
/// (expired, signed out elsewhere, password reset) and the app signs out.
class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;

  bool get unauthorized => status == 401;

  @override
  String toString() => message;
}

/// Everything the app asks of the server. The UI depends on this interface,
/// so widget tests can swap in a fake.
abstract interface class TaskMasterApi {
  /// Online/offline status and the offline queue (lib/api/offline.dart).
  Connection get connection;

  /// Forget cached data and the offline queue (sign-out).
  Future<void> clearOfflineData();

  Future<Me> me();
  Future<Today> today();
  Future<List<Task>> tasks(TaskView view);

  /// Into the Inbox, or straight into a project (or for a goal) as a to-do.
  Future<Task> quickAdd(String title, {String? projectId, String? goalId});
  Future<void> setStatus(String taskId, TaskStatus status);
  Future<List<ProjectProgress>> projects();
  Future<ProjectDetail> project(String id);

  /// Save and organise a Brain Dump (nothing becomes a task yet).
  Future<DumpProposal> createDump(String text);

  /// Save the reviewed items; the first commit completes onboarding.
  Future<void> commitDump(String dumpId, List<ProposedItem> items);

  /// AI Planner: propose a timeline for today (nothing is saved).
  Future<PlannerProposal> proposePlan(
    String message,
    List<PlannerTurn> history,
  );

  /// Save a proposal's task blocks as today's plan.
  Future<void> applyPlan(List<PlannerBlock> blocks);

  /// Save preferences (any subset); returns the updated profile.
  Future<Me> updatePreferences(Map<String, Object?> changes);

  /// Permanently delete the account. [password] when the account has one.
  Future<void> deleteAccount({String? password});

  /// Rebuild today's plan around available time and energy.
  Future<void> rebuildToday(TodaySettings settings);

  /// Choose your own next action; null hands it back to the recommendation.
  Future<void> chooseNext(String? taskId);

  /// Keep, postpone or drop missed plan blocks (by recovery item id).
  Future<void> recover(Map<String, RecoveryChoice> decisions);

  Future<TaskDetail> taskDetail(String id);

  /// Edit a task: any of title, description, dueAt, estimatedMinutes,
  /// priority, importance, urgency, energy, project, goal.
  Future<void> updateTask(String id, Map<String, Object?> changes);
  Future<void> deleteTask(String id);

  /// Save the reviewed steps of a large task.
  Future<void> breakDown(String id, List<String> steps);

  /// Move Inbox items onto the list, optionally into a project (by name).
  Future<int> organiseInbox(List<String> ids, {String? project});

  Future<List<Goal>> goals();
  Future<void> createGoal(String title, {DateTime? targetDate});

  /// Suggested next steps for a goal; nothing is saved.
  Future<StepSuggestion> suggestGoalSteps(String goalId);

  /// Save reviewed steps as to-dos linked to the goal.
  Future<void> saveGoalSteps(
    String goalId,
    List<({String title, int? estimatedMinutes})> steps,
  );
  Future<List<Responsibility>> responsibilities();
  Future<void> stopResponsibility(String id);
  Future<DailyReview> dailyReview();
  Future<WeeklyReview> weeklyReview();

  Future<List<ConnectedCalendar>> calendars();

  /// Connect by private iCal address; returns how many events were found.
  Future<int> connectCalendar(String url);
  Future<void> disconnectCalendar(String id);
}

class HttpTaskMasterApi implements TaskMasterApi {
  HttpTaskMasterApi({
    required this.baseUrl,
    required this.timeZone,
    required this.accessToken,
    http.Client? client,
    this.offline,
    DateTime Function()? now,
  }) : _http = client ?? http.Client(),
       _now = now ?? DateTime.now;

  final Uri baseUrl;
  final String timeZone;

  /// The Supabase access token for this request (null when signed out).
  final String? Function() accessToken;
  final http.Client _http;

  /// Keeps the last good GET responses and offline Quick Adds; null turns
  /// offline support off.
  final OfflineStore? offline;
  final DateTime Function() _now;

  @override
  final connection = Connection();

  static const _queueKey = 'queue:quick-add';

  /// The queue may hold captures from a previous run; check it once online.
  bool _queueChecked = false;

  @override
  Future<void> clearOfflineData() async {
    await offline?.clear();
    connection
      ..setPending(0)
      ..markOnline();
  }

  bool _isNetworkError(Object e) => e is ApiException && e.status == 0;

  Future<List<Map<String, dynamic>>> _queue() async {
    final raw = await offline?.read(_queueKey);
    if (raw == null) return [];
    return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
  }

  Future<void> _saveQueue(List<Map<String, dynamic>> queue) async {
    await offline?.write(_queueKey, jsonEncode(queue));
    connection.setPending(queue.length);
  }

  /// Send offline Quick Adds, oldest first; stop at the first network
  /// error. A call while a sync is running waits for that sync.
  Future<void> flushQueue() {
    if (offline == null) return Future.value();
    return _flush ??= _sendQueued().whenComplete(() => _flush = null);
  }

  Future<void>? _flush;

  Future<void> _sendQueued() async {
    final queue = await _queue();
    connection.setPending(queue.length);
    while (queue.isNotEmpty) {
      final item = queue.first;
      try {
        await _send(
          'POST',
          '/api/v1/tasks',
          body: {
            'title': item['title'],
            'projectId': ?item['projectId'],
            'goalId': ?item['goalId'],
          },
        );
      } on ApiException catch (e) {
        if (_isNetworkError(e)) return;
        // Rejected for good (e.g. the project was deleted): drop it.
      }
      queue.removeAt(0);
      await _saveQueue(queue);
    }
  }

  Map<String, String> get _headers {
    final token = accessToken();
    return {
      'content-type': 'application/json',
      'accept': 'application/json',
      'x-time-zone': timeZone,
      if (token != null) 'authorization': 'Bearer $token',
    };
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Object? body,
    Map<String, String>? query,
  }) async {
    final uri = baseUrl.replace(path: path, queryParameters: query);
    final request = http.Request(method, uri)..headers.addAll(_headers);
    if (body != null) request.body = jsonEncode(body);
    final http.Response response;
    try {
      response = await http.Response.fromStream(await _http.send(request));
    } on Exception {
      throw ApiException(0, "Can't reach TaskMasterAi. Check your connection.");
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response;
    }
    String message = 'Something went wrong. Try again.';
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map && decoded['error'] is String) {
        message = decoded['error'] as String;
      } else if (decoded is Map && decoded['message'] is String) {
        message = decoded['message'] as String;
      }
    } on FormatException {
      // Non-JSON error body: keep the generic message.
    }
    throw ApiException(response.statusCode, message);
  }

  Future<Map<String, dynamic>> _json(
    String method,
    String path, {
    Object? body,
    Map<String, String>? query,
  }) async {
    final key = 'get:${baseUrl.replace(path: path, queryParameters: query)}';
    final http.Response response;
    try {
      response = await _send(method, path, body: body, query: query);
    } on ApiException catch (e) {
      // Offline: show the last good copy of a read, if there is one.
      if (method == 'GET' && _isNetworkError(e) && offline != null) {
        final cached = await offline!.read(key);
        if (cached != null) {
          final entry = jsonDecode(cached) as Map<String, dynamic>;
          connection.markOffline(DateTime.parse(entry['at'] as String));
          return entry['body'] as Map<String, dynamic>;
        }
      }
      rethrow;
    }
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    connection.markOnline();
    if (method == 'GET' && offline != null) {
      await offline!.write(
        key,
        jsonEncode({'at': _now().toIso8601String(), 'body': decoded}),
      );
    }
    if (connection.pending > 0 || !_queueChecked) {
      _queueChecked = true;
      flushQueue();
    }
    return decoded;
  }

  @override
  Future<Me> me() async => Me.fromJson(await _json('GET', '/api/v1/me'));

  @override
  Future<Today> today() async =>
      Today.fromJson(await _json('GET', '/api/v1/today'));

  @override
  Future<List<Task>> tasks(TaskView view) async {
    final json = await _json(
      'GET',
      '/api/v1/tasks',
      query: {'view': view.name},
    );
    return (json['tasks'] as List)
        .map((e) => Task.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<Task> quickAdd(
    String title, {
    String? projectId,
    String? goalId,
  }) async {
    try {
      final json = await _json(
        'POST',
        '/api/v1/tasks',
        body: {'title': title, 'projectId': ?projectId, 'goalId': ?goalId},
      );
      return Task.fromJson(json['task'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      // Capture never depends on signal: queue it and sync later.
      if (!_isNetworkError(e) || offline == null) rethrow;
      final queue = await _queue()
        ..add({
          'title': title,
          'projectId': projectId,
          'goalId': goalId,
          'at': _now().toIso8601String(),
        });
      await _saveQueue(queue);
      return Task(
        id: 'pending-${queue.length}',
        title: title,
        status: TaskStatus.inbox,
      );
    }
  }

  @override
  Future<void> setStatus(String taskId, TaskStatus status) async {
    await _send(
      'POST',
      '/api/v1/tasks/$taskId/status',
      body: {'status': statusToWire(status)},
    );
  }

  @override
  Future<List<ProjectProgress>> projects() async {
    final json = await _json('GET', '/api/v1/projects');
    return (json['projects'] as List)
        .map((e) => ProjectProgress.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<ProjectDetail> project(String id) async =>
      ProjectDetail.fromJson(await _json('GET', '/api/v1/projects/$id'));

  @override
  Future<DumpProposal> createDump(String text) async => DumpProposal.fromJson(
    await _json('POST', '/api/v1/dumps', body: {'text': text}),
  );

  @override
  Future<void> commitDump(String dumpId, List<ProposedItem> items) async {
    await _send(
      'POST',
      '/api/v1/dumps/$dumpId/commit',
      body: {
        'items': [for (final item in items) item.toReviewedJson()],
      },
    );
  }

  @override
  Future<PlannerProposal> proposePlan(
    String message,
    List<PlannerTurn> history,
  ) async => PlannerProposal.fromJson(
    await _json(
      'POST',
      '/api/v1/planner',
      body: {
        'message': message,
        'history': [for (final turn in history) turn.toJson()],
      },
    ),
  );

  @override
  Future<void> applyPlan(List<PlannerBlock> blocks) async {
    await _send(
      'POST',
      '/api/v1/planner/apply',
      body: {
        'blocks': [
          for (final b in blocks)
            {'taskId': b.taskId, 'start': b.start, 'minutes': b.minutes},
        ],
      },
    );
  }

  @override
  Future<Me> updatePreferences(Map<String, Object?> changes) async =>
      Me.fromJson(await _json('PATCH', '/api/v1/me', body: changes));

  @override
  Future<void> deleteAccount({String? password}) async {
    await _send(
      'DELETE',
      '/api/v1/me',
      body: {'confirmation': 'DELETE', 'password': ?password},
    );
  }

  @override
  Future<void> rebuildToday(TodaySettings settings) async {
    await _send('PUT', '/api/v1/today/settings', body: settings.toJson());
  }

  @override
  Future<void> chooseNext(String? taskId) async {
    await _send('PUT', '/api/v1/today/next', body: {'taskId': taskId});
  }

  @override
  Future<void> recover(Map<String, RecoveryChoice> decisions) async {
    await _send(
      'POST',
      '/api/v1/today/recovery',
      body: {
        'decisions': [
          for (final MapEntry(:key, :value) in decisions.entries)
            {'id': key, 'choice': value.name},
        ],
      },
    );
  }

  @override
  Future<TaskDetail> taskDetail(String id) async =>
      TaskDetail.fromJson(await _json('GET', '/api/v1/tasks/$id'));

  @override
  Future<void> updateTask(String id, Map<String, Object?> changes) async {
    await _send('PATCH', '/api/v1/tasks/$id', body: changes);
  }

  @override
  Future<void> deleteTask(String id) async {
    await _send('DELETE', '/api/v1/tasks/$id');
  }

  @override
  Future<void> breakDown(String id, List<String> steps) async {
    await _send(
      'POST',
      '/api/v1/tasks/$id/breakdown',
      body: {
        'steps': [
          for (final title in steps) {'title': title, 'estimatedMinutes': null},
        ],
      },
    );
  }

  @override
  Future<int> organiseInbox(List<String> ids, {String? project}) async {
    final json = await _json(
      'POST',
      '/api/v1/tasks/organise',
      body: {'ids': ids, 'project': project},
    );
    return json['moved'] as int;
  }

  @override
  Future<List<Goal>> goals() async {
    final json = await _json('GET', '/api/v1/goals');
    return [
      for (final g in json['goals'] as List)
        Goal.fromJson(g as Map<String, dynamic>),
    ];
  }

  @override
  Future<void> createGoal(String title, {DateTime? targetDate}) async {
    await _send(
      'POST',
      '/api/v1/goals',
      body: {
        'title': title,
        'targetDate': targetDate == null
            ? null
            : DateFormat('yyyy-MM-dd').format(targetDate),
      },
    );
  }

  @override
  Future<List<Responsibility>> responsibilities() async {
    final json = await _json('GET', '/api/v1/responsibilities');
    return [
      for (final r in json['responsibilities'] as List)
        Responsibility.fromJson(r as Map<String, dynamic>),
    ];
  }

  @override
  Future<void> stopResponsibility(String id) async {
    await _send('POST', '/api/v1/responsibilities/$id/stop');
  }

  @override
  Future<DailyReview> dailyReview() async =>
      DailyReview.fromJson(await _json('GET', '/api/v1/reviews/daily'));

  @override
  Future<WeeklyReview> weeklyReview() async =>
      WeeklyReview.fromJson(await _json('GET', '/api/v1/reviews/weekly'));

  @override
  Future<List<ConnectedCalendar>> calendars() async {
    final json = await _json('GET', '/api/v1/calendars');
    return [
      for (final c in json['calendars'] as List)
        ConnectedCalendar.fromJson(c as Map<String, dynamic>),
    ];
  }

  @override
  Future<int> connectCalendar(String url) async {
    final json = await _json('POST', '/api/v1/calendars', body: {'url': url});
    return json['events'] as int;
  }

  @override
  Future<void> disconnectCalendar(String id) async {
    await _send('DELETE', '/api/v1/calendars/$id');
  }

  @override
  Future<StepSuggestion> suggestGoalSteps(String goalId) async =>
      StepSuggestion.fromJson(
        await _json('GET', '/api/v1/goals/$goalId/steps'),
      );

  @override
  Future<void> saveGoalSteps(
    String goalId,
    List<({String title, int? estimatedMinutes})> steps,
  ) async {
    await _send(
      'POST',
      '/api/v1/goals/$goalId/steps',
      body: {
        'steps': [
          for (final s in steps)
            {'title': s.title, 'estimatedMinutes': s.estimatedMinutes},
        ],
      },
    );
  }
}
