import 'package:taskmaster/api/client.dart';
import 'package:taskmaster/api/models.dart';
import 'package:taskmaster/auth/auth_gateway.dart';

/// A /api/v1/today body exactly as the server sends it (keep in step with
/// packages/api-contract/openapi.yaml and apps/web/app/api/v1/today).
Map<String, dynamic> todayJson({bool overridden = false}) => {
  'onboarded': true,
  'date': '2026-10-12',
  'greeting': 'Good morning',
  'firstName': 'Jerry',
  'stats': {'active': 12, 'dueToday': 4, 'completedToday': 2, 'inbox': 1},
  'recommendation': {
    'task': task('t1', 'Finalise project proposal', priority: 5),
    'message': 'Finalise project proposal next — it\'s due today.',
    'reasons': ['it\'s due today'],
    'overridden': overridden,
  },
  'plan': [
    {
      'task': task('t1', 'Finalise project proposal', priority: 5),
      'position': 0,
      'minutes': 60,
      'estimateIsDefault': false,
      'protected': false,
      'scheduledStart': '2026-10-12T09:00:00.000Z',
      'scheduledEnd': '2026-10-12T10:00:00.000Z',
    },
    {
      'task': task('t2', 'Review website designs', priority: 3),
      'position': 1,
      'minutes': 30,
      'estimateIsDefault': true,
      'protected': false,
      'scheduledStart': '2099-10-12T11:00:00.000Z',
      'scheduledEnd': '2099-10-12T11:30:00.000Z',
    },
  ],
  'capacity': {
    'plannedMinutes': 90,
    'availableMinutes': 240,
    'usableMinutes': 192,
    'overloaded': false,
  },
  'projects': [
    {'id': 'p1', 'name': 'Website redesign', 'done': 8, 'total': 12},
  ],
  'attention': {'recovery': 0, 'realityCheck': false},
};

Map<String, dynamic> task(String id, String title, {int? priority}) => {
  'id': id,
  'title': title,
  'status': 'todo',
  'priority': priority,
  'dueAt': '2026-10-12T10:00:00.000Z',
  'estimatedMinutes': 60,
  'project': {'id': 'p1', 'name': 'Website redesign'},
};

class FakeApi implements TaskMasterApi {
  final statusCalls = <(String, TaskStatus)>[];
  final added = <String>[];
  bool expired = false;

  @override
  Future<Me> me() async => Me(
    id: 'u1',
    name: 'Jerry Mbawa',
    email: 'jerry@example.com',
    timeZone: 'Europe/London',
    onboarded: true,
  );

  @override
  Future<Today> today() async {
    if (expired) throw ApiException(401, 'Unauthorized');
    return Today.fromJson(todayJson());
  }

  @override
  Future<List<Task>> tasks(TaskView view) async => [
    Task.fromJson(task('t1', 'Finalise project proposal', priority: 5)),
    if (view != TaskView.today)
      Task.fromJson(task('t3', 'Update launch checklist', priority: 1)),
  ];

  @override
  Future<Task> quickAdd(String title) async {
    added.add(title);
    return Task.fromJson(task('new', title));
  }

  @override
  Future<void> setStatus(String taskId, TaskStatus status) async =>
      statusCalls.add((taskId, status));

  @override
  Future<List<ProjectProgress>> projects() async => [
    ProjectProgress(id: 'p1', name: 'Website redesign', done: 8, total: 12),
  ];
}

/// Supabase Auth stand-in: signs in unless told the password is wrong.
class FakeAuth implements AuthGateway {
  FakeAuth({this.signedIn = false});
  bool signedIn;
  bool rejectPassword = false;

  @override
  bool get hasSession => signedIn;

  @override
  String? get accessToken => signedIn ? 'token-123' : null;

  @override
  Future<void> signIn(String email, String password) async {
    if (rejectPassword) {
      throw SignInException('That email and password don’t match an account.');
    }
    signedIn = true;
  }

  @override
  Future<void> signOut() async => signedIn = false;
}
