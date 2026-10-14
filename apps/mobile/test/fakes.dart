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
  FakeApi({this.onboarded = true});

  /// Flips to true when a Brain Dump is committed, like the server.
  bool onboarded;
  final statusCalls = <(String, TaskStatus)>[];
  final added = <(String, String?)>[];
  final committed = <List<String>>[];
  final planRequests = <String>[];
  final applied = <List<String>>[];
  bool expired = false;

  @override
  Future<Me> me() async => Me(
    id: 'u1',
    name: 'Jerry Mbawa',
    email: 'jerry@example.com',
    timeZone: 'Europe/London',
    onboarded: onboarded,
  );

  @override
  Future<Today> today() async {
    if (expired) throw ApiException(401, 'Unauthorized');
    if (!onboarded) {
      return Today.fromJson({
        'onboarded': false,
        'greeting': 'Good morning',
        'firstName': 'Jerry',
      });
    }
    return Today.fromJson(todayJson());
  }

  @override
  Future<List<Task>> tasks(TaskView view) async => [
    Task.fromJson(task('t1', 'Finalise project proposal', priority: 5)),
    if (view != TaskView.today)
      Task.fromJson(task('t3', 'Update launch checklist', priority: 1)),
  ];

  @override
  Future<Task> quickAdd(String title, {String? projectId}) async {
    added.add((title, projectId));
    return Task.fromJson(task('new', title));
  }

  @override
  Future<void> setStatus(String taskId, TaskStatus status) async =>
      statusCalls.add((taskId, status));

  @override
  Future<List<ProjectProgress>> projects() async => [
    ProjectProgress(id: 'p1', name: 'Website redesign', done: 8, total: 12),
  ];

  @override
  Future<ProjectDetail> project(String id) async => ProjectDetail.fromJson({
    'project': {'id': id, 'name': 'Website redesign', 'done': 8, 'total': 12},
    'inProgress': [task('t2', 'Review website designs', priority: 3)],
    'todo': [task('t1', 'Finalise project proposal', priority: 5)],
    'postponed': <Object>[],
  });

  @override
  Future<DumpProposal> createDump(String text) async => DumpProposal.fromJson({
    'dumpId': 'd1',
    'engine': 'heuristic',
    'notice': "Organised by TaskMaster's built-in rules — AI organising isn't set up.",
    'items': [
      for (final title in ['Finish the report', 'Book the dentist', 'Call Mum'])
        {
          'kind': 'task',
          'title': title,
          'deadline': null,
          'recurrence': null,
          'estimatedMinutes': null,
          'project': null,
        },
    ],
  });

  @override
  Future<void> commitDump(String dumpId, List<ProposedItem> items) async {
    committed.add([for (final item in items) item.title]);
    onboarded = true;
  }

  @override
  Future<PlannerProposal> proposePlan(
    String message,
    List<PlannerTurn> history,
  ) async {
    planRequests.add(message);
    return PlannerProposal.fromJson({
      'engine': 'ai',
      'reply':
          'Focused work this morning, your meeting at 14:00, then a buffer.',
      'blocks': [
        {
          'kind': 'task',
          'taskId': 't1',
          'title': 'Finalise project proposal',
          'project': 'Website redesign',
          'start': '09:00',
          'minutes': 60,
        },
        {
          'kind': 'event',
          'taskId': null,
          'title': 'Team meeting',
          'project': null,
          'start': '14:00',
          'minutes': 60,
        },
      ],
    });
  }

  @override
  Future<void> applyPlan(List<PlannerBlock> blocks) async =>
      applied.add([for (final b in blocks) b.taskId!]);
}

/// Supabase Auth stand-in: signs in unless told the password is wrong.
class FakeAuth implements AuthGateway {
  FakeAuth({this.signedIn = false});
  bool signedIn;
  bool rejectPassword = false;
  bool google = false;
  bool cancelGoogle = false;
  int googleCalls = 0;

  @override
  bool get googleAvailable => google;

  @override
  Future<void> signInWithGoogle() async {
    googleCalls++;
    if (cancelGoogle) throw SignInCancelled();
    signedIn = true;
  }

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
