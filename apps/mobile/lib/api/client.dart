import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

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
  Future<Me> me();
  Future<Today> today();
  Future<List<Task>> tasks(TaskView view);
  Future<Task> quickAdd(String title);
  Future<void> setStatus(String taskId, TaskStatus status);
  Future<List<ProjectProgress>> projects();
}

class HttpTaskMasterApi implements TaskMasterApi {
  HttpTaskMasterApi({
    required this.baseUrl,
    required this.timeZone,
    required this.accessToken,
    http.Client? client,
  }) : _http = client ?? http.Client();

  final Uri baseUrl;
  final String timeZone;

  /// The Supabase access token for this request (null when signed out).
  final String? Function() accessToken;
  final http.Client _http;

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
    final response = await _send(method, path, body: body, query: query);
    return jsonDecode(response.body) as Map<String, dynamic>;
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
  Future<Task> quickAdd(String title) async {
    final json = await _json('POST', '/api/v1/tasks', body: {'title': title});
    return Task.fromJson(json['task'] as Map<String, dynamic>);
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
}
